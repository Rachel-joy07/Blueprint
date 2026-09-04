const SEVERITY_ORDER = { risk: 0, waste: 1 }

export default function FindingsList({ scan, selectedId, onSelect, open, onToggle }) {
  const findings = scan.nodes
    .filter((n) => n.issue)
    .sort((a, b) => SEVERITY_ORDER[a.issue.severity] - SEVERITY_ORDER[b.issue.severity])

  return (
    <div
      className={`shrink-0 border-r border-blueprint-border bg-blueprint-panel flex flex-col transition-[width] duration-300 ease-out ${
        open ? 'w-[300px]' : 'w-[46px]'
      }`}
    >
      <button
        onClick={onToggle}
        className="flex items-center justify-between px-3.5 py-3.5 border-b border-blueprint-border text-[13px] font-medium text-blueprint-line/65 hover:text-blueprint-line hover:bg-blueprint-grid/30 transition-colors"
      >
        {open ? (
          <>
            <span>
              Findings <span className="text-blueprint-line/35">({findings.length})</span>
            </span>
            <span className="text-blueprint-line/40 transition-transform">‹</span>
          </>
        ) : (
          <span className="mx-auto text-blueprint-line/40">›</span>
        )}
      </button>

      {open && (
        <div className="overflow-y-auto flex-1">
          {findings.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <div className="text-clean text-2xl mb-2.5">✓</div>
              <p className="text-[13px] text-blueprint-line/50 leading-relaxed">
                No issues found. Every resource passed both rule sets.
              </p>
            </div>
          ) : (
            findings.map((n, i) => {
              const isRisk = n.issue.severity === 'risk'
              const isSelected = n.id === selectedId
              return (
                <button
                  key={n.id}
                  onClick={() => onSelect(n.id)}
                  style={{ animationDelay: `${i * 30}ms` }}
                  className={`w-full animate-rise-in text-left px-4 py-3 border-b border-blueprint-border/50 transition-colors duration-150 ${
                    isSelected
                      ? 'bg-accent/10 border-l-2 border-l-accent'
                      : 'border-l-2 border-l-transparent hover:bg-blueprint-grid/35'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${isRisk ? 'bg-risk' : 'bg-waste'}`} />
                    <span className={`text-[10.5px] font-medium ${isRisk ? 'text-risk' : 'text-waste'}`}>
                      {isRisk ? 'Risk' : 'Waste'}
                    </span>
                  </div>
                  <div className="text-[13px] text-blueprint-line/90 leading-snug">{n.issue.title}</div>
                  <div className="font-mono text-[10.5px] text-blueprint-line/35 mt-1">{n.label}</div>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
