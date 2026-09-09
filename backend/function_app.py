"""
Azure Functions Python v2 programming model.

Local dev:
    pip install -r requirements.txt --break-system-packages
    func start
    (Function runs on http://localhost:7071, matching vite.config.js proxy)

Deploy:
    This backend is deployed as the "api" component of an Azure Static Web
    App - see the repo root README's Deploy section. For manual/standalone
    deploys you can still run:
        func azure functionapp publish <your-function-app-name>
"""

import azure.functions as func
import json
import logging

from parser import parse_terraform, infer_edges, find_resource_blocks, locate_line, snippet_around
from rules.security_rules import run_security_rules
from rules.cost_rules import run_cost_rules
from chat import get_chat_reply
from auth import get_client_principal
import db

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)


# Rough layout so nodes don't overlap. For a 1-week project, a simple grid
# beats pulling in a full graph-layout library - upgrade to dagre/elkjs
# later if you have time.
def layout_nodes(resources):
    positions = {}
    col_width, row_height = 260, 160
    for i, r in enumerate(resources):
        positions[r["id"]] = {"x": (i % 3) * col_width, "y": (i // 3) * row_height}
    return positions


@app.route(route="scan", methods=["POST"])
def scan(req: func.HttpRequest) -> func.HttpResponse:
    try:
        file = req.files.get("file")
        if not file:
            return func.HttpResponse(
                json.dumps({"error": "No file uploaded"}), status_code=400,
                mimetype="application/json"
            )

        contents = file.read().decode("utf-8")
        resources = parse_terraform(contents)
        edges_raw = infer_edges(resources)
        positions = layout_nodes(resources)

        # Real line numbers: re-scan the raw source (not the parsed tree,
        # which has no line metadata) for each resource's brace-delimited
        # block. See parser.find_resource_blocks() for how.
        blocks = find_resource_blocks(contents)

        nodes = []
        risk_count, waste_count = 0, 0
        cost_actual_total, cost_optimized_total = 0, 0

        for r in resources:
            issue = run_security_rules(r)
            if not issue:
                issue = run_cost_rules(r, resources)

            status = "clean"
            if issue:
                status = issue["severity"]
                if status == "risk":
                    risk_count += 1
                else:
                    waste_count += 1
                    cost_actual_total += issue.get("costActual") or 0
                    cost_optimized_total += issue.get("costOptimized") or 0

                block = blocks.get(r["id"])
                if block:
                    line = locate_line(block, issue.pop("match_hint", None))
                    issue["line"] = line
                    issue["code"] = snippet_around(block, line)
                else:
                    # Shouldn't happen (every parsed resource has a
                    # matching header line) but don't blow up the scan
                    # over a formatting edge case.
                    issue.pop("match_hint", None)
                    issue["line"] = 1
                    issue["code"] = ""

            pos = positions[r["id"]]
            nodes.append({
                "id": r["id"],
                "type": r["type"],
                "label": r["name"],
                "status": status,
                "x": pos["x"],
                "y": pos["y"],
                **({"issue": issue} if issue else {})
            })

        risk_score = min(100, risk_count * 25 + waste_count * 10)

        result = {
            "fileName": file.filename,
            "source": contents,  # powers the source code viewer in the UI
            "summary": {
                "resourceCount": len(resources),
                "riskCount": risk_count,
                "wasteCount": waste_count,
                "monthlyCostActual": round(cost_actual_total, 2),
                "monthlyCostOptimized": round(cost_optimized_total, 2),
                "riskScore": risk_score
            },
            "nodes": nodes,
            "edges": edges_raw
        }

        # Structured logging - if APPLICATIONINSIGHTS_CONNECTION_STRING is
        # set (see README "Monitoring"), the Functions runtime ships this
        # straight to Application Insights automatically, no extra SDK
        # code required. Queryable later as a KQL trace.
        logging.info(
            "scan completed resources=%d riskFlags=%d wasteFlags=%d riskScore=%d",
            len(resources), risk_count, waste_count, risk_score
        )

        # Save to history if the request came from a signed-in user (SWA
        # injects x-ms-client-principal once someone's logged in). Silently
        # a no-op if Cosmos DB isn't configured - saving history is a
        # bonus feature, not a requirement for the core scan to work.
        principal = get_client_principal(req)
        if principal and principal.get("userId"):
            scan_id = db.save_scan(principal["userId"], principal["userDetails"], result)
            result["savedScanId"] = scan_id
            result["user"] = {"userDetails": principal["userDetails"]}
        else:
            result["savedScanId"] = None
            result["user"] = None

        return func.HttpResponse(json.dumps(result), mimetype="application/json")

    except Exception as e:
        logging.exception("Scan failed")
        return func.HttpResponse(
            json.dumps({"error": str(e)}), status_code=500, mimetype="application/json"
        )


@app.route(route="chat", methods=["POST"])
def chat(req: func.HttpRequest) -> func.HttpResponse:
    """
    Powers "Ask Blueprint". Body:
    {
      "message": "why is my VM flagged?",
      "history": [{"role": "user"|"assistant", "content": "..."}, ...],   # optional
      "scan": { fileName, summary, nodes, edges }                        # optional, the
                                                                            # current /api/scan
                                                                            # result, so the
                                                                            # bot can ground
                                                                            # answers in it
    }
    """
    try:
        body = req.get_json()
        message = body.get("message", "")
        if not message:
            return func.HttpResponse(
                json.dumps({"error": "No message provided"}), status_code=400,
                mimetype="application/json"
            )

        history = body.get("history", [])
        scan_context = body.get("scan")

        recommendation, reply, debug_reason = get_chat_reply(message, history, scan_context)

        logging.info(
            "chat message hasScanContext=%s matchedRecommendation=%s",
            bool(scan_context), bool(recommendation)
        )

        result = {"reply": reply, "recommendation": recommendation}
        if debug_reason:
            # Surfaces the real failure reason (missing key vs. an actual
            # exception from the Groq call) directly in the API response -
            # much easier to debug on a deployed backend than digging
            # through logs. Harmless to leave in; it's your own error.
            result["debug"] = debug_reason
        return func.HttpResponse(json.dumps(result), mimetype="application/json")

    except Exception as e:
        logging.exception("Chat failed")
        return func.HttpResponse(
            json.dumps({"error": str(e)}), status_code=500, mimetype="application/json"
        )


@app.route(route="scans", methods=["GET"])
def list_scans(req: func.HttpRequest) -> func.HttpResponse:
    """
    Signed-in users' scan history. `staticwebapp.config.json` also
    restricts this route to authenticated requests at the SWA-proxy
    level - the principal check here is defense-in-depth for the case
    where the Function is hit directly (e.g. `func start` without SWA
    in front of it).
    """
    principal = get_client_principal(req)
    if not principal or not principal.get("userId"):
        return func.HttpResponse(
            json.dumps({"error": "Sign in to view scan history"}), status_code=401,
            mimetype="application/json"
        )
    scans = db.list_scans(principal["userId"])
    return func.HttpResponse(json.dumps(scans), mimetype="application/json")


@app.route(route="scans/{scan_id}", methods=["GET"])
def get_scan_route(req: func.HttpRequest) -> func.HttpResponse:
    principal = get_client_principal(req)
    if not principal or not principal.get("userId"):
        return func.HttpResponse(
            json.dumps({"error": "Sign in to view scan history"}), status_code=401,
            mimetype="application/json"
        )
    scan_id = req.route_params.get("scan_id")
    scan = db.get_scan(principal["userId"], scan_id)
    if not scan:
        return func.HttpResponse(
            json.dumps({"error": "Scan not found"}), status_code=404,
            mimetype="application/json"
        )
    return func.HttpResponse(json.dumps(scan), mimetype="application/json")


@app.route(route="scans/{scan_id}", methods=["DELETE"])
def delete_scan_route(req: func.HttpRequest) -> func.HttpResponse:
    principal = get_client_principal(req)
    if not principal or not principal.get("userId"):
        return func.HttpResponse(
            json.dumps({"error": "Sign in to manage scan history"}), status_code=401,
            mimetype="application/json"
        )
    scan_id = req.route_params.get("scan_id")
    deleted = db.delete_scan(principal["userId"], scan_id)
    return func.HttpResponse(json.dumps({"deleted": deleted}), mimetype="application/json")


@app.route(route="stats", methods=["GET"])
def stats(req: func.HttpRequest) -> func.HttpResponse:
    """Anonymous, aggregate-only numbers across every saved scan - not
    scoped to the caller. Powers the small stats strip on the upload
    screen so the app has some visible sign of life beyond one session."""
    return func.HttpResponse(json.dumps(db.get_stats()), mimetype="application/json")
