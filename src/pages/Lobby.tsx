import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Mic, MicOff, Video, VideoOff, AlertTriangle, Bot, Check, KeyRound, Loader2, Sparkles, X } from 'lucide-react'
import Logo from '../components/Logo'
import VideoTile from '../components/VideoTile'
import ControlButton from '../components/ControlButton'
import DevicePicker from '../components/DevicePicker'
import Avatar from '../components/Avatar'
import { useMedia } from '../lib/useMedia'
import { colorFor, loadName, saveName } from '../lib/meeting'
import { checkKey, hasEnvKey, loadKey, looksLikeKey, saveKey } from '../lib/euri'
import { PRESETS, loadSession, presetToExpert, resolveRoster, saveSession, type Expert } from '../lib/experts'

export default function Lobby() {
  const { code = '' } = useParams()
  const nav = useNavigate()
  const { stream, error, cam, mic, hasVideo, toggleCam, toggleMic, devices, micId, camId, setMicId, setCamId } = useMedia()
  const [name, setName] = useState(loadName)

  const existing = loadSession(code)
  const [topic, setTopic] = useState(existing?.topic ?? '')
  const [wanted, setWanted] = useState(existing?.wanted ?? '')
  const [picked, setPicked] = useState<Expert[]>(existing?.experts ?? [])
  const [apiKey, setApiKey] = useState(loadKey)
  const [keyState, setKeyState] = useState<'unknown' | 'checking' | 'ok' | 'bad'>('unknown')
  const [keyMsg, setKeyMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)

  const wantsPanel = topic.trim() || wanted.trim() || picked.length > 0
  const envKey = hasEnvKey()
  const needsKey = !!wantsPanel && !looksLikeKey(apiKey)

  const togglePreset = (id: string) => {
    setPicked(cur => {
      if (cur.some(e => e.id === id)) return cur.filter(e => e.id !== id)
      const p = PRESETS.find(x => x.id === id)
      return p ? [...cur, presetToExpert(p, cur.length)] : cur
    })
  }

  const verify = async () => {
    const k = apiKey.trim()
    if (!looksLikeKey(k)) {
      setKeyState('bad')
      setKeyMsg('Keys start with "euri-". Create one at euron.one/euri → API Keys.')
      return false
    }
    setKeyState('checking')
    const r = await checkKey(k)
    setKeyState(r.ok ? 'ok' : 'bad')
    setKeyMsg(r.ok ? 'Key works' : r.error)
    if (r.ok && !envKey) saveKey(k)
    return r.ok
  }

  const join = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    saveName(n)
    setSetupError(null)

    if (wantsPanel) {
      if (keyState !== 'ok' && !(await verify())) return
      setBusy(true)
      try {
        const experts = await resolveRoster(apiKey.trim(), wanted, topic, picked)
        if (experts.length === 0) {
          setSetupError('Pick at least one expert or describe who should join.')
          return
        }
        saveSession({ code, topic: topic.trim(), wanted: wanted.trim(), experts, createdAt: Date.now() })
      } catch (err) {
        setSetupError(err instanceof Error ? err.message : String(err))
        return
      } finally {
        setBusy(false)
      }
    } else if (looksLikeKey(apiKey) && !envKey) {
      saveKey(apiKey.trim())
    }
    nav(`/${code}`, { state: { cam, mic } })
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="px-4 py-3 sm:px-6"><Logo /></header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-start gap-10 px-6 pb-12 lg:grid-cols-[1.1fr_1fr]">
        <section className="fade-in">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-tile shadow-lg">
            <VideoTile name={name.trim() || 'You'} color={colorFor(name || 'You')} stream={stream} camOn={cam && hasVideo} micOn={mic} mirror muted className="h-full w-full !rounded-none" />
            {error && (
              <div className="absolute inset-x-0 top-0 flex items-center gap-2 bg-black/70 px-4 py-2 text-sm text-white">
                <AlertTriangle size={16} className="shrink-0 text-yellow-300" /> {error}
              </div>
            )}
            <div className="absolute inset-x-0 bottom-5 flex justify-center gap-4">
              <ControlButton icon={mic ? <Mic size={22} /> : <MicOff size={22} />} label={mic ? 'Turn off microphone' : 'Turn on microphone'} active={mic} onClick={toggleMic} />
              <ControlButton icon={cam ? <Video size={22} /> : <VideoOff size={22} />} label={cam ? 'Turn off camera' : 'Turn on camera'} active={cam} onClick={toggleCam} />
            </div>
          </div>
          <DevicePicker devices={devices} micId={micId} camId={camId} onMic={setMicId} onCam={setCamId} stream={stream} micOn={mic} />
          <p className="mt-4 text-xs text-muted">
            Testing on one computer with two tabs? Use headphones, otherwise echo cancellation silences your own voice.
          </p>
        </section>

        <form onSubmit={join} className="fade-in flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-bold text-ink">Set up your session</h1>
            <p className="mt-1 font-mono text-sm text-muted">{code}</p>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-muted">Your name</span>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="How should others see you?"
              maxLength={40}
              autoFocus
              aria-label="Your name"
              className="h-12 w-full rounded-xl border border-line px-4 text-base outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </label>

          <fieldset className="rounded-2xl border border-line p-4">
            <legend className="flex items-center gap-2 px-1 text-sm font-semibold text-ink"><Sparkles size={16} className="text-brand" /> Expert panel</legend>
            <p className="mb-3 text-xs text-muted">
              Leave this empty to join a plain video meeting, or to join a panel someone else already set up.
            </p>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-muted">What are we discussing?</span>
              <textarea
                value={topic}
                onChange={e => setTopic(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="e.g. Whether to launch our B2B analytics product in the EU next quarter, and how to price it."
                className="w-full resize-y rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </label>

            <div className="mt-3">
              <span className="mb-2 block text-sm font-medium text-muted">Who should join?</span>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map(p => {
                  const on = picked.some(e => e.id === p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => togglePreset(p.id)}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${on ? 'border-brand bg-brand text-white' : 'border-line text-ink hover:bg-surface-2'}`}
                    >
                      {on ? <Check size={14} /> : <Bot size={14} className="text-muted" />} {p.role}
                    </button>
                  )
                })}
              </div>
              <input
                value={wanted}
                onChange={e => setWanted(e.target.value)}
                maxLength={400}
                placeholder="…or describe them: a growth marketer, a pricing expert and a sceptical investor"
                className="mt-3 h-11 w-full rounded-xl border border-line px-4 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>

            {picked.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {picked.map(e => (
                  <li key={e.id} className="flex items-center gap-2 rounded-full bg-surface-2 py-1 pl-1 pr-2 text-xs">
                    <Avatar name={e.name} color={e.color} size={22} />
                    <span className="font-medium">{e.name}</span>
                    <span className="text-muted">{e.role}</span>
                    <button type="button" aria-label={`Remove ${e.role}`} onClick={() => togglePreset(e.id)} className="text-muted hover:text-danger"><X size={14} /></button>
                  </li>
                ))}
              </ul>
            )}

            {!envKey && <label className="mt-4 block">
              <span className="mb-1 flex items-center gap-1.5 text-sm font-medium text-muted"><KeyRound size={14} /> EURI API key</span>
              <div className="flex gap-2">
                <input
                  value={apiKey}
                  onChange={e => { setApiKey(e.target.value); setKeyState('unknown') }}
                  onBlur={() => looksLikeKey(apiKey) && keyState === 'unknown' && void verify()}
                  type="password"
                  autoComplete="off"
                  placeholder="euri-…"
                  className={`h-11 flex-1 rounded-xl border px-4 font-mono text-sm outline-none focus:ring-1 ${keyState === 'bad' ? 'border-danger focus:border-danger focus:ring-danger' : 'border-line focus:border-brand focus:ring-brand'}`}
                />
                <button type="button" onClick={() => void verify()} disabled={keyState === 'checking' || !apiKey.trim()} className="rounded-xl border border-line px-3 text-sm font-medium text-brand hover:bg-surface-2 disabled:opacity-50">
                  {keyState === 'checking' ? <Loader2 size={16} className="animate-spin" /> : keyState === 'ok' ? <Check size={16} /> : 'Check'}
                </button>
              </div>
              <span className={`mt-1 block text-xs ${keyState === 'bad' ? 'text-danger' : 'text-muted'}`}>
                {keyMsg || <>Free on Euron Plus. Stored only in this browser. Get one at <a className="text-brand hover:underline" href="https://euron.one/euri" target="_blank" rel="noreferrer">euron.one/euri</a>.</>}
              </span>
            </label>}
          </fieldset>

          {setupError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{setupError}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!name.trim() || busy || needsKey}
              className="glow flex h-12 items-center gap-2 rounded-full bg-brand px-8 text-base font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              {busy && <Loader2 size={18} className="animate-spin" />}
              {busy ? 'Assembling the panel…' : wantsPanel ? 'Start session' : 'Enter space'}
            </button>
            <button type="button" onClick={() => nav('/')} className="h-12 rounded-full border border-line px-6 text-base font-medium text-brand transition hover:bg-surface-2">
              Cancel
            </button>
          </div>
          {needsKey && <p className="-mt-3 text-xs text-muted">An API key is needed for the expert panel.</p>}
        </form>
      </main>
    </div>
  )
}
