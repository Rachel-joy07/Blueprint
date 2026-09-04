import { useState, useEffect } from 'react'

function toScanContext(scan) {
  return {
    fileName: scan.fileName,
    summary: scan.summary,
    nodes: scan.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      label: n.label,
      issue: n.issue
        ? {
            severity: n.issue.severity,
            title: n.issue.title,
            explanation: n.issue.explanation,
            fix: n.issue.fix,
          }
        : null,
    })),
  }
}

export default function NarrativeBanner({ scan }) {
  const [audience, setAudience] = useState('manager')
  const [cache, setCache] = useState({}) // { manager: {text, live}, engineer: {...} }
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (cache[audience]) return
    setLoading(true)
    fetch('/api/narrative', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scan: toScanContext(scan), audience }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setCache((c) => ({ ...c, [audience]: data })))
      .catch(() =>
        setCache((c) => ({
          ...c,
          [audience]: { narrative: "Couldn't generate a summary right now.", live: false },
        }))
      )
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience, scan.fileName])

  const current = cache[audience]

  return (
    <div className="px-6 py-3.5 border-b border-blueprint-border bg-blueprint-panel/60">
      <div className="flex items-start gap-4">
        <div className="relative flex items-center rounded-full border border-blueprint-border bg-blueprint-bg/60 p-0.5 text-[12px] shrink-0 mt-0.5">
          {['manager', 'engineer'].map((a) => (
            <button
              key={a}
              onClick={() => setAudience(a)}
              className={`relative z-10 rounded-full px-3 py-1 font-medium capitalize transition-colors duration-200 ${
                audience === a ? 'text-blueprint-bg' : 'text-blueprint-line/55 hover:text-blueprint-line'
              }`}
            >
              {audience === a && (
                <span className="absolute inset-0 -z-10 rounded-full bg-accent transition-all duration-300" />
              )}
              {a}
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-0">
          {loading && !current ? (
            <div className="h-4 w-3/4 rounded shimmer-bg animate-shimmer" />
          ) : (
            <p className="text-[13px] text-blueprint-line/75 leading-relaxed">
              {current?.narrative}
              {current && !current.live && (
                <span className="text-blueprint-line/35 text-[11px]"> (offline template — set GROQ_API_KEY for live summaries)</span>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
