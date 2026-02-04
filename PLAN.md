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

### Phase 1: Foundation & Core Utilities

#### Step 1.1: Project Setup
- [ ] Initialize Next.js with TypeScript
- [ ] Configure Vitest for testing
- [ ] Set up ESLint and Prettier
- [ ] Create basic project structure

#### Step 1.2: Kalman Filter (Pure Logic, No Dependencies)
**Test First:**
```typescript
describe('KalmanFilter', () => {
  it('should smooth noisy input values')
  it('should respect responsiveness parameter')
  it('should handle rapid value changes')
  it('should work with 3D vectors (x, y, z)')
  it('should reset state when requested')
})
```

**Implementation:**
- `src/lib/math/kalman-filter.ts`
- `src/lib/math/kalman-filter.test.ts`

#### Step 1.3: Euler Angle Utilities
**Test First:**
```typescript
describe('EulerUtils', () => {
  it('should convert quaternion to euler angles')
  it('should clamp angles within valid range')
  it('should interpolate between two euler angles')
  it('should handle gimbal lock edge cases')
})
```

**Implementation:**
- `src/lib/math/euler-utils.ts`
- `src/lib/math/euler-utils.test.ts`

---

### Phase 2: Landmark Solver

#### Step 2.1: Face Solver
**Test First:**
```typescript
describe('FaceSolver', () => {
  it('should calculate head rotation from face landmarks')
  it('should extract eye blendshapes (blink left/right)')
  it('should extract mouth blendshapes (open, smile)')
  it('should return null for invalid landmark data')
  it('should normalize output values to 0-1 range')
})
```

**Implementation:**
- `src/lib/solver/face-solver.ts`
- `src/lib/solver/face-solver.test.ts`
- Use mock landmark data from MediaPipe samples

#### Step 2.2: Pose Solver
**Test First:**
```typescript
describe('PoseSolver', () => {
  it('should calculate spine rotation from pose landmarks')
  it('should calculate arm rotations (shoulder, elbow)')
  it('should handle missing landmarks gracefully')
  it('should respect visibility threshold')
})
```

**Implementation:**
- `src/lib/solver/pose-solver.ts`
- `src/lib/solver/pose-solver.test.ts`

#### Step 2.3: Hand Solver
**Test First:**
```typescript
describe('HandSolver', () => {
  it('should calculate finger rotations from hand landmarks')
  it('should differentiate left and right hands')
  it('should handle partially visible hands')
})
```

**Implementation:**
- `src/lib/solver/hand-solver.ts`
- `src/lib/solver/hand-solver.test.ts`

#### Step 2.4: Combined Solver
**Test First:**
```typescript
describe('HolisticSolver', () => {
  it('should combine face, pose, and hand results')
  it('should apply Kalman filter smoothing')
  it('should output VRM-compatible bone rotations')
  it('should output VRM-compatible blendshape values')
})
```

**Implementation:**
- `src/lib/solver/holistic-solver.ts`
- `src/lib/solver/holistic-solver.test.ts`

---

### Phase 3: Web Worker Infrastructure

#### Step 3.1: Worker Message Protocol
**Test First:**
```typescript
describe('WorkerProtocol', () => {
  it('should serialize landmark data efficiently')
  it('should deserialize solver results correctly')
  it('should handle error messages')
  it('should support configuration updates')
})
```

**Implementation:**
- `src/lib/worker/protocol.ts`
- `src/lib/worker/protocol.test.ts`

#### Step 3.2: Tracking Worker
**Test First:**
```typescript
describe('TrackingWorker', () => {
  it('should initialize MediaPipe on setup message')
  it('should process video frames and return landmarks')
  it('should apply solver and return bone rotations')
  it('should handle configuration changes')
  it('should report errors gracefully')
})
```

**Implementation:**
- `src/lib/worker/tracking.worker.ts`
- `src/lib/worker/tracking.worker.test.ts`
- Integration test with mock MediaPipe

---

### Phase 4: VRM Integration

#### Step 4.1: VRM Loader Hook
**Test First:**
```typescript
describe('useVRMLoader', () => {
  it('should load VRM file from URL')
  it('should load VRM file from File object')
  it('should apply optimization utils on load')
  it('should handle VRM 0.x and 1.0 formats')
  it('should report loading progress')
  it('should handle loading errors')
})
```

**Implementation:**
- `src/hooks/use-vrm-loader.ts`
- `src/hooks/use-vrm-loader.test.ts`

#### Step 4.2: VRM Animator
**Test First:**
```typescript
describe('VRMAnimator', () => {
  it('should apply bone rotations to VRM model')
  it('should apply blendshape values to VRM model')
  it('should interpolate between frames smoothly')
  it('should respect update rate limits')
})
```

**Implementation:**
- `src/lib/vrm/animator.ts`
- `src/lib/vrm/animator.test.ts`

---

### Phase 5: React Components

#### Step 5.1: Camera Provider
**Test First:**
```typescript
describe('CameraProvider', () => {
  it('should request camera permissions')
  it('should provide video stream to children')
  it('should handle permission denied')
  it('should allow camera switching')
  it('should clean up on unmount')
})
```

**Implementation:**
- `src/components/camera-provider.tsx`
- `src/components/camera-provider.test.tsx`

#### Step 5.2: Avatar Scene
**Test First:**
```typescript
describe('AvatarScene', () => {
  it('should render Three.js canvas')
  it('should display loaded VRM model')
  it('should update model pose from tracking data')
  it('should support background color/transparency')
  it('should handle window resize')
})
```

**Implementation:**
- `src/components/avatar-scene.tsx`
- `src/components/avatar-scene.test.tsx`

#### Step 5.3: Settings Panel
**Test First:**
```typescript
describe('SettingsPanel', () => {
  it('should toggle tracking features (face/pose/hands)')
  it('should adjust smoothing level')
  it('should change background color')
  it('should persist settings to localStorage')
})
```

**Implementation:**
- `src/components/settings-panel.tsx`
- `src/components/settings-panel.test.tsx`

---

### Phase 6: State Management

#### Step 6.1: Tracking Store
**Test First:**
```typescript
describe('useTrackingStore', () => {
  it('should store current bone rotations')
  it('should store current blendshape values')
  it('should track connection status')
  it('should compute derived state (isTracking)')
})
```

**Implementation:**
- `src/stores/tracking-store.ts`
- `src/stores/tracking-store.test.ts`

#### Step 6.2: Settings Store
**Test First:**
```typescript
describe('useSettingsStore', () => {
  it('should store tracking preferences')
  it('should store smoothing level')
  it('should store UI preferences')
  it('should persist to localStorage')
  it('should load from localStorage on init')
})
```

**Implementation:**
- `src/stores/settings-store.ts`
- `src/stores/settings-store.test.ts`

---

### Phase 7: Integration & E2E

#### Step 7.1: Main App Integration
**Test First:**
```typescript
describe('App Integration', () => {
  it('should load default VRM on start')
  it('should connect camera to tracking worker')
  it('should update avatar from tracking data')
  it('should apply settings changes in real-time')
})
```

#### Step 7.2: E2E Tests (Playwright)
```typescript
describe('E2E: VRM-Tuber', () => {
  it('should load app and display avatar')
  it('should request camera permission')
  it('should respond to settings changes')
  it('should handle VRM drag-and-drop')
})
```

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
│   │   ├── settings-panel.tsx
│   │   └── ui/                 # Reusable UI components
│   ├── hooks/                  # Custom React hooks
│   │   ├── use-vrm-loader.ts
│   │   ├── use-camera.ts
│   │   └── use-tracking.ts
│   ├── lib/                    # Core logic (framework-agnostic)
│   │   ├── math/
│   │   │   ├── kalman-filter.ts
│   │   │   └── euler-utils.ts
│   │   ├── solver/
│   │   │   ├── face-solver.ts
│   │   │   ├── pose-solver.ts
│   │   │   ├── hand-solver.ts
│   │   │   └── holistic-solver.ts
│   │   ├── vrm/
│   │   │   └── animator.ts
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

## References

- [VRM Studio](https://github.com/vucinatim/vrm-studio) - Reference implementation
- [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/guide)
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm)
- [Wawa Sensei Tutorial](https://wawasensei.dev/tuto/vrm-avatar-with-threejs-react-three-fiber-and-mediapipe)
- [KalidoKit (deprecated)](https://github.com/yeemachine/kalidokit) - Algorithm reference

---

## Changelog

### 2026-02-04
- Initial plan created from deep research analysis
- TDD implementation steps defined
