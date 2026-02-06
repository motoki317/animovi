# VRM-Tuber: Lightweight Web-Based VTubing App

## Project Vision

A lightweight, web-based VTubing application that tracks users via camera and animates VRM avatars. Designed to be lighter than Kalidoface 3D while maintaining smooth, responsive tracking.

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Build | Vite + TypeScript | Fast dev (1.2s cold start), small production builds |
| Framework | Next.js App Router | Proven by VRM Studio, optional SSR |
| 3D | Three.js + @pixiv/three-vrm | Lighter than Babylon, native VRM support |
| Tracking | @mediapipe/tasks-vision | Modern API (replaces deprecated @mediapipe/holistic) |
| Landmark | HolisticLandmarker | Single pipeline for face+pose+hands |
| Solver | Custom (inspired by VRM Studio) | KalidoKit deprecated, no successor |
| Smoothing | Kalman filter | Adjustable jitter reduction |
| State | Zustand | 3KB, simple, proven in VRM Studio |
| Testing | Vitest + React Testing Library | Fast, Vite-native, good DX |

---

## Architecture

```
┌─────────────────── Main Thread ───────────────────┐
│  React UI ◄──► Zustand ◄──► Three.js Scene       │
│  (Settings)    (State)      (VRM Render)          │
│                    ▲                              │
│              Kalman Filter                        │
│                    │ smoothed landmarks           │
└────────────────────┼──────────────────────────────┘
                     │ postMessage
┌────────────────────┼──────────────────────────────┐
│              Web Worker                           │
│  MediaPipe Holistic → Custom Solver → rotations  │
└───────────────────────────────────────────────────┘
```

---

## Implementation Status

| Phase | Status | Tests |
|-------|--------|-------|
| 1-12. Core through UI | Complete | ~246 |
| 13. Solver Improvements | Complete | 26/26 |
| 13.5. FPS Limits + PWA | Complete | 11/11 |
| 14.1 Performance Profiling | Complete | 16/16 |
| **14. Production Readiness** | **In Progress** | TBD |
| **Total** | | **301 tests (288 active + 13 legacy skipped, 35 files)** |

---

## Completed Phases (1-13.5)

<details>
<summary>Click to expand completed phases</summary>

### Phases 1-12: Core through UI
- Project setup, Kalman filter, euler utilities, solvers, Web Worker infra
- VRM loading (GLTF + VRMLoaderPlugin), MediaPipe HolisticLandmarker
- TrackingBridge, PerformanceMonitor, full pipeline integration
- UX: CameraPreview, VRMDropZone, LoadingSkeleton, ErrorBoundary, BackgroundSettings
- UI: Camera position controls, auto-frame, collapsible settings panel (H key), tracking debug overlay (D key)

### Phase 13: Solver Improvements
- Arm tracking: Direct vector-to-euler (3DOF), anatomical clamping, partial visibility
- Tracking inversion fix: face pitch sign, arm Z-axis convention
- Finger spread: MCP→TIP lateral angles, Z rotation on proximal bones
- Eye gaze: Iris-to-socket ratio, yaw/pitch on eye bones
- Kalman filter: Reset on tracking loss, per-feature active flags

### Phase 13.5: FPS Limits + PWA
- Configurable tracking FPS (10-60, default 30) and drawing FPS (15-120, default 60)
- PWA: Service worker (network-first navigation, cache-first assets), web manifest, SVG icons
- Install-to-homescreen support, offline fallback

</details>

---

## Phase 14: Production Readiness

**Goal:** Optimize performance via profiling, then prepare for deployment.

### Step 14.1: Performance Profiling & Optimization ✅

**Approach:** Profile first, optimize second. Never assume bottlenecks.

#### 14.1a: Profiling Instrumentation ✅
- PipelineProfiler utility with per-stage timing, rolling averages, FPS tracking
- Instrumented tracking loop: mediapipe, solver, bridge stages
- Instrumented render loop: controls, vrm_update, render stages
- Real-time performance overlay (toggle with P key) showing per-stage breakdown + GPU info

#### 14.1b: CPU Optimization ✅
- **Found & fixed FPS throttle alignment bug**: Render FPS went from 34fps to 60fps
  - Root cause: `lastFrameTime = timestamp` caused drift when rAF interval matched target
  - Fix: `lastFrameTime = timestamp - (elapsed % frameInterval)` carries forward remainder
- **Profiling results** (640x480 camera, M4 Max GPU):
  - MediaPipe inference: ~14ms (99%+ of tracking time, at hardware minimum for holistic model)
  - Solver: <0.1ms, Bridge (Kalman + bones): <0.1ms — negligible
  - Render total: 0.6ms (controls 0ms, VRM update 0.2ms, Three.js render 0.3ms)
  - No further CPU optimization needed — all stages except MediaPipe are negligible

#### 14.1c: GPU Optimization ✅
- **GPU load is light**: 8-10 draw calls, ~42K triangles, 17-21 textures
- Added `powerPreference: 'high-performance'` for discrete GPU selection
- Capped pixel ratio at 2 to prevent excessive fill rate on high-DPI displays
- Render time: 0.3ms/frame — no GPU bottleneck

#### 14.1d: Memory Optimization ✅
- Heap stable at ~305MB over 45s of tracking (normal GC fluctuation, no growth trend)
- Fixed VRM texture disposal: textures now properly disposed on model swap
- Verified: geometries, materials, and textures all cleaned up on VRM reload

### Step 14.2: PWA Support ✅ (Completed in Phase 13.5)

### Step 14.3: Bundle Optimization
- Analyze bundle with `next-bundle-analyzer`
- Code splitting for MediaPipe WASM, Three.js
- Dynamic imports for heavy components
- Target: < 500KB gzipped initial load

### Step 14.4: Cross-Browser Compatibility
- Feature detection for WebGL2, MediaDevices, Service Worker
- Graceful fallback messages for unsupported browsers
- Test on Chrome, Firefox, Safari, Edge

### Step 14.5: Error Tracking & Monitoring
- Error boundary with user-facing error messages
- Performance metrics collection (FPS, frame timing)
- Optional: Sentry or similar integration

---

## Project Structure

```
vrm-tuber/
├── src/
│   ├── app/                    # Next.js App Router
│   ├── components/             # React components
│   │   ├── avatar-scene.tsx
│   │   ├── background-settings.tsx
│   │   ├── camera-preview.tsx
│   │   ├── camera-provider.tsx
│   │   ├── error-boundary.tsx
│   │   ├── loading-skeleton.tsx
│   │   ├── performance-overlay.tsx
│   │   ├── pwa-register.tsx
│   │   ├── settings-panel.tsx
│   │   ├── tracking-debug-overlay.tsx
│   │   └── vrm-drop-zone.tsx
│   ├── hooks/
│   │   ├── use-tracking.ts
│   │   ├── use-vrm-loader.ts
│   │   └── use-vrm-tracking.ts
│   ├── lib/
│   │   ├── capture/frame-capture.ts
│   │   ├── integration/pipeline.ts
│   │   ├── math/
│   │   ├── mediapipe/tracker.ts
│   │   ├── perf/monitor.ts, pipeline-profiler.ts, profiler-instances.ts
│   │   ├── pwa/register-sw.ts
│   │   ├── solver/
│   │   ├── vrm/
│   │   └── worker/
│   ├── stores/
│   │   ├── settings-store.ts
│   │   └── tracking-store.ts
│   └── types/
├── public/
│   ├── icons/                  # PWA icons (SVG)
│   ├── manifest.json           # PWA manifest
│   └── sw.js                   # Service worker
├── tests/e2e/
├── vitest.config.ts
└── PLAN.md
```

---

## Phase Priority

```
Phases 1-13.5 (Complete) ✅
    │
    └──► Phase 14 (Production) - In Progress
           ├── 14.1 Performance Profiling & Optimization ◄── TOP PRIORITY
           │     ├── 14.1a Add profiling instrumentation
           │     ├── 14.1b CPU optimization (profile-driven)
           │     ├── 14.1c GPU optimization (profile-driven)
           │     └── 14.1d Memory optimization
           ├── 14.3 Bundle optimization
           ├── 14.4 Cross-browser compatibility
           └── 14.5 Error tracking & monitoring
```

---

## References

- [VRM Studio](https://github.com/vucinatim/vrm-studio) - Reference implementation
- [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/guide)
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm)
- [Wawa Sensei Tutorial](https://wawasensei.dev/tuto/vrm-avatar-with-threejs-react-three-fiber-and-mediapipe)
