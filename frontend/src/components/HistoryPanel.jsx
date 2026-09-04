import { useState, useEffect, useCallback } from 'react'
import TrendChart from './TrendChart.jsx'

export default function HistoryPanel({ user, onLoadScan }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('list') // 'list' | 'trends'
  const [scans, setScans] = useState([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(() => {
    if (!user) return
    setLoading(true)
    fetch('/api/scans')
      .then((res) => (res.ok ? res.json() : []))
      .then(setScans)
      .catch(() => setScans([]))
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    if (open) refresh()
  }, [open, refresh])

  const load = async (id) => {
    const res = await fetch(`/api/scans/${id}`)
    if (!res.ok) return
    const full = await res.json()
    onLoadScan({
      fileName: full.fileName,
      source: full.source,
      summary: full.summary,
      nodes: full.nodes,
      edges: full.edges,
    })
    setOpen(false)
  }

  const remove = async (id, e) => {
    e.stopPropagation()
    await fetch(`/api/scans/${id}`, { method: 'DELETE' })
    setScans((s) => s.filter((sc) => sc.id !== id))
  }

  if (!user) return null // no point showing a history button to someone who can't have any

  return (
    <div className="fixed bottom-5 left-5 z-50">
      {open && (
        <div className="mb-3 w-[320px] max-h-[460px] rounded-xl border border-blueprint-border bg-blueprint-panel shadow-float flex flex-col overflow-hidden animate-scale-in origin-bottom-left">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-blueprint-border">
            <span className="font-display text-[15px] font-semibold">Your scans</span>
            <button
              onClick={() => setOpen(false)}
              className="w-6 h-6 rounded-full flex items-center justify-center text-blueprint-line/40 hover:text-blueprint-line hover:bg-blueprint-grid transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="flex items-center gap-1 px-4 pt-3">
            {[
              { id: 'list', label: 'History' },
              { id: 'trends', label: 'Trends' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`text-[12px] font-medium px-3 py-1.5 rounded-md transition-colors ${
                  tab === t.id ? 'bg-accent/15 text-accent' : 'text-blueprint-line/45 hover:text-blueprint-line'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {tab === 'trends' ? (
              <div className="p-4 flex flex-col gap-5">
                {scans.length < 2 ? (
                  <p className="text-[13px] text-blueprint-line/45 leading-relaxed">
                    Run a few more scans to see how your risk score and cost trend over time.
                  </p>
                ) : (
                  <>
                    <div>
                      <div className="text-[11px] text-blueprint-line/45 mb-2">Risk score</div>
                      <TrendChart
                        values={[...scans].reverse().map((s) => s.summary?.riskScore ?? 0)}
                        color="#FF5D5D"
                      />
                    </div>
                    <div>
                      <div className="text-[11px] text-blueprint-line/45 mb-2">Est. monthly cost</div>
                      <TrendChart
                        values={[...scans].reverse().map((s) => s.summary?.monthlyCostActual ?? 0)}
                        color="#FFB454"
                        formatValue={(v) => `$${Math.round(v)}`}
                      />
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                {loading && (
                  <div className="p-4 flex flex-col gap-2.5">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-10 rounded-md shimmer-bg animate-shimmer" />
                    ))}
                  </div>
                )}
                {!loading && scans.length === 0 && (
                  <p className="p-5 text-[13px] text-blueprint-line/45 leading-relaxed">
                    No saved scans yet — run one and it'll show up here.
                  </p>
                )}
                {scans.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => load(s.id)}
                    className="group px-4 py-3 border-b border-blueprint-border/50 hover:bg-blueprint-grid/35 cursor-pointer flex items-center justify-between gap-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-[12.5px] text-blueprint-line/85 truncate">
                        {s.fileName}
                      </div>
                      <div className="text-[11px] text-blueprint-line/40 mt-0.5">
                        {new Date(s.uploadedAt).toLocaleString()} · risk {s.summary?.riskScore ?? '—'}
                      </div>
                    </div>
                    <button
                      onClick={(e) => remove(s.id, e)}
                      className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-blueprint-line/0 group-hover:text-blueprint-line/35 hover:!text-risk hover:!bg-risk/10 transition-colors"
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="w-12 h-12 rounded-full bg-blueprint-panel border border-blueprint-border text-blueprint-line/80 flex items-center justify-center text-lg shadow-float hover:-translate-y-0.5 hover:border-accent/50 hover:text-accent active:translate-y-0 transition-all duration-200"
        title="Your scan history"
      >
        🕘
      </button>
    </div>
  )
}
