"""
Thin wrapper around Azure Cosmos DB (NoSQL API) - persists each signed-in
user's scan history and powers the small cross-user stats strip in the
UI. Cosmos DB's free tier (any Azure subscription, including Azure for
Students) gives 1000 RU/s + 25GB storage forever at no cost - plenty for
a student project.

Deliberately lazy + fail-soft: if COSMOS_ENDPOINT/COSMOS_KEY aren't set
(or the SDK call fails), every function here returns None/[]/a
"unavailable" marker instead of raising. That means the core scan/chat
features keep working with zero database configured - history and stats
are additive, not a hard dependency.
"""

import os
import uuid
import datetime
import logging

_container = None
_init_attempted = False

DATABASE_NAME = "blueprint"
CONTAINER_NAME = "scans"


def _get_container():
    global _container, _init_attempted
    if _container is not None or _init_attempted:
        return _container
    _init_attempted = True

    endpoint = os.environ.get("COSMOS_ENDPOINT")
    key = os.environ.get("COSMOS_KEY")
    if not endpoint or not key:
        return None

    try:
        from azure.cosmos import CosmosClient, PartitionKey
        client = CosmosClient(endpoint, credential=key)
        db = client.create_database_if_not_exists(DATABASE_NAME)
        _container = db.create_container_if_not_exists(
            id=CONTAINER_NAME,
            partition_key=PartitionKey(path="/userId"),
            offer_throughput=400,
        )
        return _container
    except Exception:
        logging.exception("Cosmos DB init failed - scan history/stats disabled")
        return None


def save_scan(user_id: str, user_details: str, scan_result: dict) -> str | None:
    container = _get_container()
    if container is None:
        return None
    scan_id = str(uuid.uuid4())
    item = {
        "id": scan_id,
        "userId": user_id,
        "userDetails": user_details,
        "fileName": scan_result.get("fileName"),
        "uploadedAt": datetime.datetime.utcnow().isoformat() + "Z",
        "summary": scan_result.get("summary"),
        "nodes": scan_result.get("nodes"),
        "edges": scan_result.get("edges"),
        "source": scan_result.get("source"),
    }
    try:
        container.create_item(item)
        return scan_id
    except Exception:
        logging.exception("Failed to save scan to Cosmos DB")
        return None


def list_scans(user_id: str) -> list[dict]:
    container = _get_container()
    if container is None:
        return []
    try:
        items = container.query_items(
            query=(
                "SELECT c.id, c.fileName, c.uploadedAt, c.summary FROM c "
                "WHERE c.userId = @userId ORDER BY c.uploadedAt DESC"
            ),
            parameters=[{"name": "@userId", "value": user_id}],
            partition_key=user_id,
        )
        return list(items)
    except Exception:
        logging.exception("Failed to list scans from Cosmos DB")
        return []


def get_scan(user_id: str, scan_id: str) -> dict | None:
    container = _get_container()
    if container is None:
        return None
    try:
        return container.read_item(item=scan_id, partition_key=user_id)
    except Exception:
        return None


def delete_scan(user_id: str, scan_id: str) -> bool:
    container = _get_container()
    if container is None:
        return False
    try:
        container.delete_item(item=scan_id, partition_key=user_id)
        return True
    except Exception:
        return False


def get_stats() -> dict:
    """
    Anonymized, aggregate-only numbers across ALL saved scans (every
    user, not just the caller) - powers the "N scans run" strip on the
    upload screen. A cross-partition query is fine at this scale; if
    this ever needs to run at real scale, precompute it on a timer
    instead of querying live on every page load.
    """
    container = _get_container()
    if container is None:
        return {"available": False}
    try:
        results = list(container.query_items(
            query=(
                "SELECT COUNT(1) AS totalScans, "
                "AVG(c.summary.riskScore) AS avgRiskScore, "
                "SUM(c.summary.riskCount) AS totalRiskFlags, "
                "SUM(c.summary.wasteCount) AS totalWasteFlags "
                "FROM c"
            ),
            enable_cross_partition_query=True,
        ))
        stats = dict(results[0]) if results else {}
        stats["available"] = True
        return stats
    except Exception:
        logging.exception("Failed to compute stats from Cosmos DB")
        return {"available": False}
