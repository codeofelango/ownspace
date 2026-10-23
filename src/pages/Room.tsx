import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Mic, MicOff, Video, VideoOff, MonitorUp, Hand, Smile, MoreVertical, PhoneOff,
  Info, Users, MessageSquare, Shapes, Lock, X, Send, Copy, Check,
} from 'lucide-react'
import VideoTile from '../components/VideoTile'
import ControlButton from '../components/ControlButton'
import Avatar from '../components/Avatar'
import { useMedia } from '../lib/useMedia'
import { participantsSeed, type Participant } from '../lib/meeting'

type Panel = 'info' | 'people' | 'chat' | 'activities' | null
type Msg = { id: number; from: string; text: string; at: string }

const stamp = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export default function Room() {
  const { code = '' } = useParams()
  const nav = useNavigate()
  const prefs = (useLocation().state as { cam?: boolean; mic?: boolean } | null) ?? {}
  const { stream, cam, mic, toggleCam, toggleMic } = useMedia({ cam: prefs.cam ?? true, mic: prefs.mic ?? true })

  const [panel, setPanel] = useState<Panel>(null)
  const [hand, setHand] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [others, setOthers] = useState<Participant[]>([])
  const [speaking, setSpeaking] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState(false)
  const [clock, setClock] = useState(() => new Date())

  // Simulate participants arriving and taking turns speaking (no signalling server yet).
  useEffect(() => {
    const timers = participantsSeed.map((p, i) => setTimeout(() => setOthers(o => [...o, p]), 2500 * (i + 1)))
    return () => timers.forEach(clearTimeout)
  }, [])
  useEffect(() => {
    if (!others.length) return
    const t = setInterval(() => setSpeaking(others[Math.floor(Math.random() * others.length)].id), 4000)
    return () => clearInterval(t)
  }, [others])
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 15_000)
    return () => clearInterval(t)
  }, [])

  const everyone = useMemo(
    () => [{ id: 'me', name: 'You', color: '#6d4aff', micOn: mic }, ...others],
    [others, mic],
  )

  const link = `${location.origin}/${code}`
  const copy = async () => {
    try { await navigator.clipboard.writeText(link) } catch { /* clipboard blocked */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  const send = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    setMsgs(m => [...m, { id: Date.now(), from: 'You', text: draft.trim(), at: stamp() }])
    setDraft('')
  }
  const leave = () => nav('/')

  const cols = everyone.length <= 1 ? 1 : everyone.length <= 4 ? 2 : 3
  const toggle = (p: Panel) => setPanel(cur => (cur === p ? null : p))

  return (
    <div className="flex h-full flex-col bg-room text-white">
      <div className="flex min-h-0 flex-1">
        <main className="flex min-h-0 flex-1 flex-col p-4">
          {sharing && (
            <div className="mb-3 flex items-center justify-between rounded-lg bg-brand/20 px-4 py-2 text-sm">
              <span>You are sharing your screen with the space</span>
              <button className="font-medium text-blue-300 hover:underline" onClick={() => setSharing(false)}>Stop presenting</button>
            </div>
          )}
          <div
            className="grid min-h-0 flex-1 gap-3"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: 'minmax(0, 1fr)' }}
          >
            <VideoTile name="You" color="#6d4aff" stream={stream} camOn={cam} micOn={mic} mirror className="fade-in min-h-[160px]" />
            {others.map(p => (
              <VideoTile key={p.id} name={p.name} color={p.color} micOn={p.micOn} speaking={speaking === p.id} className="fade-in min-h-[160px]" />
            ))}
          </div>
        </main>

        {panel && (
          <aside className="fade-in m-4 ml-0 flex w-[360px] shrink-0 flex-col rounded-2xl bg-white text-ink shadow-xl">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-lg font-medium">
                {panel === 'info' && 'Space details'}
                {panel === 'people' && `People (${everyone.length})`}
                {panel === 'chat' && 'Room chat'}
                {panel === 'activities' && 'Activities'}
              </h2>
              <button aria-label="Close panel" onClick={() => setPanel(null)} className="rounded-full p-2 hover:bg-surface-2"><X size={20} /></button>
            </div>

            {panel === 'info' && (
              <div className="px-5 text-sm text-muted">
                <p className="mb-3 text-ink">Invite link</p>
                <p className="break-all font-mono text-xs">{link}</p>
                <button onClick={copy} className="mt-4 flex items-center gap-2 font-medium text-brand hover:underline">
                  {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy invite link'}
                </button>
              </div>
            )}

            {panel === 'people' && (
              <ul className="flex-1 overflow-y-auto px-3">
                {everyone.map(p => (
                  <li key={p.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
                    <Avatar name={p.name} color={p.color} size={36} />
                    <span className="flex-1 text-sm">{p.name}{p.id === 'me' && ' (You)'}</span>
                    {p.micOn ? <Mic size={18} className="text-muted" /> : <MicOff size={18} className="text-danger" />}
                  </li>
                ))}
              </ul>
            )}

            {panel === 'chat' && (
              <>
                <div className="mx-5 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
                  Messages stay inside this space and vanish when it ends.
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                  {msgs.map(m => (
                    <div key={m.id} className="text-sm">
                      <div className="flex items-baseline gap-2"><span className="font-medium">{m.from}</span><span className="text-xs text-muted">{m.at}</span></div>
                      <p className="text-ink">{m.text}</p>
                    </div>
                  ))}
                </div>
                <form onSubmit={send} className="m-4 flex items-center gap-2 rounded-full bg-surface-2 px-4 py-2">
                  <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Send a message" className="flex-1 bg-transparent text-sm outline-none" />
                  <button type="submit" aria-label="Send" disabled={!draft.trim()} className="text-brand disabled:text-muted/50"><Send size={18} /></button>
                </form>
              </>
            )}

            {panel === 'activities' && (
              <div className="grid grid-cols-2 gap-3 px-5">
                {['Whiteboard', 'Breakout rooms', 'Polls', 'Q&A', 'Recording', 'Transcripts'].map(a => (
                  <button key={a} className="rounded-xl border border-line px-3 py-4 text-sm font-medium hover:bg-surface-2">{a}</button>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>

      <footer className="grid grid-cols-[1fr_auto_1fr] items-center px-6 py-3">
        <div className="hidden items-center gap-3 text-sm sm:flex">
          <span>{clock.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
          <span className="text-white/40">|</span>
          <span className="font-medium">{code}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <ControlButton icon={mic ? <Mic size={20} /> : <MicOff size={20} />} label={mic ? 'Turn off microphone' : 'Turn on microphone'} active={mic} onClick={toggleMic} />
          <ControlButton icon={cam ? <Video size={20} /> : <VideoOff size={20} />} label={cam ? 'Turn off camera' : 'Turn on camera'} active={cam} onClick={toggleCam} />
          <ControlButton icon={<Smile size={20} />} label="Send a reaction" />
          <ControlButton icon={<MonitorUp size={20} />} label={sharing ? 'Stop presenting' : 'Present now'} onClick={() => setSharing(s => !s)} />
          <ControlButton icon={<Hand size={20} className={hand ? 'text-yellow-300' : ''} />} label={hand ? 'Lower hand' : 'Raise hand'} onClick={() => setHand(h => !h)} />
          <ControlButton icon={<MoreVertical size={20} />} label="More options" />
          <ControlButton icon={<PhoneOff size={20} />} label="Leave space" danger onClick={leave} />
        </div>
        <div className="flex items-center justify-end gap-1">
          <FooterBtn label="Space details" active={panel === 'info'} onClick={() => toggle('info')}><Info size={22} /></FooterBtn>
          <FooterBtn label="People" active={panel === 'people'} onClick={() => toggle('people')}>
            <Users size={22} />
            <span className="absolute -right-0.5 -top-0.5 rounded-full bg-white px-1.5 text-[10px] font-semibold text-room">{everyone.length}</span>
          </FooterBtn>
          <FooterBtn label="Chat" active={panel === 'chat'} onClick={() => toggle('chat')}><MessageSquare size={22} /></FooterBtn>
          <FooterBtn label="Activities" active={panel === 'activities'} onClick={() => toggle('activities')}><Shapes size={22} /></FooterBtn>
          <FooterBtn label="Host controls"><Lock size={22} /></FooterBtn>
        </div>
      </footer>
    </div>
  )
}

function FooterBtn({ label, active, onClick, children }: { label: string; active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`relative rounded-full p-2.5 transition ${active ? 'bg-brand/30 text-blue-300' : 'text-white hover:bg-white/10'}`}
    >
      {children}
    </button>
  )
}
