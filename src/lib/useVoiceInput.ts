import { useCallback, useEffect, useRef, useState } from 'react'
import { transcribe } from './euri'

/**
 * Voice input for talking to the panel.
 *
 * Uses the browser's SpeechRecognition when available (Chrome, Edge, Safari): continuous,
 * free and low-latency. Otherwise it records the microphone with MediaRecorder and sends the
 * clip to EURI's transcription model when you stop.
 */

type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
}
type RecognitionCtor = new () => Recognition

const getCtor = (): RecognitionCtor | undefined => {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

type Options = {
  apiKey: string
  stream: MediaStream | null
  micOn: boolean
  /** Called with a finished utterance. */
  onFinal: (text: string) => void
}

export function useVoiceInput({ apiKey, stream, micOn, onFinal }: Options) {
  const native = !!getCtor()
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<Recognition | null>(null)
  const mrRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const onFinalRef = useRef(onFinal)
  const wantRef = useRef(false)
  useEffect(() => { onFinalRef.current = onFinal }, [onFinal])

  const stop = useCallback(() => {
    wantRef.current = false
    setListening(false)
    setInterim('')
    recRef.current?.stop()
    recRef.current = null
    const mr = mrRef.current
    if (mr && mr.state !== 'inactive') mr.stop()
  }, [])

  const startNative = useCallback(() => {
    const Ctor = getCtor()
    if (!Ctor) return
    const rec = new Ctor()
    rec.lang = navigator.language || 'en-US'
    rec.continuous = true
    rec.interimResults = true
    let finalBuf = ''
    let silence: ReturnType<typeof setTimeout> | undefined
    const flush = () => {
      const t = finalBuf.trim()
      finalBuf = ''
      setInterim('')
      if (t) onFinalRef.current(t)
    }
    rec.onresult = e => {
      let live = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalBuf += r[0].transcript + ' '
        else live += r[0].transcript
      }
      setInterim(live || finalBuf)
      clearTimeout(silence)
      // A short pause after a final result ends the utterance.
      silence = setTimeout(flush, 900)
    }
    rec.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Microphone access for speech recognition was blocked.')
        wantRef.current = false
        setListening(false)
      }
      // 'no-speech' and 'network' restart via onend
    }
    rec.onend = () => {
      clearTimeout(silence)
      flush()
      if (wantRef.current) {
        try { rec.start() } catch { /* already started */ }
      }
    }
    recRef.current = rec
    rec.start()
  }, [])

  const startRecorder = useCallback(() => {
    if (!stream || stream.getAudioTracks().length === 0) {
      setError('No microphone available to record.')
      return
    }
    const audio = new MediaStream(stream.getAudioTracks())
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find(m => MediaRecorder.isTypeSupported(m))
    const mr = new MediaRecorder(audio, mime ? { mimeType: mime } : undefined)
    chunksRef.current = []
    mr.ondataavailable = e => e.data.size && chunksRef.current.push(e.data)
    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mr.mimeType })
      chunksRef.current = []
      if (blob.size < 2000) return
      setTranscribing(true)
      try {
        const text = await transcribe(apiKey, blob)
        if (text.trim()) onFinalRef.current(text.trim())
      } catch (e) {
        setError(`Transcription failed: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        setTranscribing(false)
      }
    }
    mrRef.current = mr
    mr.start()
  }, [stream, apiKey])

  const start = useCallback(() => {
    setError(null)
    if (!micOn) {
      setError('Unmute your microphone first.')
      return
    }
    wantRef.current = true
    setListening(true)
    if (native) startNative()
    else startRecorder()
  }, [micOn, native, startNative, startRecorder])

  const toggle = useCallback(() => (listening ? stop() : start()), [listening, start, stop])

  useEffect(() => () => stop(), [stop])
  useEffect(() => {
    if (micOn) return
    const t = setTimeout(() => { if (wantRef.current) stop() }, 0)
    return () => clearTimeout(t)
  }, [micOn, stop])

  return { native, listening, interim, transcribing, error, start, stop, toggle, clearError: () => setError(null) }
}
