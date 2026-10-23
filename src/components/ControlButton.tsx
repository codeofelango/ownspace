import type { ReactNode } from 'react'

type Props = {
  icon: ReactNode
  label: string
  /** true = feature on (neutral look), false = off (red look) */
  active?: boolean
  danger?: boolean
  onClick?: () => void
}

export default function ControlButton({ icon, label, active = true, danger, onClick }: Props) {
  const base =
    'flex h-12 w-12 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white'
  const look = danger
    ? 'w-16 bg-danger text-white hover:bg-red-600'
    : active
      ? 'bg-white/10 text-white hover:bg-white/20'
      : 'bg-danger text-white hover:bg-red-600'
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`${base} ${look}`}
    >
      {icon}
    </button>
  )
}
