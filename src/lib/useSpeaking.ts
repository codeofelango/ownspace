import { useEffect, useState } from 'react'

/** Real voice-activity detection: samples the stream's audio level with an AnalyserNode. */
export function useSpeaking(stream: MediaStream | null | undefined, enabled = true, threshold = 0.04) {
  const [speaking, setSpeaking] = useState(false)
  const active = !!stream && enabled && stream.getAudioTracks().length > 0

  useEffect(() => {
    if (!stream || !active) return
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const src = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    src.connect(analyser)
    const buf = new Uint8Array(analyser.fftSize)
    let last = false
    const timer = setInterval(() => {
      analyser.getByteTimeDomainData(buf)
      let sum = 0
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / buf.length)
      const now = rms > threshold
      if (now !== last) {
        last = now
        setSpeaking(now)
      }
    }, 150)
    return () => {
      clearInterval(timer)
      src.disconnect()
      void ctx.close()
    }
  }, [stream, active, threshold])

  return speaking && active
}
