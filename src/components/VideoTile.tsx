import { useEffect, useRef } from 'react'
import { MicOff } from 'lucide-react'
import Avatar from './Avatar'

type Props = {
  name: string
  color: string
  stream?: MediaStream | null
  camOn?: boolean
  micOn?: boolean
  mirror?: boolean
  speaking?: boolean
  className?: string
}

export default function VideoTile({
  name, color, stream, camOn = false, micOn = true, mirror, speaking, className = '',
}: Props) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream
  }, [stream, camOn])

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-tile ring-2 transition-all ${
        speaking ? 'ring-brand' : 'ring-transparent'
      } ${className}`}
    >
      {stream && camOn ? (
        <video ref={ref} autoPlay playsInline muted className={`h-full w-full object-cover ${mirror ? 'mirror' : ''}`} />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Avatar name={name} color={color} size={88} />
        </div>
      )}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-md bg-black/50 px-2.5 py-1 text-sm text-white backdrop-blur">
        {!micOn && <MicOff size={14} className="text-red-400" />}
        <span className="max-w-[160px] truncate">{name}</span>
      </div>
    </div>
  )
}
