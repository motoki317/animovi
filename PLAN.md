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

## Performance Targets

| Metric | Target | Strategy |
|--------|--------|----------|
| Frame time | <16ms (60fps) | Web Worker isolation |
| Bundle size | <500KB gzipped | Lazy load 3D, CDN for WASM |
| First paint | <2s | Code splitting |
| Memory | <200MB | VRM optimization utils |

---

## Implementation Status Summary

| Phase | Status | Tests |
|-------|--------|-------|
| 1-7. Core Foundation | Complete | 60/60 |
| 8. VRM Loading | Complete | 8/8 |
| 9. MediaPipe | Complete | 30/30 |
| 10. Pipeline | Complete | 24/24 |
| 11. UX Enhancements | Complete | 47/47 |
| **12. UI Enhancements** | **Planned** | 0/TBD |
| 13. Solver Improvements | Planned | 0/TBD |
| 14. Production Readiness | Planned | 0/TBD |
| **Total** | **166+ tests passing** | |

---

## Completed Phases (1-11)

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

</details>

---

## Phase 12: UI Enhancements

**Goal:** Add camera controls, complete background integration, and enable OBS-friendly mode.

### Step 12.1: Camera Position Controls
**Tests:**
- [ ] Should allow manual camera Y position adjustment (vertical)
- [ ] Should allow manual camera Z position adjustment (zoom/distance)
- [ ] Should auto-frame to VRM face position on load
- [ ] Should persist camera settings

**Technical Notes:**
- Current camera is hardcoded at `position.set(0, 1.3, 1.5)` in `avatar-scene.tsx`
- Auto-framing possible via `vrm.humanoid.getNormalizedBoneNode('head')` to get head position
- Can compute bounding box with `THREE.Box3().setFromObject(vrm.scene)`

**Implementation:**
- Extend `settings-store.ts` with camera position state (`cameraY`, `cameraZ`, `cameraAutoFrame`)
- Add camera controls to `settings-panel.tsx` (Y slider, Z slider, auto-frame button)
- Update `avatar-scene.tsx` to accept dynamic camera position props
- Implement auto-framing using VRM humanoid head bone position

### Step 12.2: Background Settings Integration
**Tests:**
- [ ] Should display background settings in sidebar
- [ ] Should change avatar scene background color
- [ ] Should show preset colors including green, red, and blue
- [ ] Should support transparent background for OBS

**Technical Notes:**
- `BackgroundSettings` component EXISTS but is NOT integrated into `page.tsx`
- Preset colors already include Green (`#00ff00`) and Blue (`#0000ff`)
- Need to add Red (`#ff0000`) to PRESET_COLORS
- Need to wire background state to `AvatarScene` component

**Implementation:**
- Add background state to `settings-store.ts` (`backgroundType`, `backgroundColor`)
- Integrate `BackgroundSettings` into `page.tsx` sidebar
- Add red to `PRESET_COLORS` array in `background-settings.tsx`
- Wire background config to `AvatarScene` via props

### Step 12.3: Collapsible Settings Panel (OBS Mode)
**Tests:**
- [ ] Should hide panel when toggle button clicked
- [ ] Should show panel on mouse hover over trigger zone
- [ ] Should animate panel slide in/out smoothly
- [ ] Should remember panel visibility preference
- [ ] Should provide keyboard shortcut (H key)

**Technical Notes:**
- Current sidebar is always visible at 300px width
- Need invisible hover zone at right edge to restore panel
- Consider "OBS Mode" toggle that hides panel + enables transparent background

**Implementation:**
- Add panel visibility state to `settings-store.ts` (`panelVisible`)
- Implement hide/show logic in `page.tsx`
- Create `PanelTrigger` component for hover detection
- Add CSS transitions for smooth animation
- Add keyboard shortcut handler (H key to toggle)

### Step 12.4: Next.js Logo Removal
**Status:** NOT NEEDED

Investigation found NO Next.js logo in the application code:
- `src/app/layout.tsx` - Clean, no logo
- `src/app/page.tsx` - No logo imports
- No SVG or image files for logos

The "N" icon visible in screenshots is likely a **browser extension** (e.g., Notion Web Clipper), not part of the application.

---

## Phase 13: Solver Improvements

**Goal:** Complete the partially implemented solvers.

### Step 13.1: Arm Tracking
**Tests:**
- [ ] Should calculate shoulder rotation from landmarks
- [ ] Should calculate elbow bend angle
- [ ] Should handle partial arm visibility
- [ ] Should mirror for left/right arms correctly

### Step 13.2: Finger Spread
**Tests:**
- [ ] Should calculate lateral finger spread
- [ ] Should detect finger splay gestures

### Step 13.3: Eye Gaze
**Tests:**
- [ ] Should calculate eye gaze direction
- [ ] Should track iris position
- [ ] Should apply to VRM lookAt

### Step 13.4: Kalman Filter Integration
**Tests:**
- [ ] Should apply Kalman filter to all solver outputs
- [ ] Should respect per-feature smoothing settings
- [ ] Should reset filter on tracking loss

---

## Phase 14: Production Readiness

**Goal:** Prepare for deployment and real-world use.

### Step 14.1: Bundle Optimization
- Code splitting configuration
- Dynamic imports
- Bundle analysis (target: <500KB gzipped)

### Step 14.2: PWA Support
- Service worker for asset caching
- Web manifest
- Offline fallback

### Step 14.3: Cross-Browser Testing
- Browser/feature detection
- WebGL2, Workers support check
- Polyfills where needed

### Step 14.4: Error Tracking
- Error boundary with reporting
- Performance metrics collection
- Privacy-respecting analytics

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
│   │   └── vrm-drop-zone.tsx
│   ├── hooks/
│   │   ├── use-camera.ts
│   │   ├── use-tracking.ts
│   │   └── use-vrm-loader.ts
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
├── playwright.config.ts
└── PLAN.md
```

---

## Phase Priority & Dependencies

```
Phases 1-11 (Complete)
    │
    ▼
Phase 12 (UI Enhancements) ◄── Current Priority
    │
    ├──► Phase 13 (Solvers) - Feature completeness
    │
    └──► Phase 14 (Production) - Ship it!
```

**Recommended Order for Phase 12:**
1. **12.2 Background Integration** - Very Low effort (1-2h), high impact
2. **12.1 Camera Position Controls** - Medium effort (4-6h), high impact
3. **12.3 Collapsible Panel** - Medium effort (3-4h), enables OBS capture

---

## References

- [VRM Studio](https://github.com/vucinatim/vrm-studio) - Reference implementation
- [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/guide)
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm)
- [Wawa Sensei Tutorial](https://wawasensei.dev/tuto/vrm-avatar-with-threejs-react-three-fiber-and-mediapipe)

---

## Changelog

### 2026-02-04 (Phase 12 Planning)
- Analyzed feature requests for camera controls, background colors, collapsible panel
- Confirmed auto-framing to VRM face is FEASIBLE using `vrm.humanoid.getNormalizedBoneNode('head')`
- Found `BackgroundSettings` component exists but not integrated (green already in presets!)
- Confirmed NO Next.js logo exists in app (likely browser extension)
- Condensed completed phases into collapsible section
- Added Phase 12 with detailed technical notes and implementation steps

### 2026-02-04 (Phase 8-11 Complete)
- Phases 8-11 implemented with TDD approach
- Total: **166 tests passing** across 27+ test files
- Added VRM import button to SettingsPanel
- Fixed TypeScript build errors
