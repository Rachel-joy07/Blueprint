"""
Parses a Terraform (.tf) file into a resource list the rule engines and
the frontend graph can both consume.

Install: pip install python-hcl2

For Bicep, there's no equivalent Python parser - your realistic path is
either (a) shell out to `az bicep build` to transpile Bicep -> ARM JSON
first, then parse that JSON, or (b) scope your MVP to Terraform only and
mention Bicep as "future work" in your presentation. Terraform-only is a
perfectly reasonable scope for a 1-week project.
"""

import hcl2
import io
import re


def parse_terraform(file_contents: str) -> list[dict]:
    """
    Returns a list of resources like:
    {
        "id": "azurerm_linux_virtual_machine.app",
        "type": "azurerm_linux_virtual_machine",
        "name": "app",
        "attributes": { ...raw HCL block... }
    }
    """
    parsed = hcl2.load(io.StringIO(file_contents))
    resources = []

    for block in parsed.get("resource", []):
        # block looks like: { "azurerm_linux_virtual_machine": { "app": {...} } }
        for resource_type, named_instances in block.items():
            for name, attributes in named_instances.items():
                resources.append({
                    "id": f"{resource_type}.{name}",
                    "type": resource_type,
                    "name": name,
                    "attributes": attributes
                })

    return resources


def infer_edges(resources: list[dict]) -> list[dict]:
    """
    Very simple relationship inference: if resource A's attributes
    reference resource B's id anywhere in the raw HCL (Terraform
    references look like "${azurerm_subnet.app.id}" or the newer
    "azurerm_subnet.app.id" syntax), draw an edge A -> B.

    This is intentionally simple for a 1-week build. A more thorough
    version would walk the attribute tree recursively instead of just
    stringifying it.
    """
    edges = []
    for resource in resources:
        attrs_str = str(resource["attributes"])
        for other in resources:
            if other["id"] == resource["id"]:
                continue
            if other["id"] in attrs_str or f'{other["type"]}.{other["name"]}' in attrs_str:
                edges.append({"source": other["id"], "target": resource["id"]})

    return edges


_RESOURCE_HEADER_RE = re.compile(
    r'^\s*resource\s+"([A-Za-z0-9_]+)"\s+"([A-Za-z0-9_-]+)"\s*\{'
)


def find_resource_blocks(file_contents: str) -> dict[str, dict]:
    """
    Re-scans the *raw* source text (not the parsed HCL tree) to recover
    real line numbers and source snippets per resource. python-hcl2 parses
    via a grammar that doesn't hand back line metadata, so instead of
    patching the parser we do the simple, robust thing: find each
    `resource "type" "name" {` header line, then walk forward counting
    brace depth until it closes back to zero. That gives us an exact
    [start_line, end_line] span and the exact source text for that block.

    Returns: { "azurerm_linux_virtual_machine.app": {
        "start_line": 27,          # 1-indexed, the "resource ..." line
        "end_line": 33,
        "lines": ["resource \"...\" \"...\" {", "  size = ...", ..., "}"]
    }, ... }

    This intentionally ignores braces inside string literals/comments for
    simplicity - real-world Terraform occasionally has a literal "{" in a
    string, which is a known limitation worth mentioning if asked, but it
    doesn't happen in typical resource bodies.
    """
    lines = file_contents.splitlines()
    blocks = {}
    i = 0
    while i < len(lines):
        match = _RESOURCE_HEADER_RE.match(lines[i])
        if match:
            resource_type, name = match.group(1), match.group(2)
            resource_id = f"{resource_type}.{name}"
            start_line = i + 1  # 1-indexed
            depth = lines[i].count("{") - lines[i].count("}")
            end_idx = i
            while depth > 0 and end_idx + 1 < len(lines):
                end_idx += 1
                depth += lines[end_idx].count("{") - lines[end_idx].count("}")
            blocks[resource_id] = {
                "start_line": start_line,
                "end_line": end_idx + 1,
                "lines": lines[i:end_idx + 1],
            }
            i = end_idx + 1
        else:
            i += 1
    return blocks


def locate_line(block: dict, hints: list[str] | None) -> int:
    """
    Given a resource block (from find_resource_blocks) and a list of
    substrings a rule wants to point at (e.g. ["22", "0.0.0.0/0"] for the
    open-SSH rule, or ["Standard_D64s_v3"] for an oversized VM), finds the
    first line inside the block containing ALL of the hints and returns
    its real 1-indexed line number in the source file. Falls back to the
    block's start line (the `resource "..." "..." {` line) when there's
    no hint, or none of the block's lines match - absence-of-attribute
    rules (e.g. "no encryption block found") have nothing to point at, so
    the resource declaration itself is the most honest thing to highlight.
    """
    if not hints:
        return block["start_line"]
    for offset, line in enumerate(block["lines"]):
        if all(hint in line for hint in hints):
            return block["start_line"] + offset
    return block["start_line"]


def snippet_around(block: dict, line_number: int, context: int = 2) -> str:
    """
    Returns a short source snippet centered on line_number (real file line
    number), context lines of padding on each side, clamped to the
    resource's own block so we never spill into a neighboring resource.
    """
    lo = max(block["start_line"], line_number - context)
    hi = min(block["end_line"], line_number + context)
    start_offset = lo - block["start_line"]
    end_offset = hi - block["start_line"] + 1
    return "\n".join(block["lines"][start_offset:end_offset])
