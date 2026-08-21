# Animovi Development Plan

Internal reference for architecture decisions and implementation history.

## Technology Rationale

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js App Router | Proven by VRM Studio, SSR-capable, Turbopack |
| 3D | Three.js + @pixiv/three-vrm | Lighter than Babylon, native VRM support |
| Tracking | @mediapipe/tasks-vision | Modern API, single holistic pipeline |
| Solver | Custom (KalidoKit-style) | KalidoKit deprecated, direct vector-to-euler approach |
| Smoothing | Kalman filter | Adjustable, auto-resets on tracking loss |
| State | Zustand | 3KB, simple, persist middleware |
| Testing | Vitest + RTL | Fast, Vite-native, TDD workflow |

## Key Architecture Decisions

- **Arm solver**: Direct vector-to-euler (3DOF) instead of IK. See `src/lib/math/two-bone-ik.ts`
- **VRM bones**: Normalized bones use ZYX Euler order
- **Coordinate transform**: `toVRMSpace()` flips X (around 0.5) and Y; Z handled by scene PI rotation
- **Settings panel**: CSS overlay (position: absolute, zIndex: 10), not flexbox sibling
- **FPS throttle**: `lastFrameTime = timestamp - (elapsed % frameInterval)` to prevent drift
- **Tracking bridge**: Handles null arms/hands (partial visibility) with default pose fallback
- **Kalman reset**: Filters reset on tracking loss so next detection snaps without lag
- **Zustand persist hydration**: rehydration is async, so async callbacks can capture stale store values — read latest values through refs
- **VRM disposal**: must dispose textures in addition to geometries and materials

## Repo Map

| Module | Location |
|--------|----------|
| Arm math | `src/lib/math/two-bone-ik.ts` (solveArmDirect, clampArmRotation, directionToEulerZYX) |
| Pose solver | `src/lib/solver/pose-solver.ts` (solvePose, solveArm, toVRMSpace) |
| Face solver | `src/lib/solver/face-solver.ts` (solveFace, calculateGaze) |
| Hand solver | `src/lib/solver/hand-solver.ts` (solveHand, calculateFingerSpreads) |
| VRM bridge | `src/lib/vrm/tracking-bridge.ts` (TrackingBridge class) |
| Main page | `src/app/page.tsx` (overlay layout — panel on top of full-window avatar) |
| PWA | `src/lib/pwa/register-sw.ts`, `public/manifest.json`, `public/sw.js` |
| Profiler | `src/lib/perf/pipeline-profiler.ts`, `src/lib/perf/profiler-instances.ts` |
| Perf overlay | `src/components/performance-overlay.tsx` (P key toggle) |
| Browser compat | `src/lib/compat/browser-support.ts` |
| Error pages | `src/app/error.tsx`, `src/app/global-error.tsx` |
| Global errors | `src/lib/error/global-handler.ts`, `src/components/global-error-handler.tsx` |

## Performance Profile

Measured on M4 Max, 640x480 camera input:

| Stage | Time | Notes |
|-------|------|-------|
| MediaPipe inference | ~14ms | 99%+ of tracking time, hardware minimum |
| Solver + Bridge | <0.1ms | Negligible |
| Render (controls + VRM + Three.js) | ~0.6ms | 8-10 draw calls, ~42K triangles |
| **Bundle** | **394KB gz** | Under 500KB target |

## Implementation Phases (All Complete)

| Phase | Summary |
|-------|---------|
| 1-12 | Core pipeline: Kalman filter, solvers, VRM loader, MediaPipe, UI components |
| 13 | Solver improvements: 3DOF arms, eye gaze, finger spread, Kalman reset |
| 13.5 | FPS limits (tracking 10-60, drawing 15-120) + PWA support |
| 14.1 | Profiling instrumentation, FPS throttle fix (34fps->60fps), GPU/memory optimization |
| 14.3 | Bundle analysis: 394KB gzipped |
| 14.4 | Browser feature detection (WebGL2, Camera API, Service Worker) |
| 14.5 | Error pages, global error handler, WebGL context loss handling |

**Total: 317 tests (304 active + 13 legacy skipped) across 39 files**

## References

- [VRM Studio](https://github.com/vucinatim/vrm-studio) - Architectural reference
- [KalidoKit](https://github.com/yeemachine/kalidokit) - Solver approach inspiration
- [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/guide)
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm)
- [Wawa Sensei Tutorial](https://wawasensei.dev/tuto/vrm-avatar-with-threejs-react-three-fiber-and-mediapipe)
