/**
 * Thin client for Euron's EURI gateway (OpenAI-compatible).
 * Base URL: https://api.euron.one/api/v1/euri
 * Auth:     Authorization: Bearer euri-...
 *
 * Euron-hosted models used here are unlimited on the Plus plan:
 *   euri-chat-fast      quick routing / moderation decisions
 *   euri-chat-smart     expert answers
 *   euri-speech         text to speech
 *   euri-transcription  speech to text
 */

/**
 * Requests go through the app's own /api/euri proxy (api/euri/[...path].ts on Vercel,
 * a Vite middleware in dev). The gateway's CORS policy only allows a few origins, and
 * the proxy can hold the key server-side so it never ships to the browser.
 */
export const EURI_BASE = '/api/euri'

/** Sentinel meaning "the server holds the key"; no Authorization header is sent. */
export const PROXY_KEY = 'proxy'

export const MODELS = {
  fast: 'euri-chat-fast',
  smart: 'euri-chat-smart',
  auto: 'euri-auto',
  speech: 'euri-speech',
  transcription: 'euri-transcription',
} as const

const KEY = 'ownspace.euri.key'

let serverHasKey: boolean | null = null
/** Ask the proxy once whether it holds a key. */
export async function serverKeyConfigured(): Promise<boolean> {
  if (serverHasKey !== null) return serverHasKey
  try {
    const r = await fetch(`${EURI_BASE}/health`)
    const j = await r.json()
    serverHasKey = !!j?.configured
  } catch {
    serverHasKey = false
  }
  return serverHasKey
}
export const serverKeyKnown = () => serverHasKey

export const loadKey = () => {
  try {
    return localStorage.getItem(KEY) || ''
  } catch {
    return ''
  }
}
export const saveKey = (k: string) => {
  try {
    if (k) localStorage.setItem(KEY, k.trim())
    else localStorage.removeItem(KEY)
  } catch {
    /* storage blocked */
  }
}
export const looksLikeKey = (k: string) => /^euri-[A-Za-z0-9_-]{8,}$/.test(k.trim())

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export class EuriError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const headers = (key: string, json = true): Record<string, string> => ({
  ...(key && key !== PROXY_KEY ? { Authorization: `Bearer ${key}` } : {}),
  ...(json ? { 'Content-Type': 'application/json' } : {}),
})

const fail = async (res: Response) => {
  let msg = `${res.status} ${res.statusText}`
  try {
    const body = await res.json()
    msg = body?.error?.message ?? body?.error ?? body?.message ?? msg
  } catch {
    /* not json */
  }
  throw new EuriError(res.status, String(msg))
}

/** Non-streaming chat completion. */
export async function chat(
  key: string,
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number; maxTokens?: number; json?: boolean; signal?: AbortSignal } = {},
): Promise<string> {
  const res = await fetch(`${EURI_BASE}/chat/completions`, {
    method: 'POST',
    headers: headers(key),
    signal: opts.signal,
    body: JSON.stringify({
      model: opts.model ?? MODELS.smart,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 600,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  })
  if (!res.ok) await fail(res)
  const data = await res.json()
  return String(data?.choices?.[0]?.message?.content ?? '')
}

/** Streaming chat completion; resolves with the full text once done. */
export async function chatStream(
  key: string,
  messages: ChatMessage[],
  onDelta: (text: string, full: string) => void,
  opts: { model?: string; temperature?: number; maxTokens?: number; signal?: AbortSignal } = {},
): Promise<string> {
  const res = await fetch(`${EURI_BASE}/chat/completions`, {
    method: 'POST',
    headers: headers(key),
    signal: opts.signal,
    body: JSON.stringify({
      model: opts.model ?? MODELS.smart,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 600,
      stream: true,
    }),
  })
  if (!res.ok) await fail(res)
  if (!res.body) throw new EuriError(0, 'Streaming not supported by this browser')

  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let full = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      const t = line.trim()
      if (!t.startsWith('data:')) continue
      const payload = t.slice(5).trim()
      if (payload === '[DONE]') return full
      try {
        const j = JSON.parse(payload)
        const delta: string = j?.choices?.[0]?.delta?.content ?? ''
        if (delta) {
          full += delta
          onDelta(delta, full)
        }
      } catch {
        /* partial frame */
      }
    }
  }
  return full
}

/** Text to speech. Returns a playable Blob (audio/mpeg by default). */
export async function speak(
  key: string,
  text: string,
  opts: { voice?: string; format?: 'mp3' | 'wav' | 'opus'; signal?: AbortSignal } = {},
): Promise<Blob> {
  const res = await fetch(`${EURI_BASE}/audio/speech`, {
    method: 'POST',
    headers: headers(key),
    signal: opts.signal,
    body: JSON.stringify({
      model: MODELS.speech,
      input: text,
      voice: opts.voice ?? 'alloy',
      response_format: opts.format ?? 'mp3',
    }),
  })
  if (!res.ok) await fail(res)
  const ct = res.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) {
    // Some gateways wrap audio as base64 JSON; handle that too.
    const j = await res.json()
    const b64: string | undefined = j?.audio ?? j?.data?.[0]?.b64_json ?? j?.b64_json
    if (!b64) throw new EuriError(res.status, 'Speech response had no audio')
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new Blob([bytes], { type: j?.format ? `audio/${j.format}` : 'audio/mpeg' })
  }
  return await res.blob()
}

/** Speech to text for a recorded audio blob. */
export async function transcribe(key: string, audio: Blob, opts: { signal?: AbortSignal } = {}): Promise<string> {
  const form = new FormData()
  const ext = audio.type.includes('webm') ? 'webm' : audio.type.includes('ogg') ? 'ogg' : audio.type.includes('mp4') ? 'mp4' : 'wav'
  form.append('file', audio, `speech.${ext}`)
  form.append('model', MODELS.transcription)
  form.append('response_format', 'json')
  const res = await fetch(`${EURI_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: headers(key, false),
    body: form,
    signal: opts.signal,
  })
  if (!res.ok) await fail(res)
  const j = await res.json()
  return String(j?.text ?? '')
}

/** Cheap connectivity + key check. */
export async function checkKey(key: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await chat(key, [{ role: 'user', content: 'Reply with the single word: ok' }], { model: MODELS.fast, maxTokens: 5 })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
