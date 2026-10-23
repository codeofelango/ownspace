export const AUDIO_BLOCKED_EVENT = 'ownspace:audio-blocked'

/** Call from a user gesture to start every remote audio element the browser refused to autoplay. */
export const unlockAudio = () => {
  document.querySelectorAll<HTMLMediaElement>('audio[data-remote]').forEach(a => void a.play().catch(() => undefined))
}
