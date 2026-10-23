import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Mic, MicOff, Video, VideoOff, Settings2 } from 'lucide-react'
import Logo from '../components/Logo'
import VideoTile from '../components/VideoTile'
import ControlButton from '../components/ControlButton'
import { useMedia } from '../lib/useMedia'
import { colorFor, loadName, saveName } from '../lib/meeting'

export default function Lobby() {
  const { code = '' } = useParams()
  const nav = useNavigate()
  const { stream, error, cam, mic, toggleCam, toggleMic } = useMedia()
  const [name, setName] = useState(loadName)

  const join = (e: React.FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    saveName(n)
    nav(`/${code}`, { state: { cam, mic } })
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="px-4 py-3 sm:px-6"><Logo /></header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-center gap-10 px-6 pb-12 lg:grid-cols-[1.4fr_1fr]">
        <section className="fade-in">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-tile shadow-lg">
            <VideoTile name={name.trim() || 'You'} color={colorFor(name || 'You')} stream={stream} camOn={cam} micOn={mic} mirror muted className="h-full w-full !rounded-none" />
            {error && (
              <div className="absolute inset-x-0 top-0 bg-black/60 px-4 py-2 text-center text-sm text-white">
                Camera unavailable: {error}. You can still join and listen.
              </div>
            )}
            <div className="absolute inset-x-0 bottom-5 flex justify-center gap-4">
              <ControlButton icon={mic ? <Mic size={22} /> : <MicOff size={22} />} label={mic ? 'Turn off microphone' : 'Turn on microphone'} active={mic} onClick={toggleMic} />
              <ControlButton icon={cam ? <Video size={22} /> : <VideoOff size={22} />} label={cam ? 'Turn off camera' : 'Turn on camera'} active={cam} onClick={toggleCam} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-muted">
            <Settings2 size={16} /> Check your audio and video before you enter the space
          </div>
        </section>

        <form onSubmit={join} className="fade-in flex flex-col items-center text-center">
          <h1 className="text-3xl font-bold text-ink">Ready to jump in?</h1>
          <p className="mt-1 font-mono text-sm text-muted">{code}</p>
          <label className="mt-6 w-full max-w-xs text-left">
            <span className="mb-1 block text-sm font-medium text-muted">Your name</span>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="How should others see you?"
              maxLength={40}
              autoFocus
              aria-label="Your name"
              className="h-12 w-full rounded-full border border-line px-5 text-base outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </label>
          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={!name.trim()}
              className="glow h-12 rounded-full bg-brand px-8 text-base font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              Enter space
            </button>
            <button
              type="button"
              onClick={() => nav('/')}
              className="h-12 rounded-full border border-line px-6 text-base font-medium text-brand transition hover:bg-surface-2"
            >
              Cancel
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
