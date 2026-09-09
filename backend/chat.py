"""
Powers POST /api/chat - the "Ask Blueprint" assistant.

This is a real LLM-backed chatbot (via Google's free Gemini API), not a keyword
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

Requires GEMINI_API_KEY to be set (see README "Environment variables") -
get a free one at aistudio.google.com/apikey, no credit card needed. Without it,
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


GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
GEMINI_MODEL = "gemini-2.5-flash"


def llm_chat(message: str, history: list[dict], scan_context: dict | None):
    """Real LLM turn via Google's free Gemini API (OpenAI-compatible
    format). Returns (reply_text, None) on success, or (None, error_reason)
    on failure - callers fall back to the deterministic matcher either
    way, but keeping the real reason lets /api/chat surface it directly
    in the response, which is far easier to debug on a deployed backend
    than digging through logs.

    Note: we tried Groq here first, but Groq's API sits behind Cloudflare,
    which blocks requests from Azure's datacenter IP ranges as suspected
    bot traffic (a known, unresolved issue on Groq's own community forum
    for exactly this Azure-deployment scenario) - it works from a laptop
    but 403s once deployed. Gemini is Google's own infrastructure and
    doesn't have this problem."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None, "GEMINI_API_KEY is not set in this environment"

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
            GEMINI_API_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": GEMINI_MODEL,
                "messages": api_messages,
                "max_tokens": 600,
                "temperature": 0.4,
            },
            timeout=45,
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"].strip(), None
    except Exception as e:
        logging.exception("LLM chat call failed")
        return None, f"{type(e).__name__}: {e}"


def get_chat_reply(message: str, history: list[dict], scan_context: dict | None):
    """
    Returns (recommendation | None, reply_text, debug_reason | None).

    recommendation is attached whenever the message matches a known
    pattern in RECOMMENDATIONS - this drives the rich SuggestionCard in
    the UI (snippet + est. cost) alongside the LLM's free-form reply. The
    LLM stays the primary source of the conversational text; the card is
    a bonus, not a replacement.

    debug_reason is the real exception (or "key not set"), included so
    /api/chat can surface it directly for troubleshooting a deployed
    backend without needing log access.
    """
    rec = match_recommendation(message)

    reply, error = llm_chat(message, history, scan_context)
    if reply is not None:
        return rec, reply, None

    # No API key configured, or the call failed - deterministic fallback.
    if rec:
        return rec, f'(offline fallback - set GEMINI_API_KEY for free-form Q&A) Here\'s a fit for "{message}":', error
    return None, (
        "I can't reach the chat model right now, and this message "
        "didn't match a known pattern. Try something like \"cheap database\", \"small VM\", or "
        "\"secure storage\"."
    ), error
