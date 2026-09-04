import { useRef, useState, useEffect } from 'react'
import AuthBar from './AuthBar.jsx'

export default function UploadScreen({ onScan, loading, user }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState(null)
  const [stats, setStats] = useState(null)

  useEffect(() => {
    fetch('/api/stats')
      .then((res) => (res.ok ? res.json() : { available: false }))
      .then((data) => data.available && setStats(data))
      .catch(() => {})
  }, [])

  const handleFile = (file) => {
    if (!file) return
    setFileName(file.name)
    onScan(file)
  }

  return (
    <div className="blueprint-canvas w-full h-full flex flex-col items-center justify-center px-6">
      <div className="absolute top-5 right-6 z-10">
        <AuthBar user={user} />
      </div>

      <div className="w-full max-w-[480px] flex flex-col items-center">
        <div className="text-center mb-9 animate-rise-in">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#152D48" />
              <path
                d="M10 23V9h9a4 4 0 0 1 0 8h-6v6z"
                stroke="#5EC8F2"
                strokeWidth="2"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
            <span className="font-display text-2xl font-semibold tracking-tight">Blueprint</span>
          </div>
          <p className="text-[15px] text-blueprint-line/60 leading-relaxed max-w-[380px] mx-auto">
            Scan Terraform for Azure security and cost issues, mapped onto an
            architecture diagram you can actually read.
          </p>
          {stats && stats.totalScans > 0 && (
            <p className="text-[12.5px] text-blueprint-line/35 mt-3">
              {stats.totalScans} scans run · avg risk score{' '}
              {stats.avgRiskScore != null ? Math.round(stats.avgRiskScore) : '—'}
            </p>
          )}
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            handleFile(e.dataTransfer.files[0])
          }}
          onClick={() => !loading && inputRef.current?.click()}
          className={`w-full animate-scale-in rounded-xl border-2 border-dashed py-14 flex flex-col items-center justify-center transition-all duration-200 ${
            loading
              ? 'border-blueprint-border bg-blueprint-panel/60 cursor-default'
              : dragging
              ? 'border-accent bg-accent/[0.06] shadow-glow-accent cursor-pointer scale-[1.01]'
              : 'border-blueprint-border/80 bg-blueprint-panel/50 hover:border-accent/50 hover:bg-blueprint-panel/70 cursor-pointer'
          }`}
          style={{ animationDelay: '80ms' }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".tf,.bicep,.json"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />

          {loading ? (
            <>
              <div className="w-8 h-8 rounded-full border-2 border-blueprint-border border-t-accent animate-spin mb-4" />
              <p className="text-[14px] text-blueprint-line/70">
                Scanning <span className="font-mono text-blueprint-line/90">{fileName}</span>…
              </p>
            </>
          ) : (
            <>
              <div className="w-11 h-11 rounded-full bg-accent/10 flex items-center justify-center text-xl text-accent mb-4">
                ⇪
              </div>
              <p className="text-[14px] text-blueprint-line/85">
                Drop a .tf or .bicep file, or click to browse
              </p>
              <p className="text-[12.5px] text-blueprint-line/40 mt-1.5">
                Nothing leaves your machine except the parsed structure
              </p>
            </>
          )}
        </div>

        <button
          onClick={() => onScan(null)}
          className="mt-6 text-[13px] font-medium text-blueprint-line/50 hover:text-accent transition-colors animate-rise-in"
          style={{ animationDelay: '160ms' }}
        >
          Or load the sample scan
        </button>
      </div>
    </div>
  )
}
