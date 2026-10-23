import { useCallback, useEffect, useRef, useState } from 'react'

/** Owns the local camera + mic stream and exposes mute / camera toggles. */
export function useMedia(initial = { cam: true, mic: true }) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  const [error, setError] = useState<string | null>(supported ? null : 'This browser does not support camera access')
  const [cam, setCam] = useState(initial.cam)
  const [mic, setMic] = useState(initial.mic)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!supported) return
    navigator.mediaDevices
      .getUserMedia({ video: { width: 1280, height: 720 }, audio: true })
      .then(s => {
        if (cancelled) {
          s.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = s
        setStream(s)
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Camera unavailable'))
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [supported])

  useEffect(() => {
    stream?.getVideoTracks().forEach(t => (t.enabled = cam))
  }, [stream, cam])
  useEffect(() => {
    stream?.getAudioTracks().forEach(t => (t.enabled = mic))
  }, [stream, mic])

  const toggleCam = useCallback(() => setCam(c => !c), [])
  const toggleMic = useCallback(() => setMic(m => !m), [])

  return { stream, error, cam, mic, toggleCam, toggleMic, setCam, setMic }
}
