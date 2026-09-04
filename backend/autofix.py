"""
Each entry in AUTOFIX maps a rule_id to a function:
    (block_text: str, target: dict) -> str | None

- Returns a new block_text -> that's the patch.
- Returns "" -> caller treats this as "delete the whole block" (used for
  the unattached-IP rule, where the real fix is removal, not editing).
- Returns None -> no safe automatic fix exists for this instance; the
  caller reports it back as "skipped" rather than guessing.

Deliberately conservative: every patch here is a mechanical, reversible
text substitution on values already flagged by the corresponding rule -
never anything that invents a new resource or changes something the
rule didn't actually flag. That's what makes "auto-fix" safe to run
against a real file instead of just a demo trick.
"""

from rules.cost_rules import OVERSIZED_VM_MAP


def _replace_value_on_matching_line(block_text: str, predicate, new_value: str, comment: str = "") -> str | None:
    lines = block_text.split("\n")
    for i, line in enumerate(lines):
        if predicate(line):
            key = line.split("=")[0].rstrip()
            suffix = f"  # {comment}" if comment else ""
            lines[i] = f"{key} = {new_value}{suffix}"
            return "\n".join(lines)
    return None


def fix_open_port(block_text: str, target: dict) -> str | None:
    """Shared by open_ssh and open_rdp - restricts source_address_prefix
    away from 0.0.0.0/0 or a bare wildcard to a placeholder CIDR the user
    still needs to fill in with their real network range."""
    return _replace_value_on_matching_line(
        block_text,
        lambda line: "source_address_prefix" in line and ("0.0.0.0/0" in line or '"*"' in line),
        '"203.0.113.0/24"',
        comment="TODO: replace with your real office/VPN CIDR",
    )


def fix_public_blob_access(block_text: str, target: dict) -> str | None:
    return _replace_value_on_matching_line(
        block_text,
        lambda line: "allow_blob_public_access" in line,
        "false",
    )


def fix_oversized_vm(block_text: str, target: dict) -> str | None:
    lines = block_text.split("\n")
    for i, line in enumerate(lines):
        for big, small in OVERSIZED_VM_MAP.items():
            if f'"{big}"' in line and "size" in line:
                key = line.split("=")[0].rstrip()
                lines[i] = f'{key} = "{small}"'
                return "\n".join(lines)
    return None


def fix_unattached_public_ip(block_text: str, target: dict) -> str:
    # The correct fix is removing the resource entirely, not editing a
    # value inside it - signaled to the caller with an empty string.
    return ""


AUTOFIX = {
    "open_ssh": fix_open_port,
    "open_rdp": fix_open_port,
    "public_blob_access": fix_public_blob_access,
    "oversized_vm": fix_oversized_vm,
    "unattached_public_ip": fix_unattached_public_ip,
    # "unencrypted_disk" intentionally has no entry: a real fix means
    # attaching a disk_encryption_set_id that references a key vault
    # resource which doesn't exist in the file - inventing one would be
    # actively unsafe. Left as a manual fix, and reported as "skipped".
}


def get_patch(rule_id: str | None):
    if not rule_id:
        return None
    return AUTOFIX.get(rule_id)
