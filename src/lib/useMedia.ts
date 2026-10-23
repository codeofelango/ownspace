import { useCallback, useEffect, useRef, useState } from 'react'

export type Devices = { mics: MediaDeviceInfo[]; cams: MediaDeviceInfo[]; speakers: MediaDeviceInfo[] }

const MIC_KEY = 'ownspace.mic'
const CAM_KEY = 'ownspace.cam'
const read = (k: string) => {
  try {
    return localStorage.getItem(k) ?? ''
  } catch {
    return ''
  }
}
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* storage blocked */
  }
}

/**
 * Owns the local camera + mic stream, exposes mute / camera toggles and device selection.
 * Falls back to audio-only when no camera is available, so a user can still speak and listen.
 */
export function useMedia(initial = { cam: true, mic: true }) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  const [error, setError] = useState<string | null>(supported ? null : 'This browser does not support camera or microphone access')
  const [cam, setCam] = useState(initial.cam)
  const [mic, setMic] = useState(initial.mic)
  const [micId, setMicIdState] = useState(() => read(MIC_KEY))
  const [camId, setCamIdState] = useState(() => read(CAM_KEY))
  const [devices, setDevices] = useState<Devices>({ mics: [], cams: [], speakers: [] })
  const streamRef = useRef<MediaStream | null>(null)

  const refreshDevices = useCallback(async () => {
    if (!supported) return
    const all = await navigator.mediaDevices.enumerateDevices()
    setDevices({
      mics: all.filter(d => d.kind === 'audioinput'),
      cams: all.filter(d => d.kind === 'videoinput'),
      speakers: all.filter(d => d.kind === 'audiooutput'),
    })
  }, [supported])

  useEffect(() => {
    if (!supported) return
    let cancelled = false
    const audio: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    if (micId) audio.deviceId = { ideal: micId }
    const video: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 } }
    if (camId) video.deviceId = { ideal: camId }

    const acquire = async () => {
      try {
        return await navigator.mediaDevices.getUserMedia({ video, audio })
      } catch (e) {
        // No camera, or camera busy: still try to get the microphone so the user can talk.
        const name = e instanceof DOMException ? e.name : ''
        if (name === 'NotFoundError' || name === 'NotReadableError' || name === 'OverconstrainedError') {
          const s = await navigator.mediaDevices.getUserMedia({ audio })
          setError('No camera found. Joining with microphone only.')
          return s
        }
        throw e
      }
    }

    acquire()
      .then(s => {
        if (cancelled) {
          s.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = s
        setStream(s)
        void refreshDevices()
      })
      .catch(e => {
        const name = e instanceof DOMException ? e.name : ''
        setError(
          name === 'NotAllowedError'
            ? 'Microphone and camera access was blocked. Allow access in the browser address bar and reload.'
            : e instanceof Error ? e.message : 'Microphone unavailable',
        )
      })
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      setStream(null)
    }
  }, [supported, micId, camId, refreshDevices])

  useEffect(() => {
    if (!supported) return
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices)
    return () => navigator.mediaDevices.removeEventListener('devicechange', refreshDevices)
  }, [supported, refreshDevices])

  useEffect(() => {
    stream?.getVideoTracks().forEach(t => (t.enabled = cam))
  }, [stream, cam])
  useEffect(() => {
    stream?.getAudioTracks().forEach(t => (t.enabled = mic))
  }, [stream, mic])

  const toggleCam = useCallback(() => setCam(c => !c), [])
  const toggleMic = useCallback(() => setMic(m => !m), [])
  const setMicId = useCallback((id: string) => {
    write(MIC_KEY, id)
    setMicIdState(id)
  }, [])
  const setCamId = useCallback((id: string) => {
    write(CAM_KEY, id)
    setCamIdState(id)
  }, [])

  const hasVideo = !!stream && stream.getVideoTracks().length > 0

  return { stream, error, cam, mic, hasVideo, toggleCam, toggleMic, setCam, setMic, devices, micId, camId, setMicId, setCamId }
}
