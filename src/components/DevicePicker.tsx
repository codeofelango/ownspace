import { Mic, Video } from 'lucide-react'
import type { Devices } from '../lib/useMedia'
import { useAudioLevel } from '../lib/useSpeaking'

type Props = {
  devices: Devices
  micId: string
  camId: string
  onMic: (id: string) => void
  onCam: (id: string) => void
  stream: MediaStream | null
  micOn: boolean
}

/** Microphone and camera selection with a live input level so people can confirm the mic works before joining. */
export default function DevicePicker({ devices, micId, camId, onMic, onCam, stream, micOn }: Props) {
  const level = useAudioLevel(stream, micOn)
  const bars = 12
  const lit = Math.round(level * bars)

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
        <Mic size={16} className="shrink-0 text-muted" />
        <select
          aria-label="Microphone"
          value={micId}
          onChange={e => onMic(e.target.value)}
          className="min-w-0 flex-1 bg-transparent outline-none"
        >
          <option value="">Default microphone</option>
          {devices.mics.map((d, i) => (
            <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${i + 1}`}</option>
          ))}
        </select>
        <span className="flex items-end gap-0.5" aria-label={micOn ? `Microphone level ${Math.round(level * 100)} percent` : 'Microphone muted'} title="Input level">
          {Array.from({ length: bars }, (_, i) => (
            <span
              key={i}
              className={`w-1 rounded-sm transition-colors ${i < lit && micOn ? (i > bars * 0.8 ? 'bg-danger' : 'bg-accent') : 'bg-line'}`}
              style={{ height: 6 + i }}
            />
          ))}
        </span>
      </label>
      <label className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
        <Video size={16} className="shrink-0 text-muted" />
        <select
          aria-label="Camera"
          value={camId}
          onChange={e => onCam(e.target.value)}
          className="min-w-0 flex-1 bg-transparent outline-none"
        >
          <option value="">Default camera</option>
          {devices.cams.map((d, i) => (
            <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>
          ))}
        </select>
      </label>
      {micOn && stream && level === 0 && (
        <p className="text-xs text-muted sm:col-span-2">
          Speak to test your microphone. If the meter stays empty, pick another microphone or check your system input settings.
        </p>
      )}
    </div>
  )
}
