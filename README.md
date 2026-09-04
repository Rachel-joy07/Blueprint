# Blueprint — Infra Risk Inspector

Upload a Terraform file, get back a live architecture diagram with security
and cost flaws highlighted, an exact code line, an explanation, and a fix —
with real Azure pricing.

## What's already built

- **Frontend**: full working UI (React + Vite + Tailwind + React Flow),
  blueprint-style diagram, stats bar with risk gauge, slide-in detail
  panel, a collapsible **findings list** (left sidebar — every flagged
  resource at a glance), a **Diagram / Code toggle** that switches to a
  real **source code viewer** — line-numbered `.tf` source with flagged
  lines colored inline, clickable both ways — and a floating **chat
  assistant** ("Ask Blueprint") that's a real, conversational LLM chatbot
  via Groq's free API, not keyword matching: it remembers the
  conversation and can answer questions about *this specific scan* in
  addition to open-ended config advice. Runs standalone against mock
  data — you can demo the visuals with zero backend running.
- **Compliance framework mapping**: every security/cost finding is
  tagged with the real-world standard it maps to (CIS Azure Benchmark,
  PCI-DSS, SOC 2, HIPAA, or the Well-Architected Framework's cost
  pillar) — shown as badges in the detail panel. See `backend/compliance.py`.
  This is what turns "here's a red dot" into "here's why your compliance
  team would actually flag this."
- **Auto-fix with diff view**: click "Auto-fix all" (top bar) or
  "Auto-fix this" (on any single finding) to have the backend generate
  an actual corrected version of the flagged Terraform block — shown as
  a before/after diff, with a "Download fixed file" button. Fixes are
  mechanical, conservative text patches (flip a boolean, swap a CIDR,
  swap a VM size, or delete an unused resource) — never an invented
  value the rule itself didn't already flag. See `backend/autofix.py`.
- **Manager / Engineer narrative toggle**: a one-paragraph, plain-English
  summary of the whole scan for a non-technical stakeholder, versus a
  technical bullet summary for an engineer — toggle pill just under the
  stats bar. LLM-generated via the same Groq call as the chat assistant,
  with a deterministic template fallback if no API key is set. See
  `get_narrative()` in `backend/chat.py`.
- **Scan history + trend tracking**: signed-in users' past scans are
  listed (existing feature), plus a **Trends tab** in the same panel
  showing risk score and monthly cost as sparkline charts across your
  scan history — so "did this get better or worse since last time" is a
  glance, not a manual comparison. See `TrendChart.jsx`.
- **Backend**: Azure Function (Python v2 model) with a Terraform parser,
  4 security rules, 2 cost rules (one calls the real Azure Retail
  Pricing API), real line-number tracking per finding, and endpoints for
  scan, chat, auto-fix, narrative, and scan history/stats.

## Run the frontend right now

```bash
cd frontend
npm install
npm run dev
```

Open the local URL it prints, click **"or load the sample scan"** — you'll
see the full diagram, gauge, and detail panel working against `mockScan.js`.
This is your safety net if the backend or wifi fails during the demo.

## Run the backend

You need [Azure Functions Core Tools](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local) installed.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt --break-system-packages   # drop the flag on Windows
cp local.settings.json.example local.settings.json
# then edit local.settings.json and paste in a real GROQ_API_KEY (free)
func start
```

With both running (`npm run dev` in one terminal, `func start` in another),
uploading a real `.tf` file in the browser will hit your Function instead
of the mock. Test with `backend/sample_infra/main.tf` — it's deliberately
full of the flaws your rules should catch.

`local.settings.json` is gitignored on purpose (it's how Azure Functions
stores local secrets) — never commit your real API key. Get a free Groq
API key at [console.groq.com](https://console.groq.com/keys) — no credit card needed. Without
it, `/api/chat` still works but only in its offline keyword-matching
fallback mode — fine for a demo with no wifi, not the real experience.

### Local dev with the Static Web Apps CLI (optional, closer to prod)

Instead of running `npm run dev` and `func start` separately with a manual
Vite proxy, the [SWA CLI](https://learn.microsoft.com/en-us/azure/static-web-apps/local-development)
runs both together behind one emulated URL — same routing Azure uses in
production, so it's a good sanity check before deploying:

```bash
npm install -g @azure/static-web-apps-cli
swa start   # reads swa-cli.config.json at the repo root
```

## Environment variables

| Variable            | Required | Used by                          | Notes |
|----------------------|----------|-----------------------------------|-------|
| `GROQ_API_KEY`        | No*      | `backend/chat.py` (`/api/chat`, `/api/narrative`) | Powers the real LLM chat assistant and the manager/engineer narrative (free, via Groq). Without it, both still respond — chat via an offline keyword matcher, narrative via a deterministic template — get a free key at [console.groq.com/keys](https://console.groq.com/keys). |
| `COSMOS_ENDPOINT`    | No*      | `backend/db.py` (scan history, stats) | Cosmos DB account URI, e.g. `https://blueprint-db.documents.azure.com:443/`. Without it, scan history/`/api/stats` silently disable themselves — the core scan still works. |
| `COSMOS_KEY`         | No*      | `backend/db.py`                  | Cosmos DB primary key. |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | No* | Azure Functions runtime (built in — no code) | Ships requests/exceptions/`logging.*()` calls to Application Insights automatically once set. |

\* None of these are required for the core scan/diagram/rules path — that
stays fully local either way. They light up chat, history, and
monitoring respectively.

Locally: set these in `backend/local.settings.json` (copy from
`local.settings.json.example`, gitignored). On Azure: set them as Static
Web App **application settings** (see "Add cloud services" below) — they
are *not* read from `local.settings.json` in production.

## Add cloud services (auth, database, monitoring)

Everything below is optional and additive — the scan/diagram/chatbot
works without any of it. This is what turns it from "a scaffold that
happens to be hosted" into something with real users, real data, and
real observability, using your Azure for Students credit.

### 1. Sign-in (Azure Static Web Apps built-in auth — no setup)

SWA ships pre-configured GitHub (and Microsoft/Twitter/Google/Facebook)
login for free, with **no app registration or client secret needed** —
it's already wired up in this repo:
- `frontend/public/staticwebapp.config.json` restricts `/api/scans*` to
  `"authenticated"` requests.
- `AuthBar.jsx` links to `/.auth/login/github` / `/.auth/logout` — these
  are platform routes SWA serves itself, not something you build.
- `backend/auth.py` reads the identity SWA injects into requests once
  someone's signed in.

Nothing to configure — once deployed, "sign in to save scan history"
just works. (Locally, `/.auth/me` 404s under plain `npm run dev`, so the
app just treats every local session as signed-out — run `swa start`
instead if you want to test the signed-in path locally, see below.)

### 2. Scan history (Cosmos DB, free tier)

```bash
az cosmosdb create \
  --name blueprint-db-<yourname> \
  --resource-group <your-rg> \
  --locations regionName=eastus \
  --enable-free-tier true \
  --capabilities EnableServerless
```

The free tier gives 1000 RU/s + 25GB storage forever, at no cost — the
serverless capability keeps it at effectively $0 for a low-traffic
student project even beyond that. Grab the endpoint and key:

```bash
az cosmosdb show --name blueprint-db-<yourname> --resource-group <your-rg> --query documentEndpoint
az cosmosdb keys list --name blueprint-db-<yourname> --resource-group <your-rg> --query primaryMasterKey
```

Then set both as app settings on your Static Web App (portal:
Configuration → Application settings, or CLI):

```bash
az staticwebapp appsettings set --name <app-name> --setting-names \
  COSMOS_ENDPOINT=<endpoint> COSMOS_KEY=<key>
```

`backend/db.py` creates the `blueprint` database and `scans` container
automatically on first use — nothing to provision by hand beyond the
account itself. Once signed in, every scan auto-saves; the 🕘 button
(bottom-left) opens your history.

### 3. Monitoring (Application Insights)

```bash
az monitor app-insights component create \
  --app blueprint-insights --location eastus --resource-group <your-rg>
az monitor app-insights component show \
  --app blueprint-insights --resource-group <your-rg> --query connectionString
```

Set the result as the `APPLICATIONINSIGHTS_CONNECTION_STRING` app
setting (same `az staticwebapp appsettings set` pattern as above). No
code changes needed — the Azure Functions runtime automatically ships
request/exception telemetry once that setting exists, and every
`logging.info(...)` call already in `function_app.py` (one per scan, one
per chat message) shows up as a queryable trace. In the portal: your
Static Web App → Application Insights (or the App Insights resource
directly) → Logs, e.g. `traces | where message startswith "scan completed"`.

### 4. Local dev with all of this wired up

`func start` alone won't exercise auth (no `/.auth/*` routes) — use the
[SWA CLI](https://learn.microsoft.com/en-us/azure/static-web-apps/local-development)
instead, which emulates the SWA proxy (including a fake sign-in flow) in
front of both:

```bash
npm install -g @azure/static-web-apps-cli
swa start   # reads swa-cli.config.json at the repo root
```
- **Structured output** — an interactive diagram + cost delta a chatbot
  can't produce in a text reply, no matter how good the model.

That's a completely reasonable and honest scope for a student project:
a real static analyzer with a real (but clearly-scoped) LLM assistant
layered on top, not an LLM pretending to do static analysis.
