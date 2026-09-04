import { useState, useRef, useEffect } from 'react'
import { matchRecommendation } from '../data/recommendations.js'

function SuggestionCard({ rec }) {
  return (
    <div className="border border-blueprint-border rounded-lg bg-blueprint-panel2 p-3.5 mt-1.5 animate-scale-in origin-top-left">
      <div className="font-mono text-[10.5px] text-accent mb-1">{rec.suggestion}</div>
      <div className="font-display text-[14px] font-semibold mb-1.5">{rec.title}</div>
      <p className="text-[12.5px] text-blueprint-line/65 leading-relaxed mb-2.5">{rec.reasoning}</p>
      <pre className="bg-blueprint-bg border border-blueprint-border rounded-md p-2.5 font-mono text-[10.5px] leading-relaxed text-blueprint-line/85 overflow-x-auto whitespace-pre mb-2.5">
{rec.snippet}
      </pre>
      <div className="font-mono text-[10.5px] text-clean">est. {rec.estCost}</div>
    </div>
  )
}

// Trims the current scan down to what the chatbot actually needs to
// answer grounded questions ("why is my VM flagged?") without shipping
// full diagram layout/positioning data over the wire on every message.
function toScanContext(scan) {
  if (!scan) return null
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

function TypingDots() {
  return (
    <div className="self-start flex items-center gap-1 px-3.5 py-3 rounded-2xl rounded-bl-sm bg-blueprint-grid/60">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-blueprint-line/40 animate-pulse-ring"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}

export default function ChatPanel({ scan }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Ask me anything about Azure cost/security config, or about this scan specifically — e.g. \"why is my VM flagged?\" or \"I want a cheap database\".",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open, loading])

  const send = async () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text }])
    setLoading(true)

    // Real back-and-forth: send the running conversation so far as
    // {role, content} pairs, the way the Anthropic API expects it.
    const history = messages
      .filter((m) => m.text)
      .map((m) => ({ role: m.role, content: m.text }))

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history,
          scan: toScanContext(scan),
        }),
      })
      if (!res.ok) throw new Error('backend not available')
      const data = await res.json()
      setMessages((m) => [...m, { role: 'assistant', rec: data.recommendation, text: data.reply }])
    } catch {
      // Backend not wired up (or offline during the demo) -> local
      // keyword fallback, still useful, keeps the demo alive. This is a
      // degraded mode, not the primary experience.
      const rec = matchRecommendation(text)
      setMessages((m) => [
        ...m,
        rec
          ? {
              role: 'assistant',
              rec,
              text: "(offline fallback — backend unreachable) Here's a fit for that:",
            }
          : {
              role: 'assistant',
              text: "I can't reach the chat backend right now. Try something like \"cheap database\", \"small VM\", or \"secure storage\" for an offline match.",
            },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 w-[356px] h-[460px] rounded-2xl border border-blueprint-border bg-blueprint-panel shadow-float flex flex-col overflow-hidden animate-scale-in origin-bottom-right">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-blueprint-border bg-blueprint-panel2/40">
            <span className="flex items-center gap-2 font-display text-[15px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-clean" />
              Ask Blueprint
            </span>
            <button
              onClick={() => setOpen(false)}
              className="w-6 h-6 rounded-full flex items-center justify-center text-blueprint-line/40 hover:text-blueprint-line hover:bg-blueprint-grid transition-colors"
            >
              ✕
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`animate-msg-in ${m.role === 'user' ? 'self-end max-w-[85%]' : 'self-start max-w-[92%]'}`}
              >
                {m.text && (
                  <div
                    className={`text-[13px] px-3.5 py-2.5 leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-accent text-blueprint-bg font-medium rounded-2xl rounded-br-sm'
                        : 'bg-blueprint-grid/60 text-blueprint-line/90 rounded-2xl rounded-bl-sm'
                    }`}
                  >
                    {m.text}
                  </div>
                )}
                {m.rec && <SuggestionCard rec={m.rec} />}
              </div>
            ))}
            {loading && <TypingDots />}
          </div>

          <div className="flex items-center gap-2 px-3 py-3 border-t border-blueprint-border">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Why is my VM flagged?"
              className="flex-1 bg-blueprint-panel2 border border-blueprint-border rounded-full px-4 py-2.5 text-[13px] text-blueprint-line placeholder:text-blueprint-line/30 outline-none transition-colors focus:border-accent"
            />
            <button
              onClick={send}
              disabled={!input.trim()}
              className="w-9 h-9 shrink-0 rounded-full bg-accent text-blueprint-bg flex items-center justify-center transition-all duration-150 hover:brightness-110 active:scale-90 disabled:opacity-30 disabled:pointer-events-none"
              title="Send"
            >
              ↑
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="w-14 h-14 rounded-full bg-accent text-blueprint-bg flex items-center justify-center text-2xl shadow-float hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-95 transition-all duration-200"
      >
        {open ? '✕' : '◈'}
      </button>
    </div>
  )
}
