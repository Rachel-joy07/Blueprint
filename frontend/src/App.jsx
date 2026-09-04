import { useState, useEffect } from 'react'
import StatsBar from './components/StatsBar.jsx'
import DiagramCanvas from './components/DiagramCanvas.jsx'
import CodeViewer from './components/CodeViewer.jsx'
import DetailPanel from './components/DetailPanel.jsx'
import UploadScreen from './components/UploadScreen.jsx'
import FindingsList from './components/FindingsList.jsx'
import ChatPanel from './components/ChatPanel.jsx'
import HistoryPanel from './components/HistoryPanel.jsx'
import AuthBar from './components/AuthBar.jsx'
import AutoFixPanel from './components/AutoFixPanel.jsx'
import NarrativeBanner from './components/NarrativeBanner.jsx'
import { useAuth } from './hooks/useAuth.js'
import { mockScan } from './data/mockScan.js'

function Toast({ message, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 6000)
    return () => clearTimeout(t)
  }, [message, onDismiss])

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[60] animate-rise-in">
      <div className="flex items-center gap-3 rounded-full border border-waste/30 bg-blueprint-panel shadow-float pl-4 pr-2 py-2 text-[13px] text-blueprint-line/85">
        <span className="w-1.5 h-1.5 rounded-full bg-waste shrink-0" />
        {message}
        <button
          onClick={onDismiss}
          className="w-6 h-6 rounded-full flex items-center justify-center text-blueprint-line/40 hover:text-blueprint-line hover:bg-blueprint-grid transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const user = useAuth()
  const [scan, setScan] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [findingsOpen, setFindingsOpen] = useState(true)
  const [view, setView] = useState('diagram') // 'diagram' | 'code'
  const [notice, setNotice] = useState(null)
  const [autofixTargets, setAutofixTargets] = useState(null) // null | [{id, ruleId, label, title}]

  const runScan = async (file) => {
    if (!file) {
      // Sample scan, for demos or when there's no backend running yet
      setScan(mockScan)
      return
    }

    setLoading(true)
    setNotice(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/scan', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Scan failed')
      const data = await res.json()
      setScan(data)
    } catch (err) {
      // Backend not reachable? Fall back to the sample so the demo never
      // dies — but say so, rather than silently swapping in fake data.
      console.error(err)
      setScan(mockScan)
      setNotice("Couldn't reach the scan backend — showing the sample scan instead.")
    } finally {
      setLoading(false)
    }
  }

  const openAutoFixAll = () => {
    if (!scan) return
    const targets = scan.nodes
      .filter((n) => n.issue)
      .map((n) => ({ id: n.id, ruleId: n.issue.rule_id, label: n.label, title: n.issue.title }))
    setAutofixTargets(targets)
  }

  const openAutoFixOne = (node) => {
    setAutofixTargets([
      { id: node.id, ruleId: node.issue.rule_id, label: node.label, title: node.issue.title },
    ])
  }

  // Mounted regardless of whether a scan is loaded, so someone can jump
  // straight into a past scan from the upload screen too.
  const historyPanel = <HistoryPanel user={user} onLoadScan={setScan} />
  const toast = notice && <Toast message={notice} onDismiss={() => setNotice(null)} />

  if (!scan) {
    return (
      <>
        <UploadScreen onScan={runScan} loading={loading} user={user} />
        {historyPanel}
        {toast}
      </>
    )
  }

  const selectedNode = scan.nodes.find((n) => n.id === selectedId) || null
  const savedLabel = scan.savedScanId ? 'saved to your history' : null
  const hasFindings = scan.nodes.some((n) => n.issue)

  return (
    <div className="h-screen flex flex-col">
      <StatsBar
        summary={scan.summary}
        fileName={scan.fileName}
        view={view}
        onViewChange={setView}
        authBar={<AuthBar user={user} />}
        savedLabel={savedLabel}
        autoFixAvailable={hasFindings}
        onAutoFixAll={openAutoFixAll}
      />
      <NarrativeBanner scan={scan} />
      <div className="flex flex-1 min-h-0">
        <FindingsList
          scan={scan}
          selectedId={selectedId}
          onSelect={setSelectedId}
          open={findingsOpen}
          onToggle={() => setFindingsOpen((o) => !o)}
        />
        {view === 'code' ? (
          <CodeViewer scan={scan} selectedId={selectedId} onSelectNode={setSelectedId} />
        ) : (
          <DiagramCanvas scan={scan} onSelectNode={setSelectedId} selectedId={selectedId} />
        )}
        <DetailPanel
          node={selectedNode}
          onClose={() => setSelectedId(null)}
          onAutoFix={openAutoFixOne}
          autoFixAvailable={!!selectedNode?.issue}
        />
      </div>
      <ChatPanel scan={scan} />
      {historyPanel}
      {toast}
      {autofixTargets && (
        <AutoFixPanel scan={scan} targets={autofixTargets} onClose={() => setAutofixTargets(null)} />
      )}
    </div>
  )
}
