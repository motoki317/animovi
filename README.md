# Animovi

A lightweight, web-based VTubing application that tracks your face, pose, and hands via camera and animates VRM avatars in real time.

⚠️ Agentic coding alert: This app was fully coded using Claude Code (Opus 4.6), and I human didn't read
a single line of code the agent has written. Please feel free to report any inappropriate copyrighted
code usage or other bugs / issues in general, if you find any.

## Features

- **Face tracking** - Head rotation, eye gaze, and blendshape expressions
- **Pose tracking** - Upper body and arm movements with 3DOF elbow rotation
- **Hand tracking** - Individual finger curl and spread
- **VRM support** - Drag-and-drop any VRM model file
- **Configurable FPS** - Tracking (10-60) and drawing (15-120) limits
- **Background options** - Solid color, transparent (for OBS), or custom image
- **Kalman smoothing** - Adjustable jitter reduction with auto-reset on tracking loss
- **Performance overlay** - Real-time per-stage profiling (P key)
- **PWA** - Install to homescreen, offline-capable
- **Lightweight** - 394KB gzipped bundle, ~0.6ms render time per frame

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000, allow camera access, and optionally drag a `.vrm` file onto the window.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| H | Toggle settings panel |
| D | Toggle tracking debug overlay |
| P | Toggle performance overlay |

## Development

```bash
npm run dev          # Start dev server
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run with coverage
npm run lint         # Lint source
npm run build        # Production build
```

### TDD Workflow

This project follows Test-Driven Development (Red-Green-Refactor):

1. **Red** - Write a failing test that defines the expected behavior
2. **Green** - Write the minimum code to make the test pass
3. **Refactor** - Clean up while keeping tests green

Tests live next to their source files (`foo.ts` / `foo.test.ts`). Run `npm run test:watch` during development to get instant feedback.

```bash
# Run a single test file
npx vitest run src/lib/math/two-bone-ik.test.ts

# Run tests matching a pattern
npx vitest run -t "solveArmDirect"
```

### Project Structure

```
src/
├── app/                    # Next.js App Router (pages, layouts, error pages)
├── components/             # React components (AvatarScene, SettingsPanel, ...)
├── hooks/                  # Custom hooks (useVRMLoader, useVRMTracking, ...)
├── lib/
│   ├── compat/             # Browser feature detection
│   ├── error/              # Global error handler
│   ├── math/               # Euler utils, Kalman filter, arm solver
│   ├── mediapipe/          # MediaPipe HolisticLandmarker wrapper
│   ├── perf/               # PipelineProfiler, PerformanceMonitor
│   ├── pwa/                # Service worker registration
│   ├── solver/             # Face, pose, hand solvers
│   ├── vrm/                # TrackingBridge, VRM animator
│   └── worker/             # Web Worker protocol
├── stores/                 # Zustand stores (settings, tracking)
└── types/                  # Shared TypeScript types
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js (App Router) + TypeScript |
| 3D | Three.js + @pixiv/three-vrm |
| Tracking | MediaPipe Tasks Vision (HolisticLandmarker) |
| State | Zustand |
| Testing | Vitest + React Testing Library |

## Architecture

```
┌─────────────────── Main Thread ───────────────────┐
│  React UI  <-->  Zustand  <-->  Three.js Scene    │
│  (Settings)      (State)       (VRM Render)       │
│                     ^                             │
│               Kalman Filter                       │
│                     | smoothed landmarks          │
└─────────────────────┼─────────────────────────────┘
                      | postMessage
┌─────────────────────┼─────────────────────────────┐
│               Web Worker                          │
│  MediaPipe Holistic -> Custom Solver -> rotations │
└───────────────────────────────────────────────────┘
```

## Acknowledgments

This project was inspired by and references the following:

- [VRM Studio](https://github.com/vucinatim/vrm-studio) - Architectural reference for VRM + MediaPipe integration
- [KalidoKit](https://github.com/yeemachine/kalidokit) (MIT) - Inspired the direct vector-to-euler solver approach
- [Wawa Sensei Tutorial](https://wawasensei.dev/tuto/vrm-avatar-with-threejs-react-three-fiber-and-mediapipe) - Learning resource
- [Three.js](https://github.com/mrdoob/three.js) (MIT) - Quaternion-to-Euler math reference
- [MediaPipe](https://github.com/google-ai-edge/mediapipe) (Apache-2.0) - Face, pose, and hand landmark detection
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) (MIT) - VRM model loading and rendering

## License

[MIT](./LICENSE)
