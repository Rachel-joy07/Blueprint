export default function DetailPanel({ node, onClose, onAutoFix, autoFixAvailable }) {
  if (!node) {
    return (
      <div className="w-[360px] shrink-0 border-l border-blueprint-border bg-blueprint-panel/50 p-6 flex flex-col items-center justify-center text-center">
        <div className="w-11 h-11 rounded-full border border-blueprint-border flex items-center justify-center text-lg text-blueprint-line/30 mb-3.5">
          ◇
        </div>
        <p className="text-[13px] text-blueprint-line/45 leading-relaxed max-w-[220px]">
          Select a resource to inspect it. Red-bordered nodes are security risks,
          amber-bordered nodes are oversized or wasteful.
        </p>
      </div>
    )
  }

  const issue = node.issue
  const isRisk = issue?.severity === 'risk'

  return (
    <div key={node.id} className="w-[360px] shrink-0 border-l border-blueprint-border bg-blueprint-panel overflow-y-auto animate-rise-in">
      <div className="flex items-start justify-between px-5 pt-5 pb-3.5 border-b border-blueprint-border">
        <div>
          <div className="font-mono text-[11px] text-blueprint-line/45">{node.type}</div>
          <div className="font-display text-[17px] font-semibold mt-0.5">{node.label}</div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-blueprint-line/40 hover:text-blueprint-line hover:bg-blueprint-grid transition-colors"
        >
          ✕
        </button>
      </div>

      {!issue ? (
        <div className="px-5 py-8">
          <div className="inline-flex items-center gap-2 text-clean text-[13px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-clean" /> No issues found
          </div>
          <p className="mt-2.5 text-sm text-blueprint-line/55 leading-relaxed">
            This resource passed both the security and cost rule sets.
          </p>
        </div>
      ) : (
        <div className="px-5 py-5 flex flex-col gap-5">
          <div>
            <span
              className={`inline-block text-[11px] font-medium px-2.5 py-1 rounded-full ${
                isRisk ? 'bg-risk/15 text-risk' : 'bg-waste/15 text-waste'
              }`}
            >
              {isRisk ? 'Security risk' : 'Cost / waste'}
            </span>
            <h3 className="font-display text-lg font-semibold mt-2.5 leading-snug">{issue.title}</h3>
          </div>

          {issue.compliance && issue.compliance.length > 0 && (
            <div>
              <div className="text-[11px] text-blueprint-line/45 mb-1.5">Compliance impact</div>
              <div className="flex flex-wrap gap-1.5">
                {issue.compliance.map((c, i) => (
                  <span
                    key={i}
                    title={c.description}
                    className="inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-1 rounded-md border border-blueprint-border bg-blueprint-panel2 text-blueprint-line/70 cursor-help"
                  >
                    <span className="text-blueprint-line/40">{c.framework}</span>
                    <span className="text-accent">{c.control}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-[11px] text-blueprint-line/45 mb-1.5">
              main.tf — line {issue.line}
            </div>
            <pre className="bg-blueprint-panel2 border border-blueprint-border rounded-md p-3 font-mono text-[11.5px] leading-relaxed text-blueprint-line/90 overflow-x-auto whitespace-pre">
{issue.code}
            </pre>
          </div>

          <div>
            <div className="text-[11px] text-blueprint-line/45 mb-1.5">Why it matters</div>
            <p className="text-sm text-blueprint-line/75 leading-relaxed">{issue.explanation}</p>
          </div>

          <div>
            <div className="text-[11px] text-clean/85 mb-1.5">Suggested fix</div>
            <p className="text-sm text-blueprint-line/75 leading-relaxed border-l-2 border-clean/60 pl-3">
              {issue.fix}
            </p>
            {autoFixAvailable && onAutoFix && (
              <button
                onClick={() => onAutoFix(node)}
                className="mt-3 text-[12.5px] font-medium px-3 py-1.5 rounded-md bg-accent/15 text-accent hover:bg-accent/25 transition-colors"
              >
                Auto-fix this →
              </button>
            )}
          </div>

          {issue.costActual != null && (
            <div>
              <div className="text-[11px] text-blueprint-line/45 mb-2.5">Monthly cost</div>
              <div className="flex-1">
                <div className="flex justify-between text-[13px] mb-1.5">
                  <span className="text-blueprint-line/55">Current</span>
                  <span className="text-waste font-medium">${issue.costActual}</span>
                </div>
                <div className="h-1.5 bg-blueprint-panel2 rounded-full overflow-hidden">
                  <div className="h-full bg-waste rounded-full transition-all duration-700 ease-out" style={{ width: '100%' }} />
                </div>
              </div>
              <div className="flex-1 mt-3">
                <div className="flex justify-between text-[13px] mb-1.5">
                  <span className="text-blueprint-line/55">Optimized</span>
                  <span className="text-clean font-medium">${issue.costOptimized}</span>
                </div>
                <div className="h-1.5 bg-blueprint-panel2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-clean rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${(issue.costOptimized / issue.costActual) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
