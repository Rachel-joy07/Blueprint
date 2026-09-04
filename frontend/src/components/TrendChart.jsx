export default function TrendChart({ values, color, height = 64, formatValue = (v) => v }) {
  if (!values || values.length === 0) {
    return <p className="text-[12px] text-blueprint-line/40 py-4">Not enough scans yet.</p>
  }
  if (values.length === 1) {
    return (
      <p className="text-[12px] text-blueprint-line/40 py-4">
        Only one scan so far ({formatValue(values[0])}) — run a few more to see a trend.
      </p>
    )
  }

  const width = 260
  const padding = 6
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (width - padding * 2)
    const y = height - padding - ((v - min) / range) * (height - padding * 2)
    return [x, y]
  })

  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const areaPath = `${path} L ${points[points.length - 1][0]} ${height} L ${points[0][0]} ${height} Z`

  const first = values[0]
  const last = values[values.length - 1]
  const delta = last - first
  const trendUp = delta > 0

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
        <path d={areaPath} fill={color} opacity="0.08" />
        <path d={path} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === points.length - 1 ? 3 : 2} fill={color} />
        ))}
      </svg>
      <div className="flex items-center justify-between mt-1.5 text-[11px]">
        <span className="text-blueprint-line/40">{formatValue(first)} → {formatValue(last)}</span>
        <span className={delta === 0 ? 'text-blueprint-line/40' : trendUp ? 'text-risk' : 'text-clean'}>
          {delta === 0 ? 'no change' : `${trendUp ? '+' : ''}${formatValue(delta)}`}
        </span>
      </div>
    </div>
  )
}
