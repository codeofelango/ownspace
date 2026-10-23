import { Link } from 'react-router-dom'

export default function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 select-none">
      <svg viewBox="0 0 48 48" className="h-9 w-9">
        <defs>
          <linearGradient id="os-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6d4aff" />
            <stop offset="1" stopColor="#14b8a6" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="14" fill="url(#os-g)" />
        <circle cx="24" cy="24" r="9" fill="none" stroke="#fff" strokeWidth="3.5" />
        <ellipse cx="24" cy="24" rx="17" ry="7" fill="none" stroke="#fff" strokeWidth="2.5" transform="rotate(-25 24 24)" opacity=".85" />
        <circle cx="38" cy="16" r="3" fill="#fff" />
      </svg>
      <span className={`text-[22px] font-bold tracking-tight ${dark ? 'text-white' : 'text-ink'}`}>
        Own<span className="gradient-text">Space</span>
      </span>
    </Link>
  )
}
