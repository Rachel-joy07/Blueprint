"""
Each rule is a plain function: (resource) -> issue dict | None

Keep every rule small and single-purpose. This is what makes the tool
deterministic and trustworthy, unlike asking a chatbot "does this look
insecure?" - you can point at the exact line and exact condition that
tripped.

Add more rules here as you build. ~10-15 solid rules is plenty for a
1-week project; don't try to reimplement all of Checkov.
"""


def check_open_ssh(resource):
    if resource["type"] != "azurerm_network_security_group":
        return None
    for rule in resource["attributes"].get("security_rule", []):
        if (
            str(rule.get("destination_port_range")) == "22"
            and rule.get("source_address_prefix") in ("0.0.0.0/0", "*")
            and rule.get("access", "").lower() == "allow"
        ):
            return {
                "severity": "risk",
                "title": "SSH open to the entire internet",
                "rule_id": "open_ssh",
                "explanation": (
                    "Port 22 (SSH) accepts inbound traffic from any IP address. "
                    "Any host on the internet can attempt to log into this resource."
                ),
                "fix": (
                    'Restrict source_address_prefix to a known CIDR block, '
                    'or route SSH through Azure Bastion instead.'
                ),
                # Tells the line-tracker which source line inside this
                # resource's block to point at - see parser.locate_line().
                "match_hint": ["22"],
            }
    return None


def check_public_blob_access(resource):
    if resource["type"] != "azurerm_storage_account":
        return None
    if resource["attributes"].get("allow_blob_public_access") is True:
        return {
            "severity": "risk",
            "title": "Public blob access enabled",
            "rule_id": "public_blob_access",
            "explanation": (
                "Blob containers in this storage account can be made readable "
                "by anyone on the internet with the URL, no authentication required."
            ),
            "fix": "Set allow_blob_public_access = false. Use SAS tokens or Azure AD auth instead.",
            "match_hint": ["allow_blob_public_access"],
        }
    return None


def check_unencrypted_disk(resource):
    if resource["type"] not in ("azurerm_managed_disk", "azurerm_virtual_machine"):
        return None
    attrs = resource["attributes"]
    if attrs.get("encryption_settings") is None and attrs.get("disk_encryption_set_id") is None:
        return {
            "severity": "risk",
            "title": "Disk has no encryption configuration",
            "rule_id": "unencrypted_disk",
            "explanation": "No encryption_settings or disk_encryption_set_id block was found.",
            "fix": "Attach a disk_encryption_set_id, or confirm platform-managed encryption is sufficient for your compliance needs.",
            # Nothing to point at (this rule fires on an *absent* attribute)
            # - omit match_hint so the line-tracker falls back to the
            # resource's declaration line.
        }
    return None


def check_open_rdp(resource):
    if resource["type"] != "azurerm_network_security_group":
        return None
    for rule in resource["attributes"].get("security_rule", []):
        if (
            str(rule.get("destination_port_range")) == "3389"
            and rule.get("source_address_prefix") in ("0.0.0.0/0", "*")
            and rule.get("access", "").lower() == "allow"
        ):
            return {
                "severity": "risk",
                "title": "RDP open to the entire internet",
                "rule_id": "open_rdp",
                "explanation": "Port 3389 (RDP) accepts inbound traffic from any IP address.",
                "fix": "Restrict source_address_prefix to a known CIDR, or use Azure Bastion.",
                "match_hint": ["3389"],
            }
    return None


SECURITY_RULES = [
    check_open_ssh,
    check_open_rdp,
    check_public_blob_access,
    check_unencrypted_disk,
]


def run_security_rules(resource):
    for rule in SECURITY_RULES:
        result = rule(resource)
        if result:
            return result
    return None
