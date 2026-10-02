# Animovi

A web-based VTubing app. It tracks your face, upper body, and hands through a camera and animates a VRM avatar in real time.

> **Warning:** Claude Code wrote all of the code in this app, and the author has not read it. If you find code that uses copyrighted material inappropriately, or any other bug, please [open an issue](https://github.com/motoki317/animovi/issues).

## Features

- **Face tracking**: head rotation, eye gaze, blinks, and mouth open and smile.
- **Upper-body tracking** (the Pose Tracking setting): spine lean and turn, a 3-axis shoulder, and a hinged elbow for each arm.
- **Hand tracking**: wrist rotation, and curl and spread for each finger. It is off by default. Turn it on in the settings panel. Wrist rotation also needs Pose Tracking.
- **VRM 0.x and 1.x models**: import a `.vrm` or `.glb` file. The app stores up to 10 models in the browser and loads the last-used one on startup. When you import an 11th model, the app deletes the least recently used one.
- **Smoothing**: an exponential moving average reduces jitter. The setting runs from 0 (off) to 0.9 (strongest). Eyes and mouth use a fixed, faster rate.
- **Frame-rate limits**: tracking at 10-60 fps and drawing at 15-120 fps.
- **Backgrounds**: a solid color, transparent (for an OBS browser source), or an image. The app does not keep the image across reloads. After a reload, it shows the solid color until you choose an image again.
- **Performance overlay**: time per pipeline stage, frame rate, draw calls, triangles, and textures.
- **PWA**: you can install the app. After one online visit, the page loads offline, but tracking needs a network connection, because the MediaPipe runtime and models load from a CDN. The service worker registers only in a production build (`npm run build`, then `npm start`).

## Getting started

```bash
npm install
npm run dev
```

1. Open http://localhost:3000 and allow camera access.
2. In the settings panel, click **Import VRM** and select a `.vrm` or `.glb` file. The app has no default avatar.

The app needs WebGL2 and camera access (`getUserMedia`). If the browser lacks either one, the app shows "Browser Not Supported".

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| H | Show or hide the settings panel |
| D | Show or hide the tracking debug overlay |
| S | Show or hide the stick-figure overlay (raw tracking next to the applied bone rotations) |
| P | Show or hide the performance overlay |

## Development

```bash
npm run dev          # Dev server
npm test             # Unit tests (Vitest)
npm run test:watch   # Unit tests in watch mode
npm run typecheck    # Type-check everything, including tests (next build skips test files)
npm run test:e2e     # End-to-end tests (Playwright) against a dev server on port 3000
npm run build        # Production build
npm start            # Serve the production build
```

Write a failing test before you change behavior. Unit tests sit next to their source (`foo.ts` and `foo.test.ts`). End-to-end tests are in `tests/e2e/`.

To check the app in a browser without a camera, see [docs/browser-testing.md](docs/browser-testing.md). For the library choices, the left-right convention, and performance measurements, see [docs/architecture.md](docs/architecture.md).

## Architecture

```
Main thread                                    Web Worker
───────────                                    ──────────
<video> (camera)
   │ createImageBitmap()
   └──────────── postMessage ─────────────────► MediaPipe Holistic Landmarker
                                                (Face Landmarker if Pose and Hand Tracking are off)
                                                   │ landmarks
                                                   ▼
                                                solveHolistic(): bone rotations
                                                and expression weights
TrackingBridge ◄──────── postMessage ─────────────┘
   │ smoothing, then writes VRM bones and expressions
   ▼
AvatarScene render loop (Three.js + three-vrm)
```

If the worker does not start within 15 seconds, or fails later, the same pipeline runs on the main thread. Settings persist in `localStorage`, and imported VRMs persist in IndexedDB.

## Acknowledgments

- [VRM Studio](https://github.com/vucinatim/vrm-studio): architecture reference for VRM and MediaPipe integration
- [KalidoKit](https://github.com/yeemachine/kalidokit) (MIT): the idea of computing bone rotations directly from landmark directions instead of inverse kinematics
- [Wawa Sensei tutorial](https://wawasensei.dev/tuto/vrm-avatar-with-threejs-react-three-fiber-and-mediapipe): learning resource
- [Three.js](https://github.com/mrdoob/three.js) (MIT): quaternion-to-Euler math reference
- [MediaPipe](https://github.com/google-ai-edge/mediapipe) (Apache-2.0): face, pose, and hand landmark detection
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) (MIT): VRM loading and rendering

## License

[MIT](./LICENSE)
