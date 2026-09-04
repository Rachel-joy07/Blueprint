"""
Powers POST /api/chat - the "Ask Blueprint" assistant.

This is a real LLM-backed chatbot (via Groq's free API), not a keyword
rule engine. It's given:
  1. A system prompt describing what Blueprint is and a small knowledge
     base of known-good Azure config patterns (RECOMMENDATIONS below), so
     its answers stay grounded in things this tool actually understands.
  2. Optionally, a compact summary of the user's *current scan* (resource
     list + flagged issues), if the frontend sends one - so someone can
     ask "why is my VM flagged?" or "what should I fix first?" and get an
     answer about their actual infrastructure, not a generic one.
  3. The running conversation history, so it's a real back-and-forth, not
     one-shot Q&A.

Requires GROQ_API_KEY to be set (see README "Environment variables") -
get a free one at console.groq.com, no credit card needed. Without it,
this falls back to a small deterministic keyword matcher against
RECOMMENDATIONS - useful for offline dev, but that's a fallback mode
now, not the primary path. Say so plainly in the reply rather than
silently pretending to be the real thing.
"""

import os
import logging
import requests

RECOMMENDATIONS = [
    {
        "keywords": ["cheap database", "budget database", "small database", "low cost db"],
        "title": "Budget-friendly database",
        "suggestion": "azurerm_mssql_database — Basic tier",
        "reasoning": "Basic tier handles light workloads (small apps, dev/test) at a fraction of Standard/Premium cost.",
        "snippet": 'resource "azurerm_mssql_database" "app" {\n  name      = "app-db"\n  server_id = azurerm_mssql_server.app.id\n  sku_name  = "Basic"\n}',
        "estCost": "~$5/mo"
    },
    {
        "keywords": ["secure storage", "private storage", "encrypted storage"],
        "title": "Locked-down storage account",
        "suggestion": "azurerm_storage_account with public access disabled",
        "reasoning": "Blocks public blob access by default and enforces HTTPS-only, closing the two most common storage misconfigurations.",
        "snippet": 'resource "azurerm_storage_account" "data" {\n  name                      = "appdata"\n  allow_blob_public_access  = false\n  enable_https_traffic_only = true\n}',
        "estCost": "~$2-20/mo depending on usage"
    },
    {
        "keywords": ["small vm", "cheap vm", "dev vm", "test vm", "budget vm", "small server"],
        "title": "Right-sized dev/test VM",
        "suggestion": "azurerm_linux_virtual_machine — Standard_B2s",
        "reasoning": "Burstable B-series is built for light, non-continuous workloads like dev/test boxes.",
        "snippet": 'resource "azurerm_linux_virtual_machine" "dev" {\n  name = "dev-server"\n  size = "Standard_B2s"\n}',
        "estCost": "~$30/mo"
    },
    {
        "keywords": ["static website", "static site", "landing page", "host website"],
        "title": "Static site hosting",
        "suggestion": "azurerm_storage_account static website hosting",
        "reasoning": "For a static site, a full VM or App Service is overkill compared to storage static hosting + CDN.",
        "snippet": 'resource "azurerm_storage_account" "site" {\n  name = "myappsite"\n  static_website {\n    index_document = "index.html"\n  }\n}',
        "estCost": "~$1-5/mo"
    },
    {
        "keywords": ["restrict ssh", "lock down ssh", "secure ssh", "fix ssh"],
        "title": "SSH access restricted to a known network",
        "suggestion": "azurerm_network_security_group rule scoped to your CIDR",
        "reasoning": "Replaces 0.0.0.0/0 with a specific office/VPN range so SSH is not exposed to the whole internet.",
        "snippet": 'security_rule {\n  destination_port_range = "22"\n  source_address_prefix  = "203.0.113.0/24"\n  access                 = "Allow"\n}',
        "estCost": "no cost impact"
    }
]


def match_recommendation(user_text: str):
    text = user_text.lower()
    best, best_score = None, 0
    for rec in RECOMMENDATIONS:
        for kw in rec["keywords"]:
            if kw in text and len(kw) > best_score:
                best, best_score = rec, len(kw)
    return best


SYSTEM_PROMPT_BASE = """You are "Ask Blueprint", the chat assistant embedded in Blueprint, a \
student-built tool that scans Terraform files for Azure security and cost issues and renders \
them as an interactive architecture diagram.

You help with two kinds of questions:
1. General Azure Terraform advice - suggesting right-sized resource configs (e.g. "I want a \
cheap database" -> a Basic-tier azurerm_mssql_database with a short reasoning and a snippet).
2. Questions about the user's CURRENT scan, if one is provided below - e.g. "why is my VM \
flagged?", "what should I fix first?", "how much would fixing everything save me?". Answer \
using ONLY the scan data given to you; if something isn't in it, say you don't have that \
information rather than guessing.

Keep replies short (2-5 sentences, or a short list) and concrete. Include a Terraform snippet \
when a config change is the answer. You're a helpful assistant inside a small tool, not a \
general-purpose chatbot - stay focused on Azure/Terraform/cost/security topics; for anything \
unrelated, briefly say that's outside what Blueprint helps with.

Known good patterns you can draw on (not exhaustive - reason beyond these when useful):
"""


def build_system_prompt(scan_context: dict | None) -> str:
    prompt = SYSTEM_PROMPT_BASE
    for rec in RECOMMENDATIONS:
        prompt += f"- {rec['title']}: {rec['suggestion']} ({rec['estCost']}) - {rec['reasoning']}\n"

    if scan_context:
        prompt += "\nThe user's current scan:\n"
        prompt += f"- File: {scan_context.get('fileName', 'unknown')}\n"
        summary = scan_context.get("summary", {})
        prompt += (
            f"- {summary.get('resourceCount', '?')} resources, "
            f"{summary.get('riskCount', '?')} security flags, "
            f"{summary.get('wasteCount', '?')} cost/waste flags, "
            f"risk score {summary.get('riskScore', '?')}/100, "
            f"${summary.get('monthlyCostActual', '?')}/mo actual vs "
            f"${summary.get('monthlyCostOptimized', '?')}/mo optimized\n"
        )
        for node in scan_context.get("nodes", []):
            if node.get("issue"):
                issue = node["issue"]
                prompt += (
                    f"  - {node['label']} ({node['type']}) [{issue['severity'].upper()}]: "
                    f"{issue['title']} - {issue.get('explanation', '')} "
                    f"Fix: {issue.get('fix', '')}\n"
                )
            else:
                prompt += f"  - {node['label']} ({node['type']}): clean, no issues\n"
    else:
        prompt += "\nNo scan has been uploaded yet in this session.\n"

    return prompt


GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "openai/gpt-oss-120b"


def llm_chat(message: str, history: list[dict], scan_context: dict | None):
    """Real LLM turn via Groq's free API (OpenAI-compatible format).
    Returns reply text, or None if unavailable/failed - callers should
    fall back to the deterministic matcher when this returns None, so
    the assistant degrades gracefully rather than breaking outright."""
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return None

    try:
        system = build_system_prompt(scan_context)

        # history comes from the frontend as [{role, content}, ...] - trust
        # but cap it so a long session can't blow up token usage.
        api_messages = [{"role": "system", "content": system}]
        api_messages += [
            {"role": m["role"], "content": m["content"]}
            for m in history[-12:]
            if m.get("role") in ("user", "assistant") and m.get("content")
        ]
        api_messages.append({"role": "user", "content": message})

        response = requests.post(
            GROQ_API_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": GROQ_MODEL,
                "messages": api_messages,
                "max_tokens": 600,
                "temperature": 0.4,
            },
            timeout=45,
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"].strip()
    except Exception:
        logging.exception("LLM chat call failed")
        return None


def get_chat_reply(message: str, history: list[dict], scan_context: dict | None):
    """
    Returns (recommendation | None, reply_text).

    recommendation is attached whenever the message matches a known
    pattern in RECOMMENDATIONS - this drives the rich SuggestionCard in
    the UI (snippet + est. cost) alongside the LLM's free-form reply. The
    LLM stays the primary source of the conversational text; the card is
    a bonus, not a replacement.
    """
    rec = match_recommendation(message)

    reply = llm_chat(message, history, scan_context)
    if reply is not None:
        return rec, reply

    # No API key configured, or the call failed - deterministic fallback.
    if rec:
        return rec, f'(offline fallback - set GROQ_API_KEY for free-form Q&A) Here\'s a fit for "{message}":'
    return None, (
        "I can't reach the chat model right now (is GROQ_API_KEY set?), and this message "
        "didn't match a known pattern. Try something like \"cheap database\", \"small VM\", or "
        "\"secure storage\"."
    )


# --- Manager / Engineer narrative -------------------------------------
#
# A different job for the same Groq call: instead of answering a
# question, summarize the whole scan as a short paragraph pitched at a
# specific audience. Reuses build_system_prompt() so the model sees the
# same grounded scan data the chat assistant does.

NARRATIVE_INSTRUCTIONS = {
    "manager": (
        "Write a short (3-5 sentence) plain-English summary of this infrastructure scan for a "
        "non-technical manager or stakeholder. No jargon, no Terraform syntax, no resource type "
        "names. Focus on business risk (what could go wrong, described in plain terms - e.g. "
        "'anyone on the internet could read customer data') and dollar cost impact. End with the "
        "single most urgent thing to fix, in plain terms."
    ),
    "engineer": (
        "Write a short (3-5 sentence) technical summary of this infrastructure scan for an "
        "engineer. Reference specific resource names, the exact misconfiguration, and the fix. "
        "Prioritize by severity (security risks before cost waste) and note the total potential "
        "monthly savings."
    ),
}


def get_narrative(scan_context: dict, audience: str = "manager") -> str | None:
    """Real LLM call. Returns None if no API key or the call fails -
    callers should fall back to build_fallback_narrative()."""
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key or not scan_context:
        return None

    try:
        instructions = NARRATIVE_INSTRUCTIONS.get(audience, NARRATIVE_INSTRUCTIONS["manager"])
        system = instructions + "\n\n" + build_system_prompt(scan_context)

        response = requests.post(
            GROQ_API_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": "Summarize this scan."},
                ],
                "max_tokens": 250,
                "temperature": 0.4,
            },
            timeout=45,
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        logging.exception("Narrative generation failed")
        return None


def build_fallback_narrative(scan_context: dict, audience: str = "manager") -> str:
    """Deterministic template used when GROQ_API_KEY isn't set or the
    call fails - keeps this feature demoable with zero external
    dependency, same philosophy as the rest of the tool."""
    summary = scan_context.get("summary", {})
    risk = summary.get("riskCount", 0)
    waste = summary.get("wasteCount", 0)
    savings = (summary.get("monthlyCostActual", 0) or 0) - (summary.get("monthlyCostOptimized", 0) or 0)
    flagged = [n for n in scan_context.get("nodes", []) if n.get("issue")]
    top_risk = next((n for n in flagged if n["issue"]["severity"] == "risk"), None)

    if audience == "manager":
        text = f"This scan found {risk} security issue(s) and {waste} cost-inefficiency issue(s). "
        if savings > 0:
            text += f"Fixing the cost issues could save roughly ${savings:.0f}/month. "
        if top_risk:
            text += f"Most urgent: \"{top_risk['issue']['title']}\" on {top_risk['label']} - this should be addressed first."
        else:
            text += "No urgent security issues were found."
        return text

    if not flagged:
        return "No issues found - every resource passed both the security and cost rule sets."
    lines = [f"- {n['label']} ({n['type']}): {n['issue']['title']}" for n in flagged]
    return "Findings, by resource:\n" + "\n".join(lines)


def get_narrative_reply(scan_context: dict, audience: str = "manager"):
    """Returns (text, is_live_llm_response: bool)."""
    text = get_narrative(scan_context, audience)
    if text is not None:
        return text, True
    return build_fallback_narrative(scan_context, audience), False
