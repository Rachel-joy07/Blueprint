function Gauge({ score }) {
  // 0-100 risk score drawn as a half-circle arc. Simple, no chart lib needed.
  const radius = 30
  const circumference = Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 60 ? '#FF5D5D' : score >= 30 ? '#FFB454' : '#45D6AE'

  return (
    <div className="relative w-[72px] h-[40px] shrink-0">
      <svg viewBox="0 0 76 42" className="w-full h-full">
        <path
          d="M 8 40 A 30 30 0 0 1 68 40"
          fill="none"
          stroke="#152D48"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M 8 40 A 30 30 0 0 1 68 40"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-end justify-center pb-0.5">
        <span className="font-display text-sm font-semibold tabular-nums" style={{ color }}>
          {score}
        </span>
      </div>
    </div>
  )
}

function Stat({ label, value, sub, accent }) {
  return (
    <div className="flex flex-col gap-1 px-5 border-l border-blueprint-border/70 first:border-l-0 first:pl-0">
      <span className="text-[11px] text-blueprint-line/45">{label}</span>
      <span className={`font-display text-lg font-semibold leading-none tabular-nums ${accent || 'text-blueprint-line'}`}>
        {value}
      </span>
      {sub && <span className="text-[11px] text-blueprint-line/35">{sub}</span>}
    </div>
  )
}

function ViewToggle({ view, onViewChange }) {
  const options = [
    { id: 'diagram', label: 'Diagram' },
    { id: 'code', label: 'Code' },
  ]
  return (
    <div className="relative flex items-center rounded-full border border-blueprint-border bg-blueprint-bg/60 p-0.5 text-[13px]">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onViewChange(opt.id)}
          className={`relative z-10 rounded-full px-3.5 py-1.5 font-medium transition-colors duration-200 ${
            view === opt.id
              ? 'text-blueprint-bg'
              : 'text-blueprint-line/55 hover:text-blueprint-line'
          }`}
        >
          {view === opt.id && (
            <span className="absolute inset-0 -z-10 rounded-full bg-accent transition-all duration-300" />
          )}
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function Logomark() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" fill="none" className="shrink-0">
      <rect width="32" height="32" rx="8" fill="#152D48" />
      <path
        d="M10 23V9h9a4 4 0 0 1 0 8h-6v6z"
        stroke="#5EC8F2"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

export default function StatsBar({ summary, fileName, view, onViewChange, authBar, savedLabel, onAutoFixAll, autoFixAvailable }) {
  const savings = summary.monthlyCostActual - summary.monthlyCostOptimized
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-blueprint-border bg-blueprint-panel/95 backdrop-blur px-6 py-3">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <Logomark />
          <div>
            <div className="font-display text-[15px] font-semibold leading-none text-blueprint-line">
              Blueprint
            </div>
            <div className="font-mono text-[11px] text-blueprint-line/45 mt-0.5">
              {fileName}
              {savedLabel && <span className="text-clean/75"> · {savedLabel}</span>}
            </div>
          </div>
        </div>
        {view && onViewChange && <ViewToggle view={view} onViewChange={onViewChange} />}
        {autoFixAvailable && onAutoFixAll && (
          <button
            onClick={onAutoFixAll}
            className="text-[13px] font-medium px-3.5 py-1.5 rounded-full border border-accent/40 text-accent hover:bg-accent/10 transition-colors"
          >
            Auto-fix all →
          </button>
        )}
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center">
          <Gauge score={summary.riskScore} />
          <Stat label="Resources" value={summary.resourceCount} />
          <Stat label="Security flags" value={summary.riskCount} accent="text-risk" />
          <Stat label="Oversized" value={summary.wasteCount} accent="text-waste" />
          <Stat
            label="Est. monthly cost"
            value={`$${summary.monthlyCostActual.toLocaleString()}`}
            sub={`could be $${summary.monthlyCostOptimized.toLocaleString()}`}
          />
          <Stat label="Potential savings" value={`$${savings.toLocaleString()}/mo`} accent="text-clean" />
        </div>
        {authBar && <div className="border-l border-blueprint-border/70 pl-6">{authBar}</div>}
      </div>
    </div>
  )
}
