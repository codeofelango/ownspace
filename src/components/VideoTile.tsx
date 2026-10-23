import { useEffect, useRef } from 'react'
import { Hand, MicOff, MonitorUp } from 'lucide-react'
import Avatar from './Avatar'
import { useSpeaking } from '../lib/useSpeaking'
import { AUDIO_BLOCKED_EVENT } from '../lib/audioUnlock'

type Props = {
  name: string
  color: string
  stream?: MediaStream | null
  camOn?: boolean
  micOn?: boolean
  hand?: boolean
  screen?: boolean
  /** Mirror the picture (local camera preview). */
  mirror?: boolean
  /** Mute playback (always true for the local tile to avoid echo). */
  muted?: boolean
  className?: string
}

export default function VideoTile({
  name, color, stream, camOn = false, micOn = true, hand, screen, mirror, muted, className = '',
}: Props) {
  const ref = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const speaking = useSpeaking(stream, micOn)
  const showVideo = !!stream && (camOn || screen) && stream.getVideoTracks().length > 0

  useEffect(() => {
    const v = ref.current
    if (v && stream) {
      v.srcObject = stream
      void v.play().catch(() => undefined)
    }
  }, [stream, showVideo])

  // Remote audio plays through a dedicated element so it keeps going when the camera is off.
  useEffect(() => {
    const a = audioRef.current
    if (!a || !stream) return
    a.srcObject = stream
    a.play().catch(() => window.dispatchEvent(new Event(AUDIO_BLOCKED_EVENT)))
  }, [stream])

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-tile ring-2 transition-all ${
        speaking && micOn ? 'ring-accent' : 'ring-transparent'
      } ${className}`}
    >
      {showVideo ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted
          className={`h-full w-full ${screen ? 'object-contain bg-black' : 'object-cover'} ${mirror && !screen ? 'mirror' : ''}`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Avatar name={name} color={color} size={88} />
        </div>
      )}
      {!muted && <audio ref={audioRef} autoPlay playsInline data-remote />}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-md bg-black/50 px-2.5 py-1 text-sm text-white backdrop-blur">
        {!micOn && <MicOff size={14} className="text-red-400" />}
        {screen && <MonitorUp size={14} className="text-accent" />}
        <span className="max-w-[160px] truncate">{name}</span>
      </div>
      {hand && (
        <div className="absolute right-3 top-3 rounded-full bg-yellow-300 p-1.5 text-ink shadow" title="Hand raised">
          <Hand size={16} />
        </div>
      )}
    </div>
  )
}
