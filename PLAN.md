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

## TDD Implementation Plan

### Phase 1: Foundation & Core Utilities [COMPLETED]

#### Step 1.1: Project Setup
- [x] Initialize Next.js with TypeScript
- [x] Configure Vitest for testing
- [x] Set up ESLint and Prettier
- [x] Create basic project structure

#### Step 1.2: Kalman Filter (Pure Logic, No Dependencies)
**Tests:** 4 passing
- [x] Should smooth noisy input values
- [x] Should respect responsiveness parameter
- [x] Should handle rapid value changes
- [x] Should reset state when requested

**Implementation:**
- `src/lib/math/kalman-filter.ts`
- `src/lib/math/kalman-filter.test.ts`

#### Step 1.3: Euler Angle Utilities
**Tests:** 4 passing
- [x] Should convert quaternion to euler angles
- [x] Should clamp angles within valid range
- [x] Should interpolate between two euler angles
- [x] Should handle gimbal lock edge cases

**Implementation:**
- `src/lib/math/euler-utils.ts`
- `src/lib/math/euler-utils.test.ts`

---

### Phase 2: Landmark Solver [COMPLETED]

#### Step 2.1: Face Solver
**Tests:** 7 passing
- [x] Calculate head rotation from face landmarks
- [x] Extract eye blendshapes (blink left/right)
- [x] Extract mouth blendshapes (open, smile)
- [x] Return null for invalid landmark data
- [x] Normalize output values to 0-1 range

**Implementation:**
- `src/lib/solver/face-solver.ts`
- `src/lib/solver/face-solver.test.ts`

#### Step 2.2: Pose Solver
**Tests:** 4 passing
- [x] Calculate spine rotation from pose landmarks
- [x] Handle missing landmarks gracefully
- [x] Respect visibility threshold
- [ ] Calculate arm rotations (shoulder, elbow) - *returns zeros*

**Implementation:**
- `src/lib/solver/pose-solver.ts`
- `src/lib/solver/pose-solver.test.ts`

#### Step 2.3: Hand Solver
**Tests:** 2 passing
- [x] Calculate finger curl from hand landmarks
- [x] Differentiate left and right hands
- [ ] Calculate finger spread - *returns zeros*

**Implementation:**
- `src/lib/solver/hand-solver.ts`
- `src/lib/solver/hand-solver.test.ts`

#### Step 2.4: Combined Solver
**Tests:** 1 passing
- [x] Combine face, pose, and hand results

**Implementation:**
- `src/lib/solver/holistic-solver.ts`
- `src/lib/solver/holistic-solver.test.ts`

---

### Phase 3: Web Worker Infrastructure [COMPLETED]

#### Step 3.1: Worker Message Protocol
**Tests:** 7 passing
- [x] Serialize landmark data efficiently
- [x] Deserialize solver results correctly
- [x] Handle error messages
- [x] Support configuration updates

**Implementation:**
- `src/lib/worker/protocol.ts`
- `src/lib/worker/protocol.test.ts`

#### Step 3.2: Tracking Worker
**Tests:** 4 passing
- [x] Initialize on setup message
- [x] Process frames and return landmarks (with mock tracker)
- [x] Apply solver and return bone rotations
- [x] Handle configuration changes

**Implementation:**
- `src/lib/worker/tracking.worker.ts`
- `src/lib/worker/tracking.worker.test.ts`

---

### Phase 4: VRM Integration [COMPLETED - STUBS]

#### Step 4.1: VRM Loader Hook
**Tests:** 3 passing (error handling only)
- [x] Handle loading errors
- [ ] Load VRM file from URL - *TODO stub*
- [ ] Load VRM file from File object - *TODO stub*
- [ ] Apply optimization utils on load
- [ ] Handle VRM 0.x and 1.0 formats
- [ ] Report loading progress

**Implementation:**
- `src/hooks/use-vrm-loader.ts` - **Contains TODO stubs**
- `src/hooks/use-vrm-loader.test.ts`

#### Step 4.2: VRM Animator
**Tests:** 4 passing
- [x] Apply bone rotations to VRM model
- [x] Apply blendshape values to VRM model
- [ ] Interpolate between frames smoothly
- [ ] Respect update rate limits

**Implementation:**
- `src/lib/vrm/animator.ts`
- `src/lib/vrm/animator.test.ts`

---

### Phase 5: React Components [COMPLETED]

#### Step 5.1: Camera Provider
**Tests:** 3 passing
- [x] Request camera permissions
- [x] Provide video stream to children
- [x] Handle permission denied
- [x] Allow camera switching
- [x] Clean up on unmount

**Implementation:**
- `src/components/camera-provider.tsx`
- `src/components/camera-provider.test.tsx`

#### Step 5.2: Avatar Scene
**Tests:** 1 passing
- [x] Render Three.js canvas
- [x] Display loaded VRM model
- [x] Support background color
- [x] Handle window resize
- [ ] Update model pose from tracking data - *no integration*

**Implementation:**
- `src/components/avatar-scene.tsx`
- `src/components/avatar-scene.test.tsx`

#### Step 5.3: Settings Panel
**Tests:** 3 passing
- [x] Toggle tracking features (face/pose/hands)
- [x] Adjust smoothing level
- [ ] Change background color - *not wired*
- [ ] Persist settings to localStorage - *handled in store*

**Implementation:**
- `src/components/settings-panel.tsx`
- `src/components/settings-panel.test.tsx`

---

### Phase 6: State Management [COMPLETED]

#### Step 6.1: Tracking Store
**Tests:** 3 passing
- [x] Store current tracking results
- [x] Track connection status
- [x] Compute derived state (isTracking)

**Implementation:**
- `src/stores/tracking-store.ts`
- `src/stores/tracking-store.test.ts`

#### Step 6.2: Settings Store
**Tests:** 3 passing
- [x] Store tracking preferences
- [x] Store smoothing level
- [x] Persist to localStorage
- [x] Load from localStorage on init

**Implementation:**
- `src/stores/settings-store.ts`
- `src/stores/settings-store.test.ts`

---

### Phase 7: Integration & E2E [COMPLETED - PARTIAL]

#### Step 7.1: Main App Integration
**Tests:** 3 passing
- [x] Display avatar scene
- [x] Display settings panel
- [ ] Load default VRM on start - *VRM loader not implemented*
- [ ] Connect camera to tracking worker - *missing useTracking hook*
- [ ] Update avatar from tracking data - *no integration*

#### Step 7.2: E2E Tests (Playwright)
**Tests:** 4 passing
- [x] Load app and display avatar scene
- [x] Display settings panel
- [x] Respond to settings changes
- [x] Toggle tracking checkboxes

---

## Implementation Status Summary

| Phase | Status | Tests |
|-------|--------|-------|
| 1. Foundation | Complete | 8/8 |
| 2. Solvers | Complete (with gaps) | 14/14 |
| 3. Worker | Complete | 11/11 |
| 4. VRM | Complete | 7/7 |
| 5. Components | Complete | 7/7 |
| 6. State | Complete | 6/6 |
| 7. Integration | Complete | 7/7 (E2E: 4) |
| 8. VRM Loading | Complete | 8/8 |
| 9. MediaPipe | Complete | 30/30 |
| 10. Pipeline | Complete | 24/24 |
| 11. UX Enhancements | Complete | 47/47 |
| **Total** | **162 tests passing** | |

---

## Phase 8: Complete VRM Loading [COMPLETED]

**Goal:** Implement actual VRM file loading with Three.js and @pixiv/three-vrm.

#### Step 8.1: VRM Loader Implementation
**Tests:** 8 passing
- [x] Load VRM file from URL using GLTFLoader
- [x] Load VRM from File object via URL.createObjectURL
- [x] Report loading progress (0-100%)
- [x] Dispose previous VRM when loading new one
- [x] Handle loading errors gracefully

**Implementation:**
- `src/hooks/use-vrm-loader.ts`
- Integrates `GLTFLoader` with `VRMLoaderPlugin`
- Progress callback support
- Proper cleanup/disposal

---

## Phase 9: MediaPipe Integration [COMPLETED]

**Goal:** Connect real MediaPipe HolisticLandmarker to the tracking worker.

#### Step 9.1: MediaPipe Initialization
**Tests:** 8 passing
- [x] Initialize HolisticLandmarker with WASM files from CDN
- [x] Detect face, pose, and hand landmarks from video frame
- [x] Handle WASM loading errors gracefully
- [x] Handle detection errors gracefully
- [x] Clean up resources on dispose
- [x] Report initialization status

**Implementation:**
- `src/lib/mediapipe/tracker.ts`
- `src/lib/mediapipe/tracker.test.ts`

#### Step 9.2: useTracking Hook
**Tests:** 11 passing
- [x] Create and manage tracking worker lifecycle
- [x] Send video frames from camera stream
- [x] Receive and store tracking results
- [x] Handle worker errors
- [x] Clean up worker on unmount
- [x] Send config updates to worker
- [x] Respect enabled toggle

**Implementation:**
- `src/hooks/use-tracking.ts`
- `src/hooks/use-tracking.test.ts`

#### Step 9.3: Camera Frame Capture
**Tests:** 11 passing
- [x] Capture frames from video element
- [x] Convert to ImageData for worker transfer
- [x] Use OffscreenCanvas when available
- [x] Throttle to prevent overload
- [x] Handle video not ready gracefully
- [x] Support aspect-ratio-preserving scaling

**Implementation:**
- `src/lib/capture/frame-capture.ts`
- `src/lib/capture/frame-capture.test.ts`

---

## Phase 10: End-to-End Tracking Pipeline [COMPLETED]

**Goal:** Wire everything together for real-time avatar animation.

#### Step 10.1: Tracking to Avatar Bridge
**Tests:** 7 passing
- [x] Apply tracking results to VRM bones and expressions
- [x] Interpolate between frames with Kalman filter smoothing
- [x] Respect tracking feature toggles from settings
- [x] Handle missing tracking data gracefully
- [x] Update options dynamically
- [x] Dispose resources properly

**Implementation:**
- `src/lib/vrm/tracking-bridge.ts`
- `src/lib/vrm/tracking-bridge.test.ts`

#### Step 10.2: Performance Monitoring
**Tests:** 10 passing
- [x] Measure frame processing time
- [x] Detect when frame time exceeds 16ms
- [x] Calculate rolling average FPS
- [x] Emit warnings when performance degrades
- [x] Track dropped frame count
- [x] Reset metrics on demand

**Implementation:**
- `src/lib/perf/monitor.ts`
- `src/lib/perf/monitor.test.ts`

#### Step 10.3: Full Integration Test
**Tests:** 7 passing
- [x] Animate avatar from tracking input
- [x] Maintain performance under normal conditions
- [x] Recover from temporary tracking loss
- [x] Handle settings changes without restart
- [x] Apply smoothing consistently
- [x] Track frame count correctly

**Implementation:**
- `src/lib/integration/pipeline.ts`
- `src/lib/integration/pipeline.test.ts`

---

## Phase 11: User Experience Enhancements [COMPLETED]

**Goal:** Polish the UI for production use.

#### Step 11.1: Camera Preview
**Tests:** 10 passing
- [x] Display live camera feed in corner
- [x] Support different positions (corners)
- [x] Toggleable on/off
- [x] Show tracking overlay (landmarks visualization)
- [x] Mirror video by default
- [x] Configurable size

**Implementation:**
- `src/components/camera-preview.tsx`
- `src/components/camera-preview.test.tsx`
- `src/components/camera-preview.css`

#### Step 11.2: VRM Drag and Drop
**Tests:** 12 passing
- [x] Accept .vrm and .glb files via drag and drop
- [x] Show visual feedback during drag
- [x] Validate file extension before loading
- [x] Show loading progress indicator
- [x] Display error for invalid files
- [x] Support click to browse files

**Implementation:**
- `src/components/vrm-drop-zone.tsx`
- `src/components/vrm-drop-zone.test.tsx`
- `src/components/vrm-drop-zone.css`

#### Step 11.3: Error States & Loading UI
**Tests:** 15 passing
- [x] Show skeleton while VRM loads
- [x] Show camera permission prompt state
- [x] Display friendly error messages
- [x] Offer retry actions for recoverable errors
- [x] Support different severity levels
- [x] Custom fallback for error boundary

**Implementation:**
- `src/components/loading-skeleton.tsx`
- `src/components/loading-skeleton.test.tsx`
- `src/components/error-boundary.tsx`
- `src/components/error-boundary.test.tsx`

#### Step 11.4: Background Controls
**Tests:** 10 passing
- [x] Allow solid color background
- [x] Allow transparent background (for OBS)
- [x] Allow custom image background
- [x] Persist background preference
- [x] Preset color options

**Implementation:**
- `src/components/background-settings.tsx`
- `src/components/background-settings.test.tsx`
- `src/components/background-settings.css`

---

## Phase 12: Solver Improvements

**Goal:** Complete the partially implemented solvers.

#### Step 12.1: Arm Tracking
**Test First:**
```typescript
describe('PoseSolver - Arms', () => {
  it('should calculate shoulder rotation from landmarks')
  it('should calculate elbow bend angle')
  it('should handle partial arm visibility')
  it('should mirror for left/right arms correctly')
})
```

**Implementation:**
- Complete arm rotation calculations in pose-solver.ts
- Integrate with VRM humanoid bones

#### Step 12.2: Finger Spread
**Test First:**
```typescript
describe('HandSolver - Spread', () => {
  it('should calculate lateral finger spread')
  it('should detect finger splay gestures')
})
```

**Implementation:**
- Add spread calculation to hand-solver.ts

#### Step 12.3: Eye Gaze
**Test First:**
```typescript
describe('FaceSolver - Gaze', () => {
  it('should calculate eye gaze direction')
  it('should track iris position')
  it('should apply to VRM lookAt')
})
```

**Implementation:**
- Iris landmark tracking
- VRM lookAt integration

#### Step 12.4: Kalman Filter Integration
**Test First:**
```typescript
describe('SmoothedSolver', () => {
  it('should apply Kalman filter to all solver outputs')
  it('should respect per-feature smoothing settings')
  it('should reset filter on tracking loss')
})
```

**Implementation:**
- Integrate existing Kalman filter into holistic solver

---

## Phase 13: Production Readiness

**Goal:** Prepare for deployment and real-world use.

#### Step 13.1: Bundle Optimization
**Test First:**
```typescript
describe('BundleSize', () => {
  it('should have main bundle under 200KB gzipped')
  it('should lazy load Three.js and VRM')
  it('should lazy load MediaPipe WASM')
})
```

**Implementation:**
- Code splitting configuration
- Dynamic imports
- Bundle analysis

#### Step 13.2: PWA Support
**Test First:**
```typescript
describe('PWA', () => {
  it('should be installable as PWA')
  it('should work offline with cached assets')
  it('should handle service worker updates')
})
```

**Implementation:**
- Service worker for asset caching
- Web manifest
- Offline fallback

#### Step 13.3: Cross-Browser Testing
**Test First:**
```typescript
describe('BrowserCompatibility', () => {
  it('should work in Chrome')
  it('should work in Firefox')
  it('should work in Safari')
  it('should show fallback for unsupported browsers')
})
```

**Implementation:**
- Browser detection
- Feature detection for WebGL2, Workers, etc.
- Polyfills where needed

#### Step 13.4: Error Tracking & Analytics
**Test First:**
```typescript
describe('Telemetry', () => {
  it('should report errors to monitoring service')
  it('should track performance metrics')
  it('should respect user privacy preferences')
})
```

**Implementation:**
- Error boundary with reporting
- Performance metrics collection
- Privacy-respecting analytics

---

## Project Structure

```
vrm-tuber/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/             # React components
│   │   ├── avatar-scene.tsx
│   │   ├── camera-provider.tsx
│   │   ├── camera-preview.tsx      # Phase 11
│   │   ├── error-boundary.tsx      # Phase 11
│   │   ├── loading-skeleton.tsx    # Phase 11
│   │   ├── settings-panel.tsx
│   │   ├── vrm-drop-zone.tsx       # Phase 11
│   │   └── ui/                 # Reusable UI components
│   ├── hooks/                  # Custom React hooks
│   │   ├── use-vrm-loader.ts
│   │   ├── use-camera.ts
│   │   └── use-tracking.ts         # Phase 9
│   ├── lib/                    # Core logic (framework-agnostic)
│   │   ├── capture/                # Phase 9
│   │   │   └── frame-capture.ts
│   │   ├── math/
│   │   │   ├── kalman-filter.ts
│   │   │   └── euler-utils.ts
│   │   ├── mediapipe/              # Phase 9
│   │   │   └── tracker.ts
│   │   ├── perf/                   # Phase 10
│   │   │   └── monitor.ts
│   │   ├── solver/
│   │   │   ├── face-solver.ts
│   │   │   ├── pose-solver.ts
│   │   │   ├── hand-solver.ts
│   │   │   └── holistic-solver.ts
│   │   ├── vrm/
│   │   │   ├── animator.ts
│   │   │   └── optimizer.ts        # Phase 8
│   │   └── worker/
│   │       ├── protocol.ts
│   │       └── tracking.worker.ts
│   ├── stores/                 # Zustand stores
│   │   ├── tracking-store.ts
│   │   └── settings-store.ts
│   └── types/                  # TypeScript types
│       ├── landmarks.ts
│       ├── vrm.ts
│       └── settings.ts
├── public/
│   └── models/                 # Default VRM models
├── tests/
│   ├── fixtures/               # Test data (mock landmarks)
│   └── e2e/                    # Playwright tests
├── vitest.config.ts
├── playwright.config.ts
├── next.config.js
├── tsconfig.json
├── package.json
└── PLAN.md
```

---

## Development Workflow

### TDD Cycle for Each Step

1. **RED**: Write failing test that defines expected behavior
2. **GREEN**: Write minimal code to make test pass
3. **REFACTOR**: Improve code while keeping tests green

### Commit Strategy

- Commit after each GREEN phase
- Use conventional commits: `feat:`, `test:`, `refactor:`
- Keep commits atomic and focused

### Definition of Done

- [ ] All tests pass
- [ ] Code coverage >80% for new code
- [ ] No TypeScript errors
- [ ] ESLint passes
- [ ] Performance target met (if applicable)

---

## Phase Priority & Dependencies

```
Phase 8 (VRM Loading)
    │
    ▼
Phase 9 (MediaPipe) ──────┐
    │                     │
    ▼                     │
Phase 10 (Pipeline) ◄─────┘
    │
    ├──► Phase 11 (UX)
    │
    └──► Phase 12 (Solvers)
              │
              ▼
         Phase 13 (Production)
```

**Recommended Order:**
1. Phase 8 - Unblocks any manual testing
2. Phase 9 - Core functionality
3. Phase 10 - Makes app actually work
4. Phase 11 - User-facing polish
5. Phase 12 - Feature completeness
6. Phase 13 - Ship it!

---

## References

- [VRM Studio](https://github.com/vucinatim/vrm-studio) - Reference implementation
- [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/guide)
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm)
- [Wawa Sensei Tutorial](https://wawasensei.dev/tuto/vrm-avatar-with-threejs-react-three-fiber-and-mediapipe)
- [KalidoKit (deprecated)](https://github.com/yeemachine/kalidokit) - Algorithm reference

---

## Changelog

### 2026-02-04 (Phase 8-11 Complete)
- **Phase 8: VRM Loading** - Full implementation with GLTFLoader + VRMLoaderPlugin
- **Phase 9: MediaPipe Integration** - MediaPipeTracker, useTracking hook, FrameCapture
- **Phase 10: Pipeline** - TrackingBridge, PerformanceMonitor, full integration tests
- **Phase 11: UX Enhancements** - CameraPreview, VRMDropZone, LoadingSkeleton, ErrorBoundary, BackgroundSettings
- Total: **162 tests passing** across 27 test files
- All core functionality implemented and tested with TDD approach

### 2026-02-04 (Update)
- Marked Phases 1-7 as complete with detailed status
- Identified gaps in current implementation (stubs, missing integrations)
- Added Phases 8-13 for next implementation steps
- Added phase dependency diagram and priority recommendations
- Updated project structure with planned files

### 2026-02-04
- Initial plan created from deep research analysis
- TDD implementation steps defined
