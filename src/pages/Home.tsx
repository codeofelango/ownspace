import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Video, Keyboard, Plus, Link2, CalendarPlus, ChevronLeft, ChevronRight,
  ShieldCheck, Share2, Users, Info, Mic, Video as Cam, PhoneOff, MonitorUp, Hand,
} from 'lucide-react'
import Logo from '../components/Logo'
import Avatar from '../components/Avatar'
import { newMeetingCode, parseCode } from '../lib/meeting'

const slides = [
  {
    title: 'Experts on demand',
    body: 'Pick a CEO, a strategist, a researcher, or describe who you need. Each one joins as an AI participant with its own voice and point of view.',
    Icon: Link2,
  },
  {
    title: 'Private by default',
    body: 'Every space is encrypted in transit, and the host decides who gets in.',
    Icon: ShieldCheck,
  },
  {
    title: 'Spaces that wait for you',
    body: 'Create a space for later and keep the same link for every recurring session.',
    Icon: CalendarPlus,
  },
]

export default function Home() {
  const nav = useNavigate()
  const [code, setCode] = useState('')
  const [menu, setMenu] = useState(false)
  const [slide, setSlide] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const close = () => setMenu(false)
    if (menu) document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [menu])

  const start = () => nav(`/${newMeetingCode()}/lobby`)
  const copyLink = async () => {
    const link = `${location.origin}/${newMeetingCode()}`
    try {
      await navigator.clipboard.writeText(link)
      setToast('Space link copied to clipboard')
    } catch {
      setToast(link)
    }
    setTimeout(() => setToast(null), 3000)
  }
  const join = (e: React.FormEvent) => {
    e.preventDefault()
    const c = parseCode(code)
    if (c) nav(`/${c}/lobby`)
  }

  const { Icon } = slides[slide]
  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const date = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <Logo />
        <div className="flex items-center gap-1 text-muted">
          <span className="hidden pr-3 text-sm sm:block">
            {time} • {date}
          </span>
          <a href="https://github.com/codeofelango/ownspace" target="_blank" rel="noreferrer" className="rounded-full px-3 py-1.5 text-sm font-medium transition hover:bg-surface-2">GitHub</a>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-center gap-12 px-6 py-10 lg:grid-cols-2 lg:gap-8">
        <section className="fade-in max-w-xl">
          <h1 className="text-[2.75rem] leading-[1.1] font-extrabold tracking-tight text-ink sm:text-[3.4rem]">
            Meet your <span className="gradient-text">expert panel</span>, out loud
          </h1>
          <p className="mt-5 text-lg text-muted">
            Tell OwnSpace what you want to discuss and who should be there: a strategy expert, a CEO, a researcher. They join the room as AI participants, listen to you speak, and answer in their own voices. Invite real people too.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setMenu(m => !m)}
                className="glow flex h-12 items-center gap-2 rounded-full bg-brand px-6 text-base font-semibold text-white transition hover:bg-brand-hover"
              >
                <Video size={20} /> New space
              </button>
              {menu && (
                <div className="fade-in absolute left-0 top-14 z-10 w-80 overflow-hidden rounded-xl bg-surface py-2 shadow-[0_8px_28px_rgba(0,0,0,.18)] ring-1 ring-line">
                  <MenuItem icon={<Link2 size={20} />} label="Create a space for later" onClick={copyLink} />
                  <MenuItem icon={<Plus size={20} />} label="Start an instant space" onClick={start} />
                </div>
              )}
            </div>

            <form onSubmit={join} className="flex items-center gap-3">
              <label className="flex h-12 items-center gap-2 rounded-full border border-line px-3 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand">
                <Keyboard size={20} className="text-muted" />
                <input
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="Paste a code or link"
                  className="w-44 bg-transparent text-base outline-none placeholder:text-muted"
                  aria-label="Meeting code or link"
                />
              </label>
              <button
                type="submit"
                disabled={!code.trim()}
                className="text-base font-medium text-brand disabled:cursor-not-allowed disabled:text-muted/60"
              >
                Join
              </button>
              <span className="group relative hidden sm:block">
                <Info size={18} className="cursor-help text-muted" aria-label="Meeting code format" />
                <span className="pointer-events-none absolute left-1/2 top-7 z-10 w-64 -translate-x-1/2 rounded-md bg-ink px-3 py-2 text-xs text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                  Use the code at the end of a space link. It looks like: abc-defg-hjk
                </span>
              </span>
            </form>
          </div>

          <hr className="my-8 border-line" />
          <p className="text-sm text-muted">
            Built by <a className="font-medium text-brand hover:underline" href="https://github.com/codeofelango" target="_blank" rel="noreferrer">codeofelango</a>. Open source, no account required.
          </p>
        </section>

        <section className="fade-in flex flex-col items-center text-center">
          <div className="relative flex items-center">
            <CarouselBtn onClick={() => setSlide((slide + slides.length - 1) % slides.length)} label="Previous">
              <ChevronLeft size={22} />
            </CarouselBtn>
            <div className="mx-2 w-[520px] max-w-[70vw]">
              {slide === 0 ? <HeroCall /> : (
                <div className="mx-auto flex h-64 w-64 items-center justify-center rounded-full bg-surface-2 sm:h-80 sm:w-80">
                  <div className="flex h-40 w-40 items-center justify-center rounded-full bg-white shadow-sm sm:h-48 sm:w-48">
                    <Icon size={72} className="text-brand" strokeWidth={1.5} />
                  </div>
                </div>
              )}
            </div>
            <CarouselBtn onClick={() => setSlide((slide + 1) % slides.length)} label="Next">
              <ChevronRight size={22} />
            </CarouselBtn>
          </div>
          <h2 className="mt-8 text-2xl font-normal text-ink">{slides[slide].title}</h2>
          <p className="mt-2 max-w-sm text-base text-muted">{slides[slide].body}</p>
          <div className="mt-6 flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                aria-label={`Slide ${i + 1}`}
                onClick={() => setSlide(i)}
                className={`h-2 w-2 rounded-full transition ${i === slide ? 'bg-brand' : 'bg-line'}`}
              />
            ))}
          </div>
        </section>
      </main>

      <footer className="flex flex-wrap items-center justify-center gap-6 px-6 py-6 text-sm text-muted">
        <span className="flex items-center gap-1.5"><Users size={16} /> Rooms for up to 100</span>
        <span className="flex items-center gap-1.5"><Share2 size={16} /> Screen sharing</span>
        <span className="flex items-center gap-1.5"><ShieldCheck size={16} /> Encrypted in transit</span>
        <span className="w-full text-center text-xs text-muted/70 sm:w-auto">© {now.getFullYear()} OwnSpace</span>
      </footer>

      {toast && (
        <div className="fade-in fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-ink px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 px-4 py-3 text-left text-base text-ink transition hover:bg-surface-2"
    >
      <span className="text-muted">{icon}</span>
      {label}
    </button>
  )
}

function CarouselBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="rounded-full p-2 text-muted transition hover:bg-surface-2">
      {children}
    </button>
  )
}

/** Illustrative call composite: a large tile with two stacked small tiles and a control bar. */
function HeroCall() {
  const tiles = [
    { name: 'Priya Natarajan', color: '#6d4aff', big: true },
    { name: 'Leo Martins', color: '#14b8a6' },
    { name: 'Hana Sato', color: '#f59e0b' },
  ]
  return (
    <div className="relative mx-auto aspect-[4/3] w-full">
      <div className="absolute -inset-6 rounded-full bg-brand/10 blur-3xl" />
      <div className="absolute left-0 top-[12%] h-[70%] w-[68%] overflow-hidden rounded-2xl bg-[#ece8ff] shadow-xl ring-1 ring-black/5">
        <TileArt {...tiles[0]} />
        <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
          {[Mic, Cam, MonitorUp, Hand].map((I, i) => (
            <span key={i} className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"><I size={12} /></span>
          ))}
          <span className="flex h-6 w-8 items-center justify-center rounded-full bg-danger text-white"><PhoneOff size={12} /></span>
        </div>
      </div>
      <div className="absolute right-0 top-0 h-[42%] w-[36%] overflow-hidden rounded-2xl bg-[#e0f7f3] shadow-xl ring-1 ring-black/5">
        <TileArt {...tiles[1]} />
      </div>
      <div className="absolute bottom-0 right-0 h-[42%] w-[36%] overflow-hidden rounded-2xl bg-[#fff3df] shadow-xl ring-1 ring-black/5">
        <TileArt {...tiles[2]} />
      </div>
    </div>
  )
}

function TileArt({ name, color, big }: { name: string; color: string; big?: boolean }) {
  return (
    <>
      <div className="flex h-full w-full items-center justify-center">
        <Avatar name={name} color={color} size={big ? 84 : 44} />
      </div>
      <span className="absolute bottom-2 left-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white">{name}</span>
    </>
  )
}
