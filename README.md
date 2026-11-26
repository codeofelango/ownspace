# OwnSpace

A browser-native meeting room where AI experts join you as participants. Tell it what you want to discuss and who should be there (a Strategy Expert, a CEO, a Researcher, or describe anyone), then talk to them out loud. Real people can join the same room over peer-to-peer video.

Live: https://ownspace-nu.vercel.app

## Expert panel (multi-agent)

- **Setup** happens in the lobby: topic, a pick-list of preset roles, and a free-text line such as "a growth marketer and a sceptical investor". Free text is turned into a roster by `euri-chat-fast`.
- **Moderator**: for every human message a small routing call picks 1 to 3 experts to answer and in what order (name or role mentions win; "everyone" includes all).
- **Experts** answer one after another with `euri-chat-smart`, streamed into their tile and the transcript, each with the full conversation as context and its own persona prompt.
- **Voice**: each answer is spoken with `euri-speech`; the speaking expert's tile pulses. Mute expert voices with the speaker button.
- **Listening**: the "Talk to panel" button uses the browser's SpeechRecognition (Chrome, Edge, Safari). Browsers without it record your mic and transcribe with `euri-transcription` when you press again.
- **Shared**: the roster, every turn and the speaking state are mirrored over the WebRTC data channel, so everyone in the room sees the same panel. Whoever sends a message runs the agents with their own key.

All models are Euron-hosted and unlimited on the Euron Plus plan. Requests go through the app's own `/api/euri` proxy (`api/euri/[...path].ts` on Vercel, a Vite middleware in dev) because the gateway's CORS policy only allows a few origins. Set `EURI_API_KEY` as a private environment variable (Vercel project settings, or `.env.local` locally) and the key never reaches the browser; the lobby then hides the key field. Without it, each person pastes their own key in the lobby, stored only in their browser.

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
