import { Bot, Loader2 } from 'lucide-react'
import Avatar from './Avatar'
import type { Expert } from '../lib/experts'

type Props = {
  expert: Expert
  /** Currently answering (text streaming) or voicing. */
  active?: boolean
  thinking?: boolean
  /** Last thing they said, shown as a caption. */
  caption?: string
  className?: string
}

export default function ExpertTile({ expert, active, thinking, caption, className = '' }: Props) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-tile ring-2 transition-all ${active ? 'ring-accent' : 'ring-transparent'} ${className}`}
      style={{ background: `radial-gradient(120% 90% at 50% 0%, ${expert.color}33, #1b1830 70%)` }}
    >
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4">
        <div className={`relative ${active ? 'pulse' : ''}`}>
          <Avatar name={expert.name} color={expert.color} size={88} />
          {active && thinking && (
            <span className="absolute -bottom-1 -right-1 rounded-full bg-black/70 p-1 text-accent"><Loader2 size={14} className="animate-spin" /></span>
          )}
        </div>
        {caption && (
          <p className="line-clamp-3 max-w-md text-center text-sm text-white/85">{caption}</p>
        )}
      </div>
      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-md bg-black/50 px-2.5 py-1 text-sm text-white backdrop-blur">
        <Bot size={14} className="text-accent" />
        <span className="max-w-[200px] truncate">{expert.name}</span>
        <span className="text-xs text-white/60">{expert.role}</span>
      </div>
    </div>
  )
}
