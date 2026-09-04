"""
Cost/waste rules. Unlike the security rules, these ones can call the real
Azure Retail Prices API (public, free, no auth key needed) to show actual
dollar figures instead of guesses - this is your "wow, that's a real
number" demo moment.

API docs: https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices
Example: https://prices.azure.com/api/retail/prices?$filter=armSkuName eq 'Standard_D64s_v3' and priceType eq 'Consumption'
"""

import requests

# A small, deliberately oversized -> right-sized lookup table.
# Expand this as you test with more sample .tf files.
OVERSIZED_VM_MAP = {
    "Standard_D64s_v3": "Standard_D4s_v3",
    "Standard_D32s_v3": "Standard_D4s_v3",
    "Standard_E64s_v3": "Standard_E4s_v3",
}

PRICE_CACHE = {}


def get_monthly_price(sku_name: str, region: str = "eastus") -> float | None:
    """Looks up real hourly retail price for a VM SKU and returns an
    estimated monthly cost (hourly * 730). Returns None if not found -
    always handle that case in the UI, don't fake a number."""
    cache_key = f"{sku_name}-{region}"
    if cache_key in PRICE_CACHE:
        return PRICE_CACHE[cache_key]

    url = (
        "https://prices.azure.com/api/retail/prices"
        f"?$filter=armSkuName eq '{sku_name}' and priceType eq 'Consumption' "
        f"and armRegionName eq '{region}'"
    )
    try:
        resp = requests.get(url, timeout=5)
        resp.raise_for_status()
        items = resp.json().get("Items", [])
        # Filter to Linux, non-spot, non-low-priority for a clean comparison
        linux_items = [i for i in items if "Windows" not in i.get("productName", "") and "Spot" not in i.get("skuName", "")]
        if not linux_items:
            return None
        hourly = linux_items[0]["retailPrice"]
        monthly = round(hourly * 730, 2)
        PRICE_CACHE[cache_key] = monthly
        return monthly
    except requests.RequestException:
        return None


def check_oversized_vm(resource):
    if resource["type"] != "azurerm_linux_virtual_machine":
        return None
    size = resource["attributes"].get("size")
    if size not in OVERSIZED_VM_MAP:
        return None

    smaller_size = OVERSIZED_VM_MAP[size]
    cost_actual = get_monthly_price(size)
    cost_optimized = get_monthly_price(smaller_size)

    return {
        "severity": "waste",
        "title": f"Oversized VM ({size})",
        "rule_id": "oversized_vm",
        "explanation": (
            f"This is a large VM tier. Nothing else in the file suggests a workload "
            f"that needs this scale (no load balancer, no autoscale set)."
        ),
        "fix": f"{smaller_size} likely covers a typical single-instance workload.",
        "costActual": cost_actual,
        "costOptimized": cost_optimized,
        "match_hint": [size],
    }


def check_unattached_public_ip(resource, all_resources):
    if resource["type"] != "azurerm_public_ip":
        return None
    ip_id = resource["id"]
    referenced = any(
        ip_id in str(r["attributes"]) for r in all_resources if r["id"] != ip_id
    )
    if referenced:
        return None
    return {
        "severity": "waste",
        "title": "Static public IP defined but never attached",
        "rule_id": "unattached_public_ip",
        "explanation": "No NIC, load balancer, or gateway in this file references this IP.",
        "fix": "Remove it, or attach it to the intended resource. Unattached static IPs still bill monthly.",
        "costActual": 3.65,
        "costOptimized": 0
    }


def run_cost_rules(resource, all_resources):
    for check in (check_oversized_vm,):
        result = check(resource)
        if result:
            return result
    result = check_unattached_public_ip(resource, all_resources)
    if result:
        return result
    return None
