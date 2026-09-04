import { useEffect, useMemo, useRef } from 'react'

// Very small hand-rolled HCL tokenizer for syntax color, not a real
// grammar - good enough to make Terraform readable without pulling in a
// highlighting library for a 1-week project. Order matters: strings and
// comments are matched first so keywords/numbers inside them don't get
// re-highlighted.
const TOKEN_RE =
  /(#.*$|\/\/.*$)|("(?:[^"\\]|\\.)*")|\b(resource|variable|output|module|provider|data|locals)\b|\b(true|false|null)\b|\b(-?\d+(?:\.\d+)?)\b/gm

function highlightLine(line) {
  const parts = []
  let lastIndex = 0
  let match
  TOKEN_RE.lastIndex = 0
  while ((match = TOKEN_RE.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index))
    }
    const [full, comment, string, keyword, boolNull, number] = match
    if (comment) {
      parts.push(
        <span key={parts.length} className="text-blueprint-line/35 italic">
          {comment}
        </span>
      )
    } else if (string) {
      parts.push(
        <span key={parts.length} className="text-clean/90">
          {string}
        </span>
      )
    } else if (keyword) {
      parts.push(
        <span key={parts.length} className="text-accent font-semibold">
          {keyword}
        </span>
      )
    } else if (boolNull) {
      parts.push(
        <span key={parts.length} className="text-waste">
          {boolNull}
        </span>
      )
    } else if (number) {
      parts.push(
        <span key={parts.length} className="text-waste">
          {number}
        </span>
      )
    }
    lastIndex = match.index + full.length
  }
  if (lastIndex < line.length) parts.push(line.slice(lastIndex))
  return parts.length ? parts : line || ' '
}

// Builds { lineNumber: { severity, nodeId, title } } so the gutter/row can
// be colored and clicking a flagged line can select its node, without the
// viewer needing to know anything about rules itself.
function buildIssueLineMap(nodes) {
  const map = {}
  for (const node of nodes) {
    if (node.issue?.line) {
      map[node.issue.line] = {
        severity: node.issue.severity,
        nodeId: node.id,
        title: node.issue.title,
      }
    }
  }
  return map
}

export default function CodeViewer({ scan, selectedId, onSelectNode }) {
  const containerRef = useRef(null)
  const lines = useMemo(() => (scan.source || '').split('\n'), [scan.source])
  const issueLineMap = useMemo(() => buildIssueLineMap(scan.nodes), [scan.nodes])

  const selectedNode = scan.nodes.find((n) => n.id === selectedId)
  const selectedLine = selectedNode?.issue?.line

  // Keep the viewer scrolled to whatever line is selected elsewhere (e.g.
  // clicking a diagram node or a findings-list row), so the two views of
  // the same scan stay in sync.
  useEffect(() => {
    if (selectedLine && containerRef.current) {
      const el = containerRef.current.querySelector(`[data-line="${selectedLine}"]`)
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [selectedLine])

  if (!scan.source) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 blueprint-canvas">
        <div className="w-10 h-10 rounded-full border border-blueprint-border flex items-center justify-center text-blueprint-line/30">
          ⌗
        </div>
        <p className="text-[13px] text-blueprint-line/45 max-w-[260px] text-center leading-relaxed">
          No source available for this scan — re-run against the live backend to see it.
        </p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-auto bg-blueprint-bg">
      <div className="font-mono text-[12px] leading-[1.6] min-w-max">
        {lines.map((line, idx) => {
          const lineNumber = idx + 1
          const flagged = issueLineMap[lineNumber]
          const isSelected = lineNumber === selectedLine
          return (
            <div
              key={lineNumber}
              data-line={lineNumber}
              onClick={() => flagged && onSelectNode(flagged.nodeId)}
              title={flagged ? flagged.title : undefined}
              className={`flex transition-colors duration-150 ${flagged ? 'cursor-pointer' : ''} ${
                isSelected
                  ? 'bg-accent/10'
                  : flagged
                  ? flagged.severity === 'risk'
                    ? 'bg-risk/10 hover:bg-risk/15'
                    : 'bg-waste/10 hover:bg-waste/15'
                  : 'hover:bg-blueprint-grid/20'
              }`}
            >
              <span
                className={`select-none w-12 shrink-0 text-right pr-3 border-r ${
                  isSelected
                    ? 'border-accent text-accent'
                    : flagged
                    ? flagged.severity === 'risk'
                      ? 'border-risk/40 text-risk/80'
                      : 'border-waste/40 text-waste/80'
                    : 'border-blueprint-border text-blueprint-line/25'
                }`}
              >
                {lineNumber}
              </span>
              <span className="pl-3 pr-6 whitespace-pre text-blueprint-line/90">
                {flagged && (
                  <span className={flagged.severity === 'risk' ? 'text-risk' : 'text-waste'}>
                    ▎
                  </span>
                )}
                {highlightLine(line)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
