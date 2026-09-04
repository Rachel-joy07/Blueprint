import { useEffect, useState } from 'react'

function DiffBlock({ label, text, tone }) {
  const toneClasses =
    tone === 'removed'
      ? 'border-risk/40 bg-risk/[0.06]'
      : tone === 'added'
      ? 'border-clean/40 bg-clean/[0.06]'
      : 'border-blueprint-border bg-blueprint-panel2'
  return (
    <div>
      <div className="text-[10.5px] text-blueprint-line/40 mb-1">{label}</div>
      <pre
        className={`border rounded-md p-2.5 font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre ${toneClasses} ${
          tone === 'removed' ? 'text-risk/80 line-through decoration-risk/40' : tone === 'added' ? 'text-clean/90' : 'text-blueprint-line/80'
        }`}
      >
        {text}
      </pre>
    </div>
  )
}

function ChangeCard({ change, meta }) {
  const isDeletion = change.fixed === null
  return (
    <div className="border border-blueprint-border rounded-lg p-4 bg-blueprint-bg/40">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-clean shrink-0" />
        <span className="text-[13px] font-medium text-blueprint-line/90">{meta?.label || change.id}</span>
        <span className="text-[11px] text-blueprint-line/40 ml-auto">{meta?.title}</span>
      </div>
      {isDeletion ? (
        <>
          <DiffBlock label="Removed entirely" text={change.original} tone="removed" />
          <p className="text-[11.5px] text-blueprint-line/45 mt-2">
            This resource was unused, so the fix is deletion rather than an edit.
          </p>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          <DiffBlock label="Before" text={change.original} tone="removed" />
          <DiffBlock label="After" text={change.fixed} tone="added" />
        </div>
      )}
    </div>
  )
}

export default function AutoFixPanel({ scan, targets, onClose }) {
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!targets || targets.length === 0) return
    setLoading(true)
    setError(null)
    fetch('/api/autofix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: scan.source,
        targets: targets.map((t) => ({ id: t.id, ruleId: t.ruleId })),
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Auto-fix request failed')
        return res.json()
      })
      .then(setResult)
      .catch((err) => {
        console.error(err)
        setError("Couldn't reach the auto-fix backend. Try again once it's running.")
      })
      .finally(() => setLoading(false))
  }, [targets, scan.source])

  if (!targets) return null

  const metaById = Object.fromEntries(targets.map((t) => [t.id, t]))
  const downloadFixed = () => {
    const blob = new Blob([result.fixedSource], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = (scan.fileName || 'main.tf').replace(/\.tf$/, '') + '-fixed.tf'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-rise-in">
      <div className="w-[640px] max-h-[80vh] rounded-xl border border-blueprint-border bg-blueprint-panel shadow-float flex flex-col overflow-hidden animate-scale-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-blueprint-border">
          <div>
            <div className="font-display text-[16px] font-semibold">Auto-fix</div>
            <div className="text-[11.5px] text-blueprint-line/45 mt-0.5">
              Mechanical patches only — nothing here invents a resource or guesses at a value the rule didn't already flag.
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-blueprint-line/40 hover:text-blueprint-line hover:bg-blueprint-grid transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {loading && (
            <div className="flex flex-col gap-2.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 rounded-lg shimmer-bg animate-shimmer" />
              ))}
            </div>
          )}

          {error && <p className="text-[13px] text-risk">{error}</p>}

          {result && (
            <>
              <div className="text-[12.5px] text-blueprint-line/60">
                Fixed <span className="text-clean font-medium">{result.applied.length}</span> of{' '}
                {targets.length} issue(s) automatically.
                {result.skipped.length > 0 && (
                  <span>
                    {' '}
                    {result.skipped.length} needed a manual look — either no safe automatic patch
                    exists, or this resource couldn't be located in the source (this happens on the
                    sample/demo scan; upload a real file to see this fully working).
                  </span>
                )}
              </div>

              {result.changes.map((c) => (
                <ChangeCard key={c.id} change={c} meta={metaById[c.id]} />
              ))}

              {result.applied.length > 0 && (
                <button
                  onClick={downloadFixed}
                  className="self-start mt-1 text-[13px] font-medium px-4 py-2 rounded-md bg-accent text-blueprint-bg hover:brightness-110 transition-all"
                >
                  Download fixed file →
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
