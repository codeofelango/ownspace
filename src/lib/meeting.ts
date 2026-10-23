const ALPHA = 'abcdefghijkmnopqrstuvwxyz'
const part = (n: number) =>
  Array.from({ length: n }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('')

/** Generates a code such as "abc-defg-hij". */
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

export const initials = (name: string) =>
  name.trim().split(/\s+/).map(s => s[0] ?? '').slice(0, 2).join('').toUpperCase() || '?'

const NAME_KEY = 'ownspace.name'
export const loadName = () => {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}
export const saveName = (name: string) => {
  try {
    localStorage.setItem(NAME_KEY, name)
  } catch {
    /* storage blocked */
  }
}

/** Stable per-name avatar colour. */
export const colorFor = (name: string) => {
  const palette = ['#6d4aff', '#14b8a6', '#f59e0b', '#ec4899', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6']
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return palette[h % palette.length]
}
