import { initials } from '../lib/meeting'

export default function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-medium text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}
      aria-label={name}
    >
      {initials(name)}
    </div>
  )
}
