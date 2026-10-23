# OwnSpace

Your space to meet, build and ship together. A browser-native, peer-to-peer video meeting app with instant rooms and no installs.

Live: https://ownspace-nu.vercel.app

## How it works

- **Media** travels directly between participants over WebRTC (full mesh, encrypted with DTLS-SRTP).
- **Signalling** uses PeerJS. The first participant in a room claims a deterministic "beacon" peer id derived from the room code. Later joiners connect to the beacon, receive the roster, and dial everyone directly. If the beacon leaves, the remaining participants re-claim it, so newcomers can still find the room.
- **Chat, reactions, mic/camera/hand/screen state** travel on WebRTC data channels.
- **Screen share** swaps the outgoing video track on every live peer connection.
- **Active speaker** highlighting is real voice-activity detection with an AnalyserNode.

Nothing is simulated. Every participant you see is a real browser connected to the room.

## Stack

- React 19 + TypeScript, built with Vite
- Tailwind CSS v4 (design tokens in `src/index.css`)
- React Router for `/`, `/:code/lobby`, `/:code`
- PeerJS (WebRTC signalling) and the browser WebRTC APIs
- lucide-react icons

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
```

## Configuration

By default the app uses the public PeerJS signalling server. To use your own [PeerServer](https://github.com/peers/peerjs-server), set:

```
VITE_PEER_HOST=peer.example.com
VITE_PEER_PORT=443
VITE_PEER_PATH=/
```

## Limitations

- Full mesh scales comfortably to roughly 6 to 8 participants; beyond that an SFU (for example LiveKit or mediasoup) is the right architecture.
- No TURN server is configured, so peers behind strict symmetric NATs may fail to connect. Add TURN credentials to the PeerJS `config` option if you need that.
- The public PeerJS server is best-effort. Self-host for production reliability.
