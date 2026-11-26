import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import Peer, { type DataConnection, type MediaConnection } from 'peerjs'

/**
 * Real peer-to-peer room built on WebRTC (PeerJS for signalling).
 *
 * Discovery: the first participant claims a deterministic "beacon" peer id derived
 * from the room code. Everyone else connects to the beacon, receives the current
 * roster, and dials each participant directly (full mesh). If the beacon leaves,
 * remaining participants race to re-claim it so later joiners can still find the room.
 *
 * Media flows peer-to-peer on MediaConnections. Chat, reactions and mic/cam/hand/screen
 * state flow on DataConnections. Nothing here is simulated.
 */

export type PeerState = { mic: boolean; cam: boolean; hand: boolean; screen: boolean }
export type LocalState = { mic: boolean; cam: boolean; hand: boolean }
export type RemotePeer = PeerState & { id: string; name: string; stream?: MediaStream }
export type ChatMsg = { id: string; from: string; text: string; at: number; own: boolean }
export type Reaction = { id: string; from: string; emoji: string }

type Wire =
  | { type: 'hello'; id: string; name: string }
  | { type: 'peers'; peers: { id: string; name: string }[] }
  | { type: 'intro'; name: string; state: PeerState }
  | { type: 'state'; state: PeerState }
  | { type: 'chat'; text: string; at: number }
  | { type: 'reaction'; emoji: string }
  | { type: 'callme' }
  | { type: 'panel'; ev: unknown }

type Options = {
  code: string
  name: string
  stream: MediaStream | null
  /** true once the local camera/mic attempt has settled (success or failure) */
  mediaReady: boolean
  state: LocalState
  /** Application-level messages (expert panel events) from a peer. */
  onPanel?: (ev: unknown, from: string) => void
  /** A peer finished its handshake; safe to send it application messages. */
  onPeerReady?: (id: string) => void
}

const beaconId = (code: string) => `ownspace-${code.replace(/[^a-z0-9-]/gi, '').toLowerCase()}`
const uid = () => Math.random().toString(36).slice(2, 10)
const log = (...a: unknown[]) => {
  if (import.meta.env.DEV) console.debug('[room]', ...a)
}
const stopTracks = (r: RefObject<MediaStream | null>) => {
  r.current?.getTracks().forEach(t => t.stop())
  r.current = null
}

// PeerJS host can be overridden for a self-hosted PeerServer (VITE_PEER_HOST / VITE_PEER_PORT / VITE_PEER_PATH).
const peerOptions = () => {
  const host = import.meta.env.VITE_PEER_HOST as string | undefined
  return host
    ? { host, port: Number(import.meta.env.VITE_PEER_PORT ?? 443), path: (import.meta.env.VITE_PEER_PATH as string) ?? '/', secure: true }
    : {}
}

export function useRoom({ code, name, stream, mediaReady, state, onPanel, onPeerReady }: Options) {
  const [peers, setPeers] = useState<Record<string, RemotePeer>>({})
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')
  const [error, setError] = useState<string | null>(null)
  const [selfId, setSelfId] = useState<string | null>(null)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)

  const fullState = useMemo<PeerState>(() => ({ ...state, screen: !!screenStream }), [state, screenStream])

  const namesRef = useRef(new Map<string, string>())
  const dataRef = useRef(new Map<string, DataConnection>())
  const callsRef = useRef(new Map<string, MediaConnection>())
  const stateRef = useRef(fullState)
  const nameRef = useRef(name)
  const camStreamRef = useRef<MediaStream | null>(null)
  const outStreamRef = useRef<MediaStream | null>(null) // what we send: camera, or screen + mic
  const screenRef = useRef<MediaStream | null>(null)
  const destroyedRef = useRef(false)
  const onPanelRef = useRef(onPanel)
  const onReadyRef = useRef(onPeerReady)
  useEffect(() => {
    onPanelRef.current = onPanel
    onReadyRef.current = onPeerReady
  }, [onPanel, onPeerReady])

  useEffect(() => {
    stateRef.current = fullState
    nameRef.current = name
    camStreamRef.current = stream
    if (!screenRef.current) outStreamRef.current = stream
  }, [fullState, name, stream])

  const upsert = useCallback((id: string, patch: Partial<RemotePeer>) => {
    if (patch.name) namesRef.current.set(id, patch.name)
    setPeers(p => ({
      ...p,
      [id]: { ...{ name: 'Guest', mic: true, cam: true, hand: false, screen: false }, ...p[id], ...patch, id },
    }))
  }, [])
  const remove = useCallback((id: string) => {
    setPeers(p => {
      const n = { ...p }
      delete n[id]
      return n
    })
  }, [])

  const broadcast = useCallback((msg: Wire) => {
    dataRef.current.forEach(c => {
      if (c.open) c.send(msg)
    })
  }, [])

  // Push state changes to everyone whenever they change.
  useEffect(() => {
    broadcast({ type: 'state', state: fullState })
  }, [fullState, broadcast])

  useEffect(() => {
    if (!mediaReady || !code || !name) return
    destroyedRef.current = false
    const hostId = beaconId(code)
    const peer = new Peer(peerOptions())
    const data = dataRef.current
    const calls = callsRef.current
    const roster = new Map<string, { id: string; name: string }>() // beacon only
    let beacon: Peer | null = null

    const setupCall = (call: MediaConnection) => {
      callsRef.current.get(call.peer)?.close()
      callsRef.current.set(call.peer, call)
      call.on('stream', s => upsert(call.peer, { stream: s }))
      call.on('close', () => {
        if (callsRef.current.get(call.peer) === call) callsRef.current.delete(call.peer)
      })
      call.on('error', () => undefined)
    }

    const callPeer = (id: string) => {
      const out = outStreamRef.current
      if (!out) return
      const call = peer.call(id, out, { metadata: { name: nameRef.current } })
      if (call) setupCall(call)
    }

    const setupData = (c: DataConnection) => {
      c.on('open', () => {
        dataRef.current.set(c.peer, c)
        const meta = c.metadata as { name?: string } | undefined
        upsert(c.peer, { name: meta?.name ?? 'Guest' })
        c.send({ type: 'intro', name: nameRef.current, state: stateRef.current } satisfies Wire)
      })
      c.on('data', raw => {
        const d = raw as Wire
        switch (d.type) {
          case 'intro':
            upsert(c.peer, { name: d.name, ...d.state })
            onReadyRef.current?.(c.peer)
            break
          case 'panel':
            onPanelRef.current?.(d.ev, c.peer)
            break
          case 'state':
            upsert(c.peer, d.state)
            break
          case 'chat':
            setMessages(m => [...m, { id: uid(), from: namesRef.current.get(c.peer) ?? 'Guest', text: d.text, at: d.at, own: false }])
            break
          case 'reaction': {
            const r = { id: uid(), from: namesRef.current.get(c.peer) ?? 'Guest', emoji: d.emoji }
            setReactions(rs => [...rs, r])
            setTimeout(() => setReactions(rs => rs.filter(x => x.id !== r.id)), 3500)
            break
          }
          case 'callme':
            callPeer(c.peer)
            break
        }
      })
      c.on('close', () => {
        dataRef.current.delete(c.peer)
        callsRef.current.get(c.peer)?.close()
        callsRef.current.delete(c.peer)
        remove(c.peer)
      })
      c.on('error', () => undefined)
    }

    const dial = (id: string) => {
      if (id === peer.id || dataRef.current.has(id)) return
      const c = peer.connect(id, { reliable: true, metadata: { name: nameRef.current } })
      setupData(c)
      if (outStreamRef.current) callPeer(id)
      else c.on('open', () => c.send({ type: 'callme' } satisfies Wire))
    }

    let retry: ReturnType<typeof setTimeout> | undefined
    const scheduleClaim = (ms: number) => {
      clearTimeout(retry)
      retry = setTimeout(claimBeacon, ms)
    }

    const connectToBeacon = () => {
      if (destroyedRef.current) return
      log('connecting to beacon')
      const c = peer.connect(hostId, { reliable: true })
      // A stale beacon registration never answers: give up and try to claim it ourselves.
      const stale = setTimeout(() => {
        if (!c.open) {
          log('beacon unresponsive')
          c.close()
          scheduleClaim(500 + Math.random() * 1000)
        }
      }, 6000)
      c.on('open', () => {
        clearTimeout(stale)
        log('beacon connection open')
        c.send({ type: 'hello', id: peer.id, name: nameRef.current } satisfies Wire)
        setStatus('connected')
      })
      c.on('data', raw => {
        const d = raw as Wire
        if (d.type === 'peers') {
          log('roster', d.peers.map(p => p.id))
          d.peers.forEach(p => dial(p.id))
        }
      })
      c.on('close', () => {
        log('beacon connection closed')
        // Beacon left: race to take over discovery duties.
        scheduleClaim(300 + Math.random() * 1500)
      })
      c.on('error', () => scheduleClaim(1500))
    }

    function claimBeacon() {
      if (destroyedRef.current || beacon) return
      log('claiming beacon')
      const b = new Peer(hostId, peerOptions())
      b.on('open', () => {
        log('became beacon')
        if (destroyedRef.current) {
          b.destroy()
          return
        }
        beacon = b
        roster.clear()
        roster.set(peer.id, { id: peer.id, name: nameRef.current })
        // Everyone we already talk to is also in the room.
        data.forEach((_, id) => roster.set(id, { id, name: 'Guest' }))
        setStatus('connected')
        b.on('connection', c => {
          c.on('data', raw => {
            const d = raw as Wire
            if (d.type !== 'hello') return
            c.send({ type: 'peers', peers: [...roster.values()] } satisfies Wire)
            roster.set(d.id, { id: d.id, name: d.name })
            c.on('close', () => roster.delete(d.id))
          })
        })
        b.on('disconnected', () => {
          if (!destroyedRef.current && beacon === b) b.reconnect()
        })
      })
      b.on('error', e => {
        const type = (e as { type?: string }).type
        log('beacon claim error', type)
        if (type === 'unavailable-id') {
          b.destroy()
          connectToBeacon()
        } else if (!destroyedRef.current) {
          b.destroy()
          scheduleClaim(2000)
        }
      })
    }

    peer.on('open', id => {
      setSelfId(id)
      claimBeacon()
    })
    peer.on('connection', setupData)
    peer.on('call', call => {
      call.answer(outStreamRef.current ?? undefined)
      upsert(call.peer, { name: (call.metadata as { name?: string })?.name ?? 'Guest' })
      setupCall(call)
    })
    peer.on('disconnected', () => {
      if (!destroyedRef.current) peer.reconnect()
    })
    peer.on('error', e => {
      const type = (e as { type?: string }).type
      log('peer error', type, e.message)
      if (type === 'peer-unavailable') {
        // Beacon id exists in the server but is not reachable yet; try again.
        if (String(e.message).includes(hostId)) scheduleClaim(1000)
        return
      }
      if (type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'socket-closed') {
        setStatus('error')
        setError('Cannot reach the signalling server. Check your connection and retry.')
        return
      }
      if (type !== 'unavailable-id') {
        setStatus('error')
        setError(e.message)
      }
    })

    return () => {
      destroyedRef.current = true
      clearTimeout(retry)
      calls.forEach(c => c.close())
      data.forEach(c => c.close())
      calls.clear()
      data.clear()
      beacon?.destroy()
      beacon = null
      peer.destroy()
      stopTracks(screenRef)
      setScreenStream(null)
      setPeers({})
      setStatus('connecting')
    }
  }, [code, name, mediaReady, upsert, remove])

  const sendChat = useCallback((text: string) => {
    const at = Date.now()
    broadcast({ type: 'chat', text, at })
    setMessages(m => [...m, { id: uid(), from: 'You', text, at, own: true }])
  }, [broadcast])

  const sendReaction = useCallback((emoji: string) => {
    broadcast({ type: 'reaction', emoji })
    const r = { id: uid(), from: 'You', emoji }
    setReactions(rs => [...rs, r])
    setTimeout(() => setReactions(rs => rs.filter(x => x.id !== r.id)), 3500)
  }, [broadcast])

  const sendPanel = useCallback((ev: unknown) => broadcast({ type: 'panel', ev }), [broadcast])
  const sendPanelTo = useCallback((id: string, ev: unknown) => {
    const c = dataRef.current.get(id)
    if (c?.open) c.send({ type: 'panel', ev } satisfies Wire)
  }, [])

  /** Swap the outgoing video track on every live peer connection. */
  const replaceVideo = useCallback(async (track: MediaStreamTrack | null) => {
    await Promise.all(
      [...callsRef.current.values()].map(async call => {
        const pc = call.peerConnection
        if (!pc) return
        const sender = pc.getSenders().find(s => s.track?.kind === 'video')
        if (sender) await sender.replaceTrack(track).catch(() => undefined)
      }),
    )
  }, [])

  const stopShare = useCallback(async () => {
    const s = screenRef.current
    if (!s) return
    s.getTracks().forEach(t => t.stop())
    screenRef.current = null
    outStreamRef.current = camStreamRef.current
    setScreenStream(null)
    await replaceVideo(camStreamRef.current?.getVideoTracks()[0] ?? null)
  }, [replaceVideo])

  const shareScreen = useCallback(async () => {
    const ds = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
    const track = ds.getVideoTracks()[0]
    screenRef.current = ds
    const audio = camStreamRef.current?.getAudioTracks() ?? []
    outStreamRef.current = new MediaStream([track, ...audio])
    setScreenStream(ds)
    track.addEventListener('ended', () => void stopShare())
    await replaceVideo(track)
  }, [replaceVideo, stopShare])

  return { selfId, peers, messages, reactions, status, error, sendChat, sendReaction, sendPanel, sendPanelTo, shareScreen, stopShare, screenStream }
}
