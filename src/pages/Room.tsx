import { useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Mic, MicOff, Video, VideoOff, MonitorUp, MonitorX, Hand, Smile, PhoneOff,
  Info, Users, MessageSquare, X, Send, Copy, Check, Loader2, WifiOff, Volume2,
} from 'lucide-react'
import VideoTile from '../components/VideoTile'
import { AUDIO_BLOCKED_EVENT, unlockAudio } from '../lib/audioUnlock'
import ControlButton from '../components/ControlButton'
import Avatar from '../components/Avatar'
import { useMedia } from '../lib/useMedia'
import { useRoom } from '../lib/useRoom'
import { colorFor, loadName } from '../lib/meeting'

type Panel = 'info' | 'people' | 'chat' | null
const EMOJIS = ['👍', '❤️', '😂', '🎉', '👏', '🤔']
const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export default function Room() {
  const { code = '' } = useParams()
  const name = loadName().trim()
  if (!name) return <Navigate to={`/${code}/lobby`} replace />
  return <LiveRoom code={code} name={name} />
}

function LiveRoom({ code, name }: { code: string; name: string }) {
  const nav = useNavigate()
  const prefs = (useLocation().state as { cam?: boolean; mic?: boolean } | null) ?? {}
  const { stream, error: mediaError, cam, mic, hasVideo, toggleCam, toggleMic } = useMedia({ cam: prefs.cam ?? true, mic: prefs.mic ?? true })
  const mediaReady = !!stream || !!mediaError

  const [hand, setHand] = useState(false)
  const [panel, setPanel] = useState<Panel>(null)
  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [clock, setClock] = useState(() => new Date())
  const [readCount, setReadCount] = useState(0)
  const [audioBlocked, setAudioBlocked] = useState(false)

  const { peers, messages, reactions, status, error, sendChat, sendReaction, shareScreen, stopShare, screenStream } = useRoom({
    code,
    name,
    stream,
    mediaReady,
    state: useMemo(() => ({ mic, cam, hand }), [mic, cam, hand]),
  })

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 15_000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    const on = () => setAudioBlocked(true)
    window.addEventListener(AUDIO_BLOCKED_EVENT, on)
    return () => window.removeEventListener(AUDIO_BLOCKED_EVENT, on)
  }, [])
  const enableAudio = () => {
    unlockAudio()
    setAudioBlocked(false)
  }
  // Unread = messages from others that arrived while the chat panel was closed.
  const unread = panel === 'chat' ? 0 : messages.slice(readCount).filter(m => !m.own).length

  const others = useMemo(() => Object.values(peers).sort((a, b) => a.name.localeCompare(b.name)), [peers])
  const count = others.length + 1
  const link = `${location.origin}/${code}`
  const sharing = !!screenStream
  const localTileStream = screenStream ?? stream

  const copy = async () => {
    try { await navigator.clipboard.writeText(link) } catch { /* clipboard blocked */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  const send = (e: React.FormEvent) => {
    e.preventDefault()
    const t = draft.trim()
    if (!t) return
    sendChat(t)
    setDraft('')
  }
  const toggleShare = async () => {
    try {
      if (sharing) await stopShare()
      else await shareScreen()
    } catch {
      /* user cancelled the picker */
    }
  }
  const toggle = (p: Panel) => {
    if (panel === 'chat') setReadCount(messages.length)
    setPanel(cur => (cur === p ? null : p))
  }

  const cols = count <= 1 ? 1 : count <= 4 ? 2 : count <= 9 ? 3 : 4

  return (
    <div className="flex h-full flex-col bg-room text-white">
      <div className="flex min-h-0 flex-1">
        <main className="relative flex min-h-0 flex-1 flex-col p-4">
          {status === 'connecting' && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm">
              <Loader2 size={16} className="animate-spin" /> Connecting to the space…
            </div>
          )}
          {audioBlocked && (
            <button onClick={enableAudio} className="mb-3 flex w-full items-center gap-2 rounded-lg bg-accent px-4 py-2 text-left text-sm font-medium text-room">
              <Volume2 size={16} /> Your browser blocked audio playback. Click here to hear the others.
            </button>
          )}
          {mediaError && (
            <div className="mb-3 rounded-lg bg-yellow-400/20 px-4 py-2 text-sm">{mediaError}</div>
          )}
          {status === 'error' && (
            <div className="mb-3 flex items-center justify-between rounded-lg bg-danger/20 px-4 py-2 text-sm">
              <span className="flex items-center gap-2"><WifiOff size={16} /> {error}</span>
              <button className="font-medium text-red-200 hover:underline" onClick={() => location.reload()}>Retry</button>
            </div>
          )}
          {status === 'connected' && count === 1 && (
            <div className="mb-3 flex items-center justify-between rounded-lg bg-brand/20 px-4 py-2 text-sm">
              <span>You are the only one here. Share the invite link so others can join.</span>
              <button className="font-medium text-violet-200 hover:underline" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
            </div>
          )}
          {sharing && (
            <div className="mb-3 flex items-center justify-between rounded-lg bg-accent/20 px-4 py-2 text-sm">
              <span>You are sharing your screen with the space</span>
              <button className="font-medium text-teal-200 hover:underline" onClick={toggleShare}>Stop sharing</button>
            </div>
          )}

          <div
            className="grid min-h-0 flex-1 gap-3"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: 'minmax(0, 1fr)' }}
          >
            <VideoTile
              name={`${name} (You)`} color={colorFor(name)} stream={localTileStream}
              camOn={cam && hasVideo} micOn={mic} hand={hand} screen={sharing} mirror muted className="fade-in min-h-[160px]"
            />
            {others.map(p => (
              <VideoTile
                key={p.id} name={p.name} color={colorFor(p.name)} stream={p.stream}
                camOn={p.cam} micOn={p.mic} hand={p.hand} screen={p.screen} className="fade-in min-h-[160px]"
              />
            ))}
          </div>

          {reactions.length > 0 && (
            <div className="pointer-events-none absolute bottom-6 left-6 flex flex-col-reverse gap-2">
              {reactions.map(r => (
                <div key={r.id} className="fade-in flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-sm backdrop-blur">
                  <span className="text-xl">{r.emoji}</span> {r.from}
                </div>
              ))}
            </div>
          )}
        </main>

        {panel && (
          <aside className="fade-in m-4 ml-0 flex w-[360px] shrink-0 flex-col rounded-2xl bg-white text-ink shadow-xl">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-lg font-medium">
                {panel === 'info' && 'Space details'}
                {panel === 'people' && `People (${count})`}
                {panel === 'chat' && 'Room chat'}
              </h2>
              <button aria-label="Close panel" onClick={() => toggle(panel)} className="rounded-full p-2 hover:bg-surface-2"><X size={20} /></button>
            </div>

            {panel === 'info' && (
              <div className="px-5 text-sm text-muted">
                <p className="mb-3 text-ink">Invite link</p>
                <p className="break-all font-mono text-xs">{link}</p>
                <button onClick={copy} className="mt-4 flex items-center gap-2 font-medium text-brand hover:underline">
                  {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy invite link'}
                </button>
                <p className="mt-6 text-xs">
                  Audio and video travel directly between participants over encrypted WebRTC connections.
                </p>
              </div>
            )}

            {panel === 'people' && (
              <ul className="flex-1 overflow-y-auto px-3">
                <Person name={`${name} (You)`} micOn={mic} hand={hand} />
                {others.map(p => <Person key={p.id} name={p.name} micOn={p.mic} hand={p.hand} />)}
              </ul>
            )}

            {panel === 'chat' && (
              <>
                <div className="mx-5 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
                  Messages go directly to people in this space and vanish when it ends.
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                  {messages.map(m => (
                    <div key={m.id} className="text-sm">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium">{m.from}</span>
                        <span className="text-xs text-muted">{time(m.at)}</span>
                      </div>
                      <p className="break-words text-ink">{m.text}</p>
                    </div>
                  ))}
                </div>
                <form onSubmit={send} className="m-4 flex items-center gap-2 rounded-full bg-surface-2 px-4 py-2">
                  <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Send a message" className="flex-1 bg-transparent text-sm outline-none" />
                  <button type="submit" aria-label="Send" disabled={!draft.trim()} className="text-brand disabled:text-muted/50"><Send size={18} /></button>
                </form>
              </>
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
        <div className="relative flex items-center gap-2 sm:gap-3">
          <ControlButton icon={mic ? <Mic size={20} /> : <MicOff size={20} />} label={mic ? 'Turn off microphone' : 'Turn on microphone'} active={mic} onClick={toggleMic} />
          <ControlButton icon={cam ? <Video size={20} /> : <VideoOff size={20} />} label={cam ? 'Turn off camera' : 'Turn on camera'} active={cam} onClick={toggleCam} />
          <ControlButton icon={<Smile size={20} />} label="Send a reaction" onClick={() => setEmojiOpen(o => !o)} />
          <ControlButton icon={sharing ? <MonitorX size={20} /> : <MonitorUp size={20} />} label={sharing ? 'Stop sharing' : 'Share screen'} onClick={toggleShare} />
          <ControlButton icon={<Hand size={20} className={hand ? 'text-yellow-300' : ''} />} label={hand ? 'Lower hand' : 'Raise hand'} onClick={() => setHand(h => !h)} />
          <ControlButton icon={<PhoneOff size={20} />} label="Leave space" danger onClick={() => nav('/')} />
          {emojiOpen && (
            <div className="fade-in absolute bottom-16 left-1/2 flex -translate-x-1/2 gap-1 rounded-full bg-white px-2 py-1.5 shadow-xl">
              {EMOJIS.map(e => (
                <button key={e} aria-label={`React ${e}`} onClick={() => { sendReaction(e); setEmojiOpen(false) }} className="rounded-full px-2 py-1 text-2xl transition hover:bg-surface-2">{e}</button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-1">
          <FooterBtn label="Space details" active={panel === 'info'} onClick={() => toggle('info')}><Info size={22} /></FooterBtn>
          <FooterBtn label="People" active={panel === 'people'} onClick={() => toggle('people')}>
            <Users size={22} />
            <span className="absolute -right-0.5 -top-0.5 rounded-full bg-white px-1.5 text-[10px] font-semibold text-room">{count}</span>
          </FooterBtn>
          <FooterBtn label="Chat" active={panel === 'chat'} onClick={() => toggle('chat')}>
            <MessageSquare size={22} />
            {unread > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-accent px-1.5 text-[10px] font-semibold text-room">{unread}</span>}
          </FooterBtn>
        </div>
      </footer>
    </div>
  )
}

function Person({ name, micOn, hand }: { name: string; micOn: boolean; hand: boolean }) {
  return (
    <li className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
      <Avatar name={name} color={colorFor(name)} size={36} />
      <span className="flex-1 truncate text-sm">{name}</span>
      {hand && <Hand size={16} className="text-yellow-500" />}
      {micOn ? <Mic size={18} className="text-muted" /> : <MicOff size={18} className="text-danger" />}
    </li>
  )
}

function FooterBtn({ label, active, onClick, children }: { label: string; active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`relative rounded-full p-2.5 transition ${active ? 'bg-brand/30 text-violet-200' : 'text-white hover:bg-white/10'}`}
    >
      {children}
    </button>
  )
}
