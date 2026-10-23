import { useNavigate, useParams } from 'react-router-dom'
import { Mic, MicOff, Video, VideoOff, Sparkles, Settings2 } from 'lucide-react'
import Logo from '../components/Logo'
import VideoTile from '../components/VideoTile'
import ControlButton from '../components/ControlButton'
import { useMedia } from '../lib/useMedia'

export default function Lobby() {
  const { code = '' } = useParams()
  const nav = useNavigate()
  const { stream, error, cam, mic, toggleCam, toggleMic } = useMedia()

  const join = () => nav(`/${code}`, { state: { cam, mic } })

  return (
    <div className="flex min-h-full flex-col">
      <header className="px-4 py-3 sm:px-6"><Logo /></header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-center gap-10 px-6 pb-12 lg:grid-cols-[1.4fr_1fr]">
        <section className="fade-in">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-tile shadow-lg">
            <VideoTile name="You" color="#6d4aff" stream={stream} camOn={cam} micOn={mic} mirror className="h-full w-full !rounded-none" />
            {error && (
              <div className="absolute inset-x-0 top-0 bg-black/60 px-4 py-2 text-center text-sm text-white">
                Camera unavailable: {error}
              </div>
            )}
            <div className="absolute inset-x-0 bottom-5 flex justify-center gap-4">
              <ControlButton icon={mic ? <Mic size={22} /> : <MicOff size={22} />} label={mic ? 'Turn off microphone' : 'Turn on microphone'} active={mic} onClick={toggleMic} />
              <ControlButton icon={cam ? <Video size={22} /> : <VideoOff size={22} />} label={cam ? 'Turn off camera' : 'Turn on camera'} active={cam} onClick={toggleCam} />
              <ControlButton icon={<Sparkles size={22} />} label="Apply visual effects" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-muted">
            <Settings2 size={16} /> Check your audio and video before you enter the space
          </div>
        </section>

        <section className="fade-in flex flex-col items-center text-center">
          <h1 className="text-3xl font-bold text-ink">Ready to jump in?</h1>
          <p className="mt-2 text-muted">You are the first one here</p>
          <p className="mt-1 font-mono text-sm text-muted">{code}</p>
          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={join}
              className="glow h-12 rounded-full bg-brand px-8 text-base font-semibold text-white transition hover:bg-brand-hover"
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
        </section>
      </main>
    </div>
  )
}
