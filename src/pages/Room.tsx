import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Mic, MicOff, Video, VideoOff, MonitorUp, MonitorX, Hand, Smile, PhoneOff,
  Info, Users, MessageSquare, X, Send, Copy, Check, Loader2, WifiOff, Volume2, VolumeX,
  AudioLines, Square, Bot, ScrollText,
} from 'lucide-react'
import VideoTile from '../components/VideoTile'
import ExpertTile from '../components/ExpertTile'
import { AUDIO_BLOCKED_EVENT, unlockAudio } from '../lib/audioUnlock'
import ControlButton from '../components/ControlButton'
import Avatar from '../components/Avatar'
import { useMedia } from '../lib/useMedia'
import { useRoom } from '../lib/useRoom'
import { colorFor, loadName } from '../lib/meeting'
import { loadKey, PROXY_KEY, serverKeyConfigured, serverKeyKnown } from '../lib/euri'
import { loadSession, saveSession, type Session } from '../lib/experts'
import { usePanel, type PanelEvent } from '../lib/usePanel'
import { useVoiceInput } from '../lib/useVoiceInput'

type Panel = 'info' | 'people' | 'chat' | 'transcript' | null
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
  const [ask, setAsk] = useState('')
  const [copied, setCopied] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [clock, setClock] = useState(() => new Date())
  const [readCount, setReadCount] = useState(0)
  const [audioBlocked, setAudioBlocked] = useState(false)
  const [voiceOn, setVoiceOn] = useState(true)
  const [session, setSession] = useState<Session | null>(() => loadSession(code))
  const [apiKey, setApiKey] = useState(() => loadKey() || (serverKeyKnown() ? PROXY_KEY : ''))
  useEffect(() => {
    if (apiKey) return
    void serverKeyConfigured().then(ok => ok && setApiKey(PROXY_KEY))
  }, [apiKey])

  // --- expert panel wiring -------------------------------------------------
  const panelRef = useRef<{ receive: (ev: PanelEvent) => void } | null>(null)
  const sessionRef = useRef(session)
  useEffect(() => { sessionRef.current = session }, [session])
  const sendRef = useRef<(ev: PanelEvent) => void>(() => undefined)
  const sendToRef = useRef<(id: string, ev: PanelEvent) => void>(() => undefined)
  const sendPanelEv = useCallback((ev: PanelEvent) => sendRef.current(ev), [])
  const onPeerReady = useCallback((id: string) => {
    const s = sessionRef.current
    if (s) sendToRef.current(id, { kind: 'session', session: s })
  }, [])

  const onPanel = useCallback((raw: unknown) => {
    const ev = raw as PanelEvent
    if (!ev || typeof ev !== 'object') return
    if (ev.kind === 'session') {
      // Someone else set up the panel: adopt it so we see the same experts.
      if (!sessionRef.current || sessionRef.current.createdAt < ev.session.createdAt) {
        setSession(ev.session)
        saveSession(ev.session)
      }
      return
    }
    panelRef.current?.receive(ev)
  }, [])

  const { peers, messages, reactions, status, error, sendChat, sendReaction, sendPanel, sendPanelTo, shareScreen, stopShare, screenStream } = useRoom({
    code,
    name,
    stream,
    mediaReady,
    state: useMemo(() => ({ mic, cam, hand }), [mic, cam, hand]),
    onPanel,
    onPeerReady,
  })
  useEffect(() => {
    sendRef.current = sendPanel
    sendToRef.current = sendPanelTo
  }, [sendPanel, sendPanelTo])

  const others = useMemo(() => Object.values(peers).sort((a, b) => a.name.localeCompare(b.name)), [peers])
  const humans = useMemo(() => [name, ...others.map(p => p.name)], [name, others])

  const experts = usePanel({ apiKey, session, selfName: name, humans, voiceOn, send: sendPanelEv })
  useEffect(() => { panelRef.current = experts }, [experts])

  const voice = useVoiceInput({ apiKey, stream, micOn: mic, onFinal: experts.ask })
  // ---------------------------------------------------------------------------

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
  const unread = panel === 'chat' ? 0 : messages.slice(readCount).filter(m => !m.own).length

  const count = others.length + 1
  const link = `${location.origin}/${code}`
  const sharing = !!screenStream
  const localTileStream = screenStream ?? stream
  const roster = session?.experts ?? []
  const hasPanel = roster.length > 0

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
  const submitAsk = (e: React.FormEvent) => {
    e.preventDefault()
    const t = ask.trim()
    if (!t) return
    void experts.ask(t)
    setAsk('')
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

  const tiles = count + roster.length
  const cols = tiles <= 1 ? 1 : tiles <= 4 ? 2 : tiles <= 9 ? 3 : 4
  const lastSaid = (id: string) => [...experts.turns].reverse().find(t => t.speaker.kind === 'expert' && t.speaker.id === id)?.text
  const active = roster.find(e => e.id === experts.activeId)
  const transcriptEnd = useRef<HTMLDivElement>(null)
  useEffect(() => { transcriptEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [experts.turns, panel])

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
          {mediaError && <div className="mb-3 rounded-lg bg-yellow-400/20 px-4 py-2 text-sm">{mediaError}</div>}
          {status === 'error' && (
            <div className="mb-3 flex items-center justify-between rounded-lg bg-danger/20 px-4 py-2 text-sm">
              <span className="flex items-center gap-2"><WifiOff size={16} /> {error}</span>
              <button className="font-medium text-red-200 hover:underline" onClick={() => location.reload()}>Retry</button>
            </div>
          )}
          {(experts.error || voice.error) && (
            <div className="mb-3 flex items-center justify-between rounded-lg bg-danger/20 px-4 py-2 text-sm">
              <span>{experts.error ?? voice.error}</span>
              <button className="font-medium text-red-200 hover:underline" onClick={() => { experts.clearError(); voice.clearError() }}>Dismiss</button>
            </div>
          )}
          {status === 'connected' && count === 1 && !hasPanel && (
            <div className="mb-3 flex items-center justify-between rounded-lg bg-brand/20 px-4 py-2 text-sm">
              <span>You are the only one here. Share the invite link, or go back to the lobby to add an expert panel.</span>
              <button className="font-medium text-violet-200 hover:underline" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
            </div>
          )}
          {sharing && (
            <div className="mb-3 flex items-center justify-between rounded-lg bg-accent/20 px-4 py-2 text-sm">
              <span>You are sharing your screen with the space</span>
              <button className="font-medium text-teal-200 hover:underline" onClick={toggleShare}>Stop sharing</button>
            </div>
          )}
          {hasPanel && (
            <div className="mb-3 flex items-center gap-3 rounded-lg bg-white/10 px-4 py-2 text-sm">
              <Bot size={16} className="shrink-0 text-accent" />
              <span className="min-w-0 flex-1 truncate">
                {voice.listening && voice.interim ? <em className="text-white/80">“{voice.interim}”</em>
                  : voice.transcribing ? 'Transcribing what you said…'
                  : experts.status === 'thinking' && active ? `${active.name} is thinking…`
                  : experts.status === 'speaking' && active ? `${active.name} is speaking`
                  : voice.listening ? 'Listening… speak to the panel'
                  : session?.topic ? `Topic: ${session.topic}` : 'Expert panel ready'}
              </span>
              {experts.busy && (
                <button onClick={experts.interrupt} className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-medium hover:bg-white/20"><Square size={12} /> Interrupt</button>
              )}
            </div>
          )}

          <div className="grid min-h-0 flex-1 gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: 'minmax(0, 1fr)' }}>
            <VideoTile
              name={`${name} (You)`} color={colorFor(name)} stream={localTileStream}
              camOn={cam && hasVideo} micOn={mic} hand={hand} screen={sharing} mirror muted className="fade-in min-h-[160px]"
            />
            {others.map(p => (
              <VideoTile key={p.id} name={p.name} color={colorFor(p.name)} stream={p.stream} camOn={p.cam} micOn={p.mic} hand={p.hand} screen={p.screen} className="fade-in min-h-[160px]" />
            ))}
            {roster.map(e => (
              <ExpertTile
                key={e.id} expert={e} active={experts.activeId === e.id}
                thinking={experts.activeId === e.id && experts.status === 'thinking'}
                caption={lastSaid(e.id)} className="fade-in min-h-[160px]"
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
          <aside className="fade-in m-4 ml-0 flex w-[380px] shrink-0 flex-col rounded-2xl bg-white text-ink shadow-xl">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-lg font-medium">
                {panel === 'info' && 'Space details'}
                {panel === 'people' && `Participants (${count + roster.length})`}
                {panel === 'chat' && 'Room chat'}
                {panel === 'transcript' && 'Panel transcript'}
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
                {session && (
                  <>
                    <p className="mt-6 text-ink">Topic</p>
                    <p className="mt-1 whitespace-pre-wrap">{session.topic || 'Not set'}</p>
                  </>
                )}
                <p className="mt-6 text-xs">
                  Audio and video travel directly between participants over encrypted WebRTC. Expert answers are generated through Euron's EURI API with your own key.
                </p>
              </div>
            )}

            {panel === 'people' && (
              <ul className="flex-1 overflow-y-auto px-3">
                <Person name={`${name} (You)`} micOn={mic} hand={hand} />
                {others.map(p => <Person key={p.id} name={p.name} micOn={p.mic} hand={p.hand} />)}
                {roster.length > 0 && <li className="px-2 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted">Experts</li>}
                {roster.map(e => (
                  <li key={e.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
                    <Avatar name={e.name} color={e.color} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{e.name}</span>
                      <span className="block truncate text-xs text-muted">{e.role}</span>
                    </span>
                    <Bot size={16} className="text-accent" />
                  </li>
                ))}
              </ul>
            )}

            {panel === 'chat' && (
              <>
                <div className="mx-5 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">Messages go directly to people in this space and vanish when it ends.</div>
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

            {panel === 'transcript' && (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto px-5 py-2">
                  {experts.turns.length === 0 && (
                    <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
                      Press the talk button or type below. Address someone by name or role, or ask everyone.
                    </p>
                  )}
                  {experts.turns.map(t => (
                    <div key={t.id} className="text-sm">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium" style={t.speaker.kind === 'expert' ? { color: roster.find(e => e.id === t.speaker.id)?.color } : undefined}>{t.speaker.name}</span>
                        {t.speaker.kind === 'expert' && <span className="text-xs text-muted">{t.speaker.role}</span>}
                        <span className="text-xs text-muted">{time(t.at)}</span>
                      </div>
                      <p className="whitespace-pre-wrap break-words text-ink">{t.text}{!t.done && <span className="animate-pulse">▍</span>}</p>
                    </div>
                  ))}
                  <div ref={transcriptEnd} />
                </div>
                <form onSubmit={submitAsk} className="m-4 flex items-center gap-2 rounded-full bg-surface-2 px-4 py-2">
                  <input value={ask} onChange={e => setAsk(e.target.value)} placeholder={hasPanel ? 'Ask the panel…' : 'No panel in this space'} disabled={!hasPanel} className="flex-1 bg-transparent text-sm outline-none" />
                  <button type="submit" aria-label="Ask" disabled={!ask.trim() || !hasPanel} className="text-brand disabled:text-muted/50"><Send size={18} /></button>
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
          {hasPanel && (
            <>
              <button
                type="button"
                onClick={voice.toggle}
                aria-pressed={voice.listening}
                title={voice.listening ? 'Stop talking to the panel' : voice.native ? 'Talk to the panel' : 'Hold a conversation: press, speak, press again'}
                className={`flex h-12 items-center gap-2 rounded-full px-5 text-sm font-semibold transition ${voice.listening ? 'bg-accent text-room' : 'bg-brand text-white hover:bg-brand-hover'}`}
              >
                <AudioLines size={20} className={voice.listening ? 'animate-pulse' : ''} /> {voice.listening ? 'Listening' : 'Talk to panel'}
              </button>
              <ControlButton icon={voiceOn ? <Volume2 size={20} /> : <VolumeX size={20} />} label={voiceOn ? 'Mute expert voices' : 'Unmute expert voices'} active={voiceOn} onClick={() => setVoiceOn(v => !v)} />
            </>
          )}
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
          <FooterBtn label="Participants" active={panel === 'people'} onClick={() => toggle('people')}>
            <Users size={22} />
            <span className="absolute -right-0.5 -top-0.5 rounded-full bg-white px-1.5 text-[10px] font-semibold text-room">{count + roster.length}</span>
          </FooterBtn>
          {hasPanel && (
            <FooterBtn label="Panel transcript" active={panel === 'transcript'} onClick={() => toggle('transcript')}><ScrollText size={22} /></FooterBtn>
          )}
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
    <button type="button" aria-label={label} title={label} onClick={onClick} className={`relative rounded-full p-2.5 transition ${active ? 'bg-brand/30 text-violet-200' : 'text-white hover:bg-white/10'}`}>
      {children}
    </button>
  )
}
