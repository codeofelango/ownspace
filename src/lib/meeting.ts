const ALPHA = 'abcdefghijkmnopqrstuvwxyz'
const part = (n: number) =>
  Array.from({ length: n }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('')

/** Generates a Meet-style code such as "abc-defg-hij". */
export const newMeetingCode = () => `${part(3)}-${part(4)}-${part(3)}`

/** Accepts a raw code or a full link and returns the code portion. */
export const parseCode = (input: string) => {
  const trimmed = input.trim()
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed)
    return url.pathname.replace(/^\/+|\/+$/g, '').replace(/\/lobby$/, '')
  } catch {
    return trimmed.replace(/\s+/g, '').toLowerCase()
  }
}

export type Participant = { id: string; name: string; color: string; micOn: boolean }

export const participantsSeed: Participant[] = [
  { id: 'p1', name: 'Priya Natarajan', color: '#6d4aff', micOn: true },
  { id: 'p2', name: 'Leo Martins', color: '#14b8a6', micOn: false },
  { id: 'p3', name: 'Hana Sato', color: '#f59e0b', micOn: true },
  { id: 'p4', name: 'Omar Haddad', color: '#ec4899', micOn: true },
]

export const initials = (name: string) =>
  name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()
