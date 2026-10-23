import { useEffect, useState } from 'react'

/** Real audio level (0..1 RMS) of a stream, sampled with an AnalyserNode. */
export function useAudioLevel(stream: MediaStream | null | undefined, enabled = true) {
  const [level, setLevel] = useState(0)
  const active = !!stream && enabled && stream.getAudioTracks().length > 0

  useEffect(() => {
    if (!stream || !active) return
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    // Contexts start suspended until a user gesture in some browsers; resume on the next interaction.
    const resume = () => void ctx.resume()
    if (ctx.state === 'suspended') {
      void ctx.resume()
      document.addEventListener('pointerdown', resume, { once: true })
      document.addEventListener('keydown', resume, { once: true })
    }
    const src = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    src.connect(analyser)
    const buf = new Uint8Array(analyser.fftSize)
    let last = -1
    const timer = setInterval(() => {
      analyser.getByteTimeDomainData(buf)
      let sum = 0
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.min(1, Math.sqrt(sum / buf.length) * 4)
      const q = Math.round(rms * 20) / 20 // quantise to avoid re-rendering on noise
      if (q !== last) {
        last = q
        setLevel(q)
      }
    }, 120)
    return () => {
      clearInterval(timer)
      document.removeEventListener('pointerdown', resume)
      document.removeEventListener('keydown', resume)
      src.disconnect()
      void ctx.close()
    }
  }, [stream, active])

  return active ? level : 0
}

/** Real voice-activity detection built on the audio level. */
export function useSpeaking(stream: MediaStream | null | undefined, enabled = true, threshold = 0.15) {
  return useAudioLevel(stream, enabled) > threshold
}
