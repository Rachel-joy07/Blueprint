"""
Maps each rule_id to the real compliance frameworks/controls it relates
to. This is what turns "here's a red dot" into "here's why a company
would actually care" - a security team doesn't think in terms of your
rule names, they think in terms of "does this violate our SOC 2 audit"
or "is this a PCI-DSS finding."

Honesty note for your presentation: these mappings are illustrative,
written by hand against the public control text of each framework - this
is NOT a certified/audited compliance mapping (that's a real, expensive
service real vendors sell). Say that plainly if asked; it's still a
genuinely useful and accurate way to categorize the *kind* of issue each
rule catches, which is the actual value here.
"""

COMPLIANCE_MAP = {
    "open_ssh": [
        {
            "framework": "CIS Azure Benchmark",
            "control": "6.2",
            "description": "Ensure SSH access is restricted from the internet",
        },
        {
            "framework": "PCI-DSS",
            "control": "1.2.1",
            "description": "Restrict inbound traffic to only what's necessary",
        },
        {
            "framework": "SOC 2",
            "control": "CC6.6",
            "description": "Logical access is restricted to authorized users",
        },
    ],
    "open_rdp": [
        {
            "framework": "CIS Azure Benchmark",
            "control": "6.1",
            "description": "Ensure RDP access is restricted from the internet",
        },
        {
            "framework": "PCI-DSS",
            "control": "1.2.1",
            "description": "Restrict inbound traffic to only what's necessary",
        },
    ],
    "public_blob_access": [
        {
            "framework": "CIS Azure Benchmark",
            "control": "3.7",
            "description": "Ensure default network access rule is set to deny",
        },
        {
            "framework": "SOC 2",
            "control": "CC6.1",
            "description": "Logical access to protected information is restricted",
        },
        {
            "framework": "HIPAA",
            "control": "§164.312(a)(1)",
            "description": "Access control over systems holding ePHI",
        },
    ],
    "unencrypted_disk": [
        {
            "framework": "CIS Azure Benchmark",
            "control": "7.2",
            "description": "Ensure disk encryption is enabled",
        },
        {
            "framework": "HIPAA",
            "control": "§164.312(a)(2)(iv)",
            "description": "Encryption of electronic protected health information",
        },
    ],
    "oversized_vm": [
        {
            "framework": "Azure Well-Architected Framework",
            "control": "Cost Optimization",
            "description": "Right-size resources to match actual workload demand",
        },
    ],
    "unattached_public_ip": [
        {
            "framework": "Azure Well-Architected Framework",
            "control": "Cost Optimization",
            "description": "Eliminate unused or orphaned resources",
        },
    ],
}


def get_compliance_tags(rule_id: str | None) -> list[dict]:
    if not rule_id:
        return []
    return COMPLIANCE_MAP.get(rule_id, [])
