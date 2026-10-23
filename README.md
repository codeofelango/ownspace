# OwnSpace

Your space to meet, build and ship together. A browser-native video meeting app with instant rooms and no installs.

## Stack

- React 19 + TypeScript, built with Vite
- Tailwind CSS v4 (design tokens in `src/index.css`)
- React Router for `/`, `/:code/lobby`, `/:code`
- WebRTC `getUserMedia` for real camera and microphone preview
- lucide-react icons

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
```

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Landing page: New meeting menu, join by code or link, feature carousel |
| `/:code/lobby` | Pre-join screen with live camera preview and mic/camera toggles |
| `/:code` | In-call view: video grid, control bar, Meeting details / People / Chat / Activities panels |

## What is real vs simulated

- Camera, microphone, mute and camera-off are real (local device via WebRTC).
- Other participants, the active-speaker highlight and chat are local simulations.
  Multi-party calling needs a signalling server plus peer connections (for example
  a Node + Socket.IO or LiveKit backend), which is the next step.
