import { chat, MODELS, type ChatMessage } from './euri'

/** One AI participant in the room. */
export type Expert = {
  id: string
  name: string
  role: string
  /** What this expert cares about and how they talk. */
  focus: string
  color: string
  voice: string
}

export type Session = {
  code: string
  topic: string
  /** What the user typed about who should join (kept for reference). */
  wanted: string
  experts: Expert[]
  createdAt: number
}

const VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']
const COLORS = ['#6d4aff', '#14b8a6', '#f59e0b', '#ec4899', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6']

type Preset = Omit<Expert, 'color' | 'voice'>

export const PRESETS: Preset[] = [
  { id: 'strategy', name: 'Maya Lindqvist', role: 'Strategy Expert', focus: 'Market positioning, competitive moats, scenario planning, trade-offs. Thinks in frameworks but speaks plainly and always lands on a recommendation.' },
  { id: 'ceo', name: 'Daniel Okafor', role: 'CEO', focus: 'Vision, priorities, hiring, fundraising, saying no. Decisive, asks the hard commercial question, pushes for a decision and an owner.' },
  { id: 'researcher', name: 'Dr. Aiko Tanaka', role: 'Researcher', focus: 'Evidence, data, studies, what is actually known versus assumed. Flags uncertainty honestly, suggests how to test claims cheaply.' },
  { id: 'cfo', name: 'Priya Raman', role: 'CFO', focus: 'Unit economics, cash runway, pricing, risk. Turns ideas into numbers and asks what it costs and when it pays back.' },
  { id: 'cto', name: 'Lukas Weber', role: 'CTO', focus: 'Architecture, build vs buy, technical risk, team velocity. Pragmatic about what can ship in weeks rather than quarters.' },
  { id: 'marketing', name: 'Sofia Alvarez', role: 'Marketing Lead', focus: 'Positioning, messaging, channels, growth loops, brand. Thinks from the customer\'s point of view.' },
  { id: 'product', name: 'Ethan Brooks', role: 'Product Manager', focus: 'User problems, prioritisation, scope, MVP definition, metrics. Keeps the discussion anchored on who the user is.' },
  { id: 'legal', name: 'Hannah Cohen', role: 'Legal Counsel', focus: 'Contracts, compliance, IP, liability. Points out risk without blocking, proposes the safe path.' },
  { id: 'coach', name: 'Noah Mensah', role: 'Devil\'s Advocate', focus: 'Stress-tests every plan, names the failure modes nobody mentioned, and challenges group-think constructively.' },
]

export const presetToExpert = (p: Preset, i: number): Expert => ({
  ...p,
  color: COLORS[i % COLORS.length],
  voice: VOICES[i % VOICES.length],
})

const SESSION_KEY = (code: string) => `ownspace.session.${code}`
export const loadSession = (code: string): Session | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY(code))
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}
export const saveSession = (s: Session) => {
  try {
    localStorage.setItem(SESSION_KEY(s.code), JSON.stringify(s))
  } catch {
    /* storage blocked */
  }
}

/**
 * Turn a free-text request such as "I need a CEO, a growth marketer and a pricing expert"
 * into a concrete roster. Known preset roles are reused; unknown ones are invented by the model.
 */
export async function resolveRoster(key: string, wanted: string, topic: string, picked: Expert[]): Promise<Expert[]> {
  if (!wanted.trim()) return picked
  const sys: ChatMessage = {
    role: 'system',
    content:
      'You assemble an expert panel for a spoken meeting. Reply ONLY with JSON: {"experts":[{"name":string,"role":string,"focus":string}]}. ' +
      'Each focus is one or two sentences on what that expert cares about and their speaking style. Use realistic, diverse full names. Max 6 experts. ' +
      'If the user names roles that already appear in the "already picked" list, do not duplicate them.',
  }
  const user: ChatMessage = {
    role: 'user',
    content: `Meeting topic: ${topic || '(not given)'}\nAlready picked: ${picked.map(p => p.role).join(', ') || 'none'}\nUser request: ${wanted}`,
  }
  const raw = await chat(key, [sys, user], { model: MODELS.fast, temperature: 0.4, maxTokens: 700, json: true })
  let parsed: { experts?: { name?: string; role?: string; focus?: string }[] } = {}
  try {
    parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
  } catch {
    throw new Error('Could not understand the expert list. Try naming the roles more plainly.')
  }
  const extra: Expert[] = (parsed.experts ?? [])
    .filter(e => e.role)
    .map((e, i) => {
      const preset = PRESETS.find(p => p.role.toLowerCase() === String(e.role).toLowerCase())
      const n = picked.length + i
      return {
        id: (preset?.id ?? String(e.role)).toLowerCase().replace(/[^a-z0-9]+/g, '-') + (preset ? '' : `-${n}`),
        name: e.name || preset?.name || `Expert ${n + 1}`,
        role: String(e.role),
        focus: e.focus || preset?.focus || '',
        color: COLORS[n % COLORS.length],
        voice: VOICES[n % VOICES.length],
      }
    })
    .filter(e => !picked.some(p => p.role.toLowerCase() === e.role.toLowerCase()))
  return [...picked, ...extra].slice(0, 8)
}

export const expertSystemPrompt = (e: Expert, session: Session, humans: string[]) =>
  `You are ${e.name}, the ${e.role} in a live spoken meeting. ${e.focus}\n` +
  `Meeting topic: ${session.topic}\n` +
  `Other experts in the room: ${session.experts.filter(x => x.id !== e.id).map(x => `${x.name} (${x.role})`).join(', ') || 'none'}.\n` +
  `Humans in the room: ${humans.join(', ')}.\n` +
  'Speak as yourself in first person, conversationally, as if talking out loud. Keep each turn short: 2 to 5 sentences, under 90 words. ' +
  'Build on what others said, disagree when you genuinely would, and end with a concrete point or a question when useful. ' +
  'No markdown, no bullet lists, no headings, no stage directions.'

export const moderatorPrompt = (session: Session) =>
  'You are the silent moderator of an expert meeting. Given the transcript and the latest human message, decide which experts should respond next and in what order. ' +
  'Reply ONLY with JSON: {"speakers":[expertId,...]}. Pick 1 to 3. If the human addresses someone by name or role, pick them first. ' +
  'If the human asks "everyone" or "all of you", include all. Prefer whoever has the most relevant expertise and has not spoken most recently.\n' +
  `Experts: ${session.experts.map(e => `${e.id} = ${e.name}, ${e.role}`).join('; ')}`
