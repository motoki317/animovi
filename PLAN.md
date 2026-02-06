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
| 1-7. Core Foundation | Complete | 60/60 |
| 8. VRM Loading | Complete | 8/8 |
| 9. MediaPipe | Complete | 30/30 |
| 10. Pipeline | Complete | 24/24 |
| 11. UX Enhancements | Complete | 47/47 |
| 12. UI Enhancements | Complete | ~77 |
| **13. Solver Improvements** | **In Progress** | 11/TBD |
| 14. Production Readiness | Planned | 0/TBD |
| **Total** | | **259 tests (246 active + 13 legacy skipped, 32 files)** |

---

## Completed Phases (1-12)

<details>
<summary>Click to expand completed phases</summary>

### Phase 1-7: Core Foundation
- Project setup (Next.js, Vitest, ESLint)
- Kalman filter & euler utilities
- Face/Pose/Hand solvers
- Web Worker infrastructure
- VRM animator
- React components (CameraProvider, AvatarScene, SettingsPanel)
- State management (Zustand stores)
- E2E tests

### Phase 8: VRM Loading
- GLTFLoader + VRMLoaderPlugin integration
- Load from URL and File object
- Progress reporting, disposal, error handling

### Phase 9: MediaPipe Integration
- HolisticLandmarker initialization
- useTracking hook
- Frame capture with OffscreenCanvas

### Phase 10: End-to-End Pipeline
- TrackingBridge for VRM animation
- PerformanceMonitor (FPS, frame timing)
- Full integration tests

### Phase 11: UX Enhancements
- CameraPreview component
- VRMDropZone (drag & drop)
- LoadingSkeleton & ErrorBoundary
- BackgroundSettings (colors, transparency)
- Manual VRM import button in SettingsPanel

### Phase 12: UI Enhancements
- Camera position controls (Y height, Z distance sliders)
- Auto-frame to VRM face position on load
- Background settings integration (solid color, transparent for OBS)
- Collapsible settings panel with H key shortcut + hover-to-restore
- Settings panel renders as overlay (character always centered in full window)
- Tracking feature toggles (face/pose/hands) properly wired to TrackingBridge
- Tracking debug overlay (D key)

</details>

---

## Phase 13: Solver Improvements

**Goal:** Improve tracking accuracy and completeness.

### Step 13.1: Arm Tracking Fix ✅

**Completed changes:**
- [x] Fixed elbow rotation: full 3DOF `directionToEulerZYX(upperArmDir, lowerArmDir)` instead of single scalar
- [x] Added anatomical clamping (`clampArmRotation`) for shoulder and elbow limits
- [x] Partial arm visibility: null arms when elbow/wrist not visible, fallback to default pose
- [x] TrackingBridge handles null arms gracefully (falls back to arms-down pose)
- [x] Legacy IK solver tests skipped (dead code from old approach)

### Step 13.1b: Tracking Inversion Fix ✅

**Completed changes:**
- [x] Fixed face pitch sign: `(forehead.z - chin.z)` instead of `(chin.z - forehead.z)` to match VRM +X = forward/down
- [x] Fixed arm Z-axis: `z: p.z` instead of `z: -p.z` in `toVRMSpace()` — scene PI rotation handles the flip
- [x] Updated fixture expected values and test assertions for new Z convention

### Step 13.2: Finger Spread
- [ ] Calculate lateral finger spread
- [ ] Detect finger splay gestures

### Step 13.3: Eye Gaze
- [ ] Calculate eye gaze direction from iris position
- [ ] Apply to VRM lookAt

### Step 13.4: Kalman Filter Integration
- [ ] Apply Kalman filter to all solver outputs
- [ ] Per-feature smoothing settings
- [ ] Reset filter on tracking loss

---

## Phase 14: Production Readiness

**Goal:** Prepare for deployment and real-world use.

### Step 14.1: Bundle Optimization
- Code splitting, dynamic imports
- Bundle analysis (target: <500KB gzipped)

### Step 14.2: PWA Support
- Service worker for asset caching
- Web manifest, offline fallback

### Step 14.3: Cross-Browser Testing
- Browser/feature detection
- WebGL2, Workers support check

### Step 14.4: Error Tracking
- Error boundary with reporting
- Performance metrics collection

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
│   │   ├── perf/monitor.ts
│   │   ├── solver/
│   │   ├── vrm/
│   │   └── worker/
│   ├── stores/
│   │   ├── settings-store.ts
│   │   └── tracking-store.ts
│   └── types/
├── tests/e2e/
├── vitest.config.ts
└── PLAN.md
```

---

## Phase Priority

```
Phases 1-12 (Complete)
    │
    ├──► Phase 13 (Solvers) ◄── In Progress
    │      ├── 13.1 Arm tracking fix ✅
    │      ├── 13.2 Finger spread
    │      ├── 13.3 Eye gaze
    │      └── 13.4 Kalman filter integration
    │
    └──► Phase 14 (Production) - Ship it!
```

---

## References

- [VRM Studio](https://github.com/vucinatim/vrm-studio) - Reference implementation
- [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/guide)
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm)
- [Wawa Sensei Tutorial](https://wawasensei.dev/tuto/vrm-avatar-with-threejs-react-three-fiber-and-mediapipe)
