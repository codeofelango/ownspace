import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { chat, chatStream, speak, MODELS, type ChatMessage } from './euri'
import { expertSystemPrompt, moderatorPrompt, type Expert, type Session } from './experts'
import { AUDIO_BLOCKED_EVENT } from './audioUnlock'

/**
 * Multi-agent orchestrator for an expert panel.
 *
 * Flow for every human message:
 *   1. moderator (euri-chat-fast) picks 1..3 experts to answer, in order
 *   2. each expert answers in turn (euri-chat-smart, streamed) with the whole transcript as context
 *   3. the answer is voiced (euri-speech) and the next expert waits until it finishes
 *
 * Every step is mirrored to the other humans in the room through `send`, so all browsers
 * show the same transcript and the same "who is speaking" state. The browser that sent the
 * human message runs the agents with its own API key.
 */

export type Speaker = { kind: 'human'; id: string; name: string } | { kind: 'expert'; id: string; name: string; role: string }
export type Turn = { id: string; speaker: Speaker; text: string; at: number; done: boolean }

export type PanelEvent =
  | { kind: 'session'; session: Session }
  | { kind: 'turn'; turn: Turn }
  | { kind: 'delta'; id: string; text: string }
  | { kind: 'done'; id: string }
  | { kind: 'active'; expertId: string | null }
  | { kind: 'status'; status: Status }

export type Status = 'idle' | 'thinking' | 'speaking'

type Options = {
  apiKey: string
  session: Session | null
  selfName: string
  humans: string[]
  voiceOn: boolean
  send: (ev: PanelEvent) => void
}

const uid = () => Math.random().toString(36).slice(2, 10)

export function usePanel({ apiKey, session, selfName, humans, voiceOn, send }: Options) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const turnsRef = useRef<Turn[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const voiceRef = useRef(voiceOn)
  const humansRef = useRef(humans)
  useEffect(() => {
    voiceRef.current = voiceOn
    humansRef.current = humans
  }, [voiceOn, humans])

  const patchTurns = useCallback((fn: (t: Turn[]) => Turn[]) => {
    turnsRef.current = fn(turnsRef.current)
    setTurns(turnsRef.current)
  }, [])

  const addTurn = useCallback((turn: Turn) => patchTurns(t => (t.some(x => x.id === turn.id) ? t : [...t, turn])), [patchTurns])
  const appendDelta = useCallback(
    (id: string, text: string) => patchTurns(t => t.map(x => (x.id === id ? { ...x, text: x.text + text } : x))),
    [patchTurns],
  )
  const finishTurn = useCallback((id: string, text?: string) => patchTurns(t => t.map(x => (x.id === id ? { ...x, text: text ?? x.text, done: true } : x))), [patchTurns])

  /** Apply an event that another participant produced. */
  const receive = useCallback(
    (ev: PanelEvent) => {
      switch (ev.kind) {
        case 'turn':
          addTurn(ev.turn)
          break
        case 'delta':
          appendDelta(ev.id, ev.text)
          break
        case 'done':
          finishTurn(ev.id)
          break
        case 'active':
          setActiveId(ev.expertId)
          break
        case 'status':
          setStatus(ev.status)
          break
        case 'session':
          break
      }
    },
    [addTurn, appendDelta, finishTurn],
  )

  const setActive = useCallback((id: string | null) => {
    setActiveId(id)
    send({ kind: 'active', expertId: id })
  }, [send])
  const setStat = useCallback((s: Status) => {
    setStatus(s)
    send({ kind: 'status', status: s })
  }, [send])

  const stopAudio = useCallback(() => {
    const a = audioRef.current
    if (a) {
      a.pause()
      a.src = ''
      audioRef.current = null
    }
  }, [])

  const play = useCallback((blob: Blob, signal: AbortSignal) =>
    new Promise<void>(resolve => {
      const url = URL.createObjectURL(blob)
      const a = new Audio(url)
      a.setAttribute('data-remote', '')
      audioRef.current = a
      const end = () => {
        URL.revokeObjectURL(url)
        if (audioRef.current === a) audioRef.current = null
        resolve()
      }
      a.onended = end
      a.onerror = end
      signal.addEventListener('abort', () => { a.pause(); end() }, { once: true })
      a.play().catch(() => {
        window.dispatchEvent(new Event(AUDIO_BLOCKED_EVENT))
        end()
      })
    }), [])

  const transcriptFor = (viewer: Expert): ChatMessage[] =>
    turnsRef.current.slice(-24).map(t => ({
      role: t.speaker.kind === 'expert' && t.speaker.id === viewer.id ? 'assistant' : 'user',
      content: t.speaker.kind === 'expert' && t.speaker.id === viewer.id ? t.text : `${t.speaker.name}${t.speaker.kind === 'expert' ? ` (${t.speaker.role})` : ''}: ${t.text}`,
    }))

  const pickSpeakers = async (s: Session, latest: string, signal: AbortSignal): Promise<Expert[]> => {
    if (s.experts.length === 1) return s.experts
    const transcript = turnsRef.current.slice(-12).map(t => `${t.speaker.name}: ${t.text}`).join('\n')
    try {
      const raw = await chat(
        apiKey,
        [
          { role: 'system', content: moderatorPrompt(s) },
          { role: 'user', content: `Transcript:\n${transcript}\n\nLatest human message: ${latest}` },
        ],
        { model: MODELS.fast, temperature: 0, maxTokens: 80, json: true, signal },
      )
      const j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as { speakers?: string[] }
      const ids = (j.speakers ?? []).map(String)
      const chosen = ids.map(id => s.experts.find(e => e.id === id || e.role.toLowerCase() === id.toLowerCase())).filter((e): e is Expert => !!e)
      if (chosen.length) return chosen.slice(0, 3)
    } catch (e) {
      if (signal.aborted) throw e
    }
    // Fallback: name/role mention, else round robin from whoever spoke least recently.
    const lower = latest.toLowerCase()
    const named = s.experts.filter(e => lower.includes(e.name.split(' ')[0].toLowerCase()) || lower.includes(e.role.toLowerCase()))
    if (named.length) return named.slice(0, 3)
    const lastSpoke = new Map<string, number>()
    turnsRef.current.forEach((t, i) => t.speaker.kind === 'expert' && lastSpoke.set(t.speaker.id, i))
    return [...s.experts].sort((a, b) => (lastSpoke.get(a.id) ?? -1) - (lastSpoke.get(b.id) ?? -1)).slice(0, 1)
  }

  /** Send a human message to the panel and run the agents. */
  const ask = useCallback(
    async (text: string) => {
      const s = session
      const t = text.trim()
      if (!s || !t) return
      if (!apiKey) {
        setError('Add your EURI API key in the lobby to talk with the experts.')
        return
      }
      abortRef.current?.abort()
      stopAudio()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setError(null)

      const human: Turn = { id: uid(), speaker: { kind: 'human', id: 'self', name: selfName }, text: t, at: Date.now(), done: true }
      addTurn(human)
      send({ kind: 'turn', turn: human })
      setStat('thinking')

      try {
        const speakers = await pickSpeakers(s, t, ctrl.signal)
        for (const e of speakers) {
          if (ctrl.signal.aborted) return
          setStat('thinking')
          const turn: Turn = { id: uid(), speaker: { kind: 'expert', id: e.id, name: e.name, role: e.role }, text: '', at: Date.now(), done: false }
          addTurn(turn)
          send({ kind: 'turn', turn })
          setActive(e.id)
          const msgs: ChatMessage[] = [{ role: 'system', content: expertSystemPrompt(e, s, humansRef.current) }, ...transcriptFor(e)]
          const full = await chatStream(
            apiKey,
            msgs,
            delta => {
              appendDelta(turn.id, delta)
              send({ kind: 'delta', id: turn.id, text: delta })
            },
            { model: MODELS.smart, temperature: 0.8, maxTokens: 220, signal: ctrl.signal },
          )
          finishTurn(turn.id, full)
          send({ kind: 'done', id: turn.id })
          if (voiceRef.current && full.trim()) {
            setStat('speaking')
            try {
              const blob = await speak(apiKey, full, { voice: e.voice, signal: ctrl.signal })
              if (!ctrl.signal.aborted) await play(blob, ctrl.signal)
            } catch (err) {
              if (ctrl.signal.aborted) return
              setError(`Voice failed: ${err instanceof Error ? err.message : String(err)}`)
            }
          }
        }
      } catch (err) {
        if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (abortRef.current === ctrl) {
          setActive(null)
          setStat('idle')
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apiKey, session, selfName, send, addTurn, appendDelta, finishTurn, setActive, setStat, play, stopAudio],
  )

  /** Interrupt whatever the experts are doing. */
  const interrupt = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    stopAudio()
    patchTurns(t => t.map(x => (x.done ? x : { ...x, done: true })))
    setActive(null)
    setStat('idle')
  }, [stopAudio, patchTurns, setActive, setStat])

  useEffect(() => () => { abortRef.current?.abort(); stopAudio() }, [stopAudio])

  const busy = status !== 'idle'
  return useMemo(() => ({ turns, status, busy, activeId, error, ask, interrupt, receive, clearError: () => setError(null) }), [turns, status, busy, activeId, error, ask, interrupt, receive])
}
