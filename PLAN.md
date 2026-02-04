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
| 4. VRM | Stubs only | 7/7 |
| 5. Components | Complete | 7/7 |
| 6. State | Complete | 6/6 |
| 7. Integration | Partial | 7/7 (E2E: 4) |
| **Total** | **60 tests passing** | |

---

## Phase 8: Complete VRM Loading

**Goal:** Implement actual VRM file loading with Three.js and @pixiv/three-vrm.

#### Step 8.1: VRM Loader Implementation
**Test First:**
```typescript
describe('useVRMLoader - Full Implementation', () => {
  it('should load VRM 1.0 file from URL using GLTFLoader')
  it('should load VRM 0.x file with automatic version detection')
  it('should load VRM from File object via URL.createObjectURL')
  it('should report loading progress (0-100%)')
  it('should apply VRM optimization on load')
  it('should dispose previous VRM when loading new one')
  it('should reject invalid/corrupted VRM files')
})
```

**Implementation:**
- Integrate `GLTFLoader` with `VRMLoaderPlugin`
- Handle both VRM 0.x and 1.0 formats
- Add progress callback for large files
- Implement proper cleanup/disposal

#### Step 8.2: VRM Optimization Utils
**Test First:**
```typescript
describe('VRMOptimizer', () => {
  it('should reduce texture resolution for performance')
  it('should merge materials where possible')
  it('should simplify geometry for distant rendering')
  it('should calculate memory usage before/after')
})
```

**Implementation:**
- `src/lib/vrm/optimizer.ts`
- Texture downscaling options
- Material batching

#### Step 8.3: Default VRM Model
**Test First:**
```typescript
describe('DefaultVRM', () => {
  it('should load bundled default avatar on app start')
  it('should fall back to placeholder if default fails')
})
```

**Implementation:**
- Include lightweight default VRM in `/public/models/`
- Auto-load on app initialization

---

## Phase 9: MediaPipe Integration

**Goal:** Connect real MediaPipe HolisticLandmarker to the tracking worker.

#### Step 9.1: MediaPipe Initialization
**Test First:**
```typescript
describe('MediaPipeTracker', () => {
  it('should initialize HolisticLandmarker with WASM files')
  it('should detect face, pose, and hand landmarks from ImageData')
  it('should handle WASM loading errors gracefully')
  it('should support GPU delegate when available')
  it('should clean up resources on dispose')
})
```

**Implementation:**
- `src/lib/mediapipe/tracker.ts`
- WASM files loading from CDN
- GPU acceleration detection

#### Step 9.2: useTracking Hook
**Test First:**
```typescript
describe('useTracking', () => {
  it('should create and manage tracking worker')
  it('should send video frames from camera stream')
  it('should receive and store tracking results')
  it('should apply Kalman filter smoothing based on settings')
  it('should pause tracking when disabled')
  it('should handle worker errors')
  it('should clean up worker on unmount')
})
```

**Implementation:**
- `src/hooks/use-tracking.ts`
- Connect CameraProvider stream to Worker
- Frame capture at configurable rate
- Error recovery

#### Step 9.3: Camera Frame Capture
**Test First:**
```typescript
describe('FrameCapture', () => {
  it('should capture frames from video element at target FPS')
  it('should convert to ImageData for worker transfer')
  it('should use OffscreenCanvas when available')
  it('should throttle to prevent overload')
})
```

**Implementation:**
- `src/lib/capture/frame-capture.ts`
- Efficient video-to-ImageData conversion

---

## Phase 10: End-to-End Tracking Pipeline

**Goal:** Wire everything together for real-time avatar animation.

#### Step 10.1: Tracking to Avatar Bridge
**Test First:**
```typescript
describe('TrackingToAvatar', () => {
  it('should apply tracking results to VRM animator on each frame')
  it('should interpolate between frames for smooth animation')
  it('should respect tracking feature toggles from settings')
  it('should handle missing tracking data gracefully')
})
```

**Implementation:**
- Connect tracking store to VRM animator
- Animation loop integration
- Feature flag handling

#### Step 10.2: Performance Monitoring
**Test First:**
```typescript
describe('PerformanceMonitor', () => {
  it('should measure frame processing time')
  it('should detect when frame time exceeds 16ms')
  it('should calculate rolling average FPS')
  it('should emit warnings when performance degrades')
})
```

**Implementation:**
- `src/lib/perf/monitor.ts`
- FPS counter component
- Performance warnings

#### Step 10.3: Full Integration Test
**Test First:**
```typescript
describe('Full Pipeline Integration', () => {
  it('should animate avatar from mock camera input')
  it('should maintain 60fps under normal conditions')
  it('should recover from temporary tracking loss')
  it('should handle settings changes without restart')
})
```

---

## Phase 11: User Experience Enhancements

**Goal:** Polish the UI for production use.

#### Step 11.1: Camera Preview
**Test First:**
```typescript
describe('CameraPreview', () => {
  it('should display live camera feed in corner')
  it('should be resizable by user')
  it('should be toggleable on/off')
  it('should show tracking overlay (landmarks visualization)')
})
```

**Implementation:**
- `src/components/camera-preview.tsx`
- Picture-in-picture style overlay
- Optional landmark visualization

#### Step 11.2: VRM Drag and Drop
**Test First:**
```typescript
describe('VRMDropZone', () => {
  it('should accept .vrm files via drag and drop')
  it('should show visual feedback during drag')
  it('should validate file before loading')
  it('should show loading progress')
  it('should display error for invalid files')
})
```

**Implementation:**
- `src/components/vrm-drop-zone.tsx`
- File validation
- Progress feedback

#### Step 11.3: Error States & Loading UI
**Test First:**
```typescript
describe('LoadingStates', () => {
  it('should show skeleton while VRM loads')
  it('should show camera permission prompt')
  it('should display friendly error messages')
  it('should offer retry actions for recoverable errors')
})
```

**Implementation:**
- `src/components/loading-skeleton.tsx`
- `src/components/error-boundary.tsx`
- User-friendly error messages

#### Step 11.4: Background Controls
**Test First:**
```typescript
describe('BackgroundSettings', () => {
  it('should allow solid color background')
  it('should allow transparent background (for OBS)')
  it('should allow custom image background')
  it('should persist background preference')
})
```

**Implementation:**
- Background color picker
- Transparency toggle for streaming

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

### 2026-02-04 (Update)
- Marked Phases 1-7 as complete with detailed status
- Identified gaps in current implementation (stubs, missing integrations)
- Added Phases 8-13 for next implementation steps
- Added phase dependency diagram and priority recommendations
- Updated project structure with planned files

### 2026-02-04
- Initial plan created from deep research analysis
- TDD implementation steps defined
