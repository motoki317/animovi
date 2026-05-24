import { describe, it, expect } from 'vitest'
import { solveHand, type HandLandmarks } from './hand-solver'

// MediaPipe Hand Landmarker returns 21 landmarks per hand
// Finger indices: thumb (1-4), index (5-8), middle (9-12), ring (13-16), pinky (17-20)
// 0 = wrist
function createOpenHandLandmarks(): HandLandmarks {
  const landmarks: HandLandmarks = []
  // Wrist at center
  landmarks[0] = { x: 0.5, y: 0.7, z: 0 }
  // Thumb (extended)
  landmarks[1] = { x: 0.35, y: 0.65, z: 0 }
  landmarks[2] = { x: 0.3, y: 0.6, z: 0 }
  landmarks[3] = { x: 0.25, y: 0.55, z: 0 }
  landmarks[4] = { x: 0.2, y: 0.5, z: 0 }
  // Index finger (extended - straight line up)
  landmarks[5] = { x: 0.4, y: 0.6, z: 0 }
  landmarks[6] = { x: 0.4, y: 0.5, z: 0 }
  landmarks[7] = { x: 0.4, y: 0.4, z: 0 }
  landmarks[8] = { x: 0.4, y: 0.3, z: 0 }
  // Middle finger (extended)
  landmarks[9] = { x: 0.5, y: 0.58, z: 0 }
  landmarks[10] = { x: 0.5, y: 0.48, z: 0 }
  landmarks[11] = { x: 0.5, y: 0.38, z: 0 }
  landmarks[12] = { x: 0.5, y: 0.28, z: 0 }
  // Ring finger (extended)
  landmarks[13] = { x: 0.6, y: 0.6, z: 0 }
  landmarks[14] = { x: 0.6, y: 0.5, z: 0 }
  landmarks[15] = { x: 0.6, y: 0.4, z: 0 }
  landmarks[16] = { x: 0.6, y: 0.3, z: 0 }
  // Pinky (extended)
  landmarks[17] = { x: 0.7, y: 0.62, z: 0 }
  landmarks[18] = { x: 0.7, y: 0.54, z: 0 }
  landmarks[19] = { x: 0.7, y: 0.46, z: 0 }
  landmarks[20] = { x: 0.7, y: 0.38, z: 0 }
  return landmarks
}

/**
 * Create hand landmarks with fingers splayed (spread apart laterally).
 * Each finger's tip deviates more in X from the MCP than in a normal open hand.
 */
function createSpreadHandLandmarks(): HandLandmarks {
  const landmarks = createOpenHandLandmarks()
  // Splay index finger to the left (lower X)
  landmarks[8] = { x: 0.25, y: 0.3, z: 0 } // tip shifted left
  // Keep middle finger straight (reference)
  // Splay ring finger to the right (higher X)
  landmarks[16] = { x: 0.75, y: 0.3, z: 0 } // tip shifted right
  // Splay pinky further right
  landmarks[20] = { x: 0.9, y: 0.38, z: 0 } // tip shifted far right
  return landmarks
}

/**
 * Create hand landmarks with all fingers parallel (no lateral spread).
 * All tips have the same X as their MCP joints.
 */
function createParallelFingerLandmarks(): HandLandmarks {
  const landmarks: HandLandmarks = []
  landmarks[0] = { x: 0.5, y: 0.7, z: 0 }
  // Thumb (keep normal position)
  landmarks[1] = { x: 0.35, y: 0.65, z: 0 }
  landmarks[2] = { x: 0.3, y: 0.6, z: 0 }
  landmarks[3] = { x: 0.25, y: 0.55, z: 0 }
  landmarks[4] = { x: 0.2, y: 0.5, z: 0 }
  // All 4 fingers: tips directly above MCP (X stays the same)
  // Index
  landmarks[5] = { x: 0.42, y: 0.6, z: 0 }
  landmarks[6] = { x: 0.42, y: 0.5, z: 0 }
  landmarks[7] = { x: 0.42, y: 0.4, z: 0 }
  landmarks[8] = { x: 0.42, y: 0.3, z: 0 }
  // Middle
  landmarks[9] = { x: 0.5, y: 0.58, z: 0 }
  landmarks[10] = { x: 0.5, y: 0.48, z: 0 }
  landmarks[11] = { x: 0.5, y: 0.38, z: 0 }
  landmarks[12] = { x: 0.5, y: 0.28, z: 0 }
  // Ring
  landmarks[13] = { x: 0.58, y: 0.6, z: 0 }
  landmarks[14] = { x: 0.58, y: 0.5, z: 0 }
  landmarks[15] = { x: 0.58, y: 0.4, z: 0 }
  landmarks[16] = { x: 0.58, y: 0.3, z: 0 }
  // Pinky
  landmarks[17] = { x: 0.66, y: 0.62, z: 0 }
  landmarks[18] = { x: 0.66, y: 0.54, z: 0 }
  landmarks[19] = { x: 0.66, y: 0.46, z: 0 }
  landmarks[20] = { x: 0.66, y: 0.38, z: 0 }
  return landmarks
}

describe('HandSolver', () => {
  it('should return null for empty landmarks array', () => {
    const landmarks: HandLandmarks = []

    const result = solveHand(landmarks, 'left')

    expect(result).toBeNull()
  })

  it('should detect low curl for extended fingers', () => {
    const landmarks = createOpenHandLandmarks()

    const result = solveHand(landmarks, 'left')

    expect(result).not.toBeNull()
    expect(result!.index.curl).toBeLessThan(0.3)
    expect(result!.middle.curl).toBeLessThan(0.3)
  })
})

describe('Finger curl with palm facing camera', () => {
  // Regression: the old Y-axis-only metric returned ~0 for both extended and
  // curled fingers when the palm faced the camera, because all curl motion was
  // along Z. The 3D joint-angle metric must distinguish the two cases.

  function makePalmAtCameraHand(curled: boolean): HandLandmarks {
    const landmarks: HandLandmarks = []
    landmarks[0] = { x: 0.5, y: 0.6, z: 0 } // wrist
    // Thumb
    landmarks[1] = { x: 0.4, y: 0.55, z: 0 }
    landmarks[2] = { x: 0.35, y: 0.5, z: 0 }
    landmarks[3] = { x: 0.32, y: 0.46, z: 0 }
    landmarks[4] = { x: 0.3, y: 0.42, z: 0 }
    // For each non-thumb finger, joints sit at the same X/Y when curled toward
    // the palm (camera) — the curl is all along -Z.
    const fingerXs = [0.42, 0.5, 0.58, 0.66]
    const fingerNames = [5, 9, 13, 17] // MCP indices for index/middle/ring/pinky
    for (let i = 0; i < 4; i++) {
      const x = fingerXs[i]
      const mcpIdx = fingerNames[i]
      if (curled) {
        // Curled toward palm: tip swings back along -Z and slightly back in Y
        landmarks[mcpIdx] = { x, y: 0.5, z: 0 }
        landmarks[mcpIdx + 1] = { x, y: 0.45, z: -0.03 }
        landmarks[mcpIdx + 2] = { x, y: 0.47, z: -0.07 }
        landmarks[mcpIdx + 3] = { x, y: 0.5, z: -0.08 }
      } else {
        // Extended straight up
        landmarks[mcpIdx] = { x, y: 0.5, z: 0 }
        landmarks[mcpIdx + 1] = { x, y: 0.42, z: 0 }
        landmarks[mcpIdx + 2] = { x, y: 0.34, z: 0 }
        landmarks[mcpIdx + 3] = { x, y: 0.26, z: 0 }
      }
    }
    return landmarks
  }

  it('reports low curl for extended fingers with palm facing camera', () => {
    const result = solveHand(makePalmAtCameraHand(false), 'left')!
    expect(result.index.curl).toBeLessThan(0.15)
    expect(result.middle.curl).toBeLessThan(0.15)
    expect(result.ring.curl).toBeLessThan(0.15)
    expect(result.pinky.curl).toBeLessThan(0.15)
  })

  it('reports high curl for curled fingers with palm facing camera', () => {
    const result = solveHand(makePalmAtCameraHand(true), 'left')!
    expect(result.index.curl).toBeGreaterThan(0.3)
    expect(result.middle.curl).toBeGreaterThan(0.3)
    expect(result.ring.curl).toBeGreaterThan(0.3)
    expect(result.pinky.curl).toBeGreaterThan(0.3)
  })
})

describe('Finger Spread', () => {
  it('should detect near-zero spread for parallel fingers', () => {
    const landmarks = createParallelFingerLandmarks()
    const result = solveHand(landmarks, 'left')!

    // When all fingers point straight up (parallel), spread should be near zero
    expect(Math.abs(result.index.spread)).toBeLessThan(0.15)
    expect(Math.abs(result.middle.spread)).toBeLessThan(0.15)
    expect(Math.abs(result.ring.spread)).toBeLessThan(0.15)
    expect(Math.abs(result.pinky.spread)).toBeLessThan(0.15)
  })

  it('should detect lateral spread in splayed fingers', () => {
    const landmarks = createSpreadHandLandmarks()
    const result = solveHand(landmarks, 'left')!

    // Index finger splayed left: negative spread (away from middle)
    expect(result.index.spread).toBeLessThan(-0.1)
    // Ring finger splayed right: positive spread (away from middle)
    expect(result.ring.spread).toBeGreaterThan(0.1)
    // Pinky splayed even further right
    expect(result.pinky.spread).toBeGreaterThan(0.1)
  })

  it('should have spread values clamped to [-1, 1] range', () => {
    const landmarks = createSpreadHandLandmarks()
    const result = solveHand(landmarks, 'left')!

    const fingers = ['thumb', 'index', 'middle', 'ring', 'pinky'] as const
    for (const finger of fingers) {
      expect(result[finger].spread).toBeGreaterThanOrEqual(-1)
      expect(result[finger].spread).toBeLessThanOrEqual(1)
    }
  })

  it('should produce opposite spread signs for symmetrically splayed fingers', () => {
    const landmarks = createOpenHandLandmarks()
    // Make index and ring symmetrically spread from middle
    landmarks[8] = { x: 0.3, y: 0.3, z: 0 }   // index tip moved left by 0.1
    landmarks[16] = { x: 0.7, y: 0.3, z: 0 }  // ring tip moved right by 0.1

    const result = solveHand(landmarks, 'left')!

    // Index spread and ring spread should be roughly opposite
    expect(result.index.spread).toBeLessThan(0)
    expect(result.ring.spread).toBeGreaterThan(0)
    // Approximately symmetric in magnitude
    expect(Math.abs(Math.abs(result.index.spread) - Math.abs(result.ring.spread))).toBeLessThan(0.3)
  })
})

describe('Wrist frame', () => {
  // For wrist rotation we model the user with their left forearm extended toward
  // the camera (mostly along +Z in MediaPipe screen space → forward in VRM space)
  // and vary the palm orientation. The forearm direction is passed in from the
  // pose pipeline (MediaPipe Pose) — hand-only landmarks can't determine which
  // way the forearm extends.

  // Build a left hand reaching toward the camera. Wrist sits at screen center,
  // middleMCP is slightly above wrist on screen (fingers point up — opposite
  // gravity), and palm orientation is parameterized.
  //   palmDir = 'camera'  → palm faces camera (palm normal toward camera)
  //   palmDir = 'away'    → back of hand faces camera
  //   palmDir = 'up'      → palm faces ceiling
  //   palmDir = 'down'    → palm faces floor
  function makeReachingHand(palmDir: 'camera' | 'away' | 'up' | 'down'): HandLandmarks {
    const landmarks: HandLandmarks = []
    // wrist
    landmarks[0] = { x: 0.5, y: 0.5, z: 0 }
    // We arrange index MCP (5), middle MCP (9), pinky MCP (17) such that
    //   cross(indexMCP - wrist, pinkyMCP - wrist) points in the palm-normal direction.
    //
    // In MediaPipe screen space (X right, Y down, Z out-of-screen ≈ toward camera
    // negative), and after toVRMSpace (X flipped, Y flipped, Z preserved), the
    // VRM-space palm normal direction we want is:
    //   camera → palm faces camera → palm normal at -Z (MediaPipe convention: toward camera = -Z)
    //   away   → +Z
    //   up     → +Y in VRM space (= -Y in MediaPipe screen space → smaller landmark Y)
    //   down   → -Y in VRM space (= +Y in MediaPipe screen space → larger landmark Y)
    //
    // For a LEFT hand, the spread (index → middle → pinky in screen) appears
    // mirrored: as drawn on screen, the thumb is to the right (higher X). So:
    //   index MCP is to the LEFT of middle MCP (lower X)
    //   pinky MCP is to the RIGHT of middle MCP (higher X)
    // Wait — for the user's LEFT hand viewed in a mirror (selfie), the thumb
    // appears on the LEFT side of the screen. The handedness MediaPipe reports
    // matches the physical hand. We'll build the landmarks consistently with
    // the existing createSpreadHandLandmarks() which has index at lower X for
    // left side. (Verified by the existing spread tests.)
    const mid = { x: 0.5, y: 0.4, z: 0 } // fingers point upward on screen
    // Offsets for index and pinky in the palm plane, depending on palm orientation:
    // For palm facing camera (rest), the spread is purely along X (in MediaPipe).
    // For palm-up, spread is along Z (toward camera).
    if (palmDir === 'camera') {
      // palm normal toward camera (MediaPipe -Z = VRM -Z)
      landmarks[5] = { x: 0.42, y: 0.4, z: 0 }   // index MCP (left in MP space)
      landmarks[9] = mid
      landmarks[17] = { x: 0.58, y: 0.4, z: 0 }  // pinky MCP (right in MP space)
    } else if (palmDir === 'away') {
      // palm normal away from camera (+Z in VRM)
      // Reverse the X spread so cross product flips sign
      landmarks[5] = { x: 0.58, y: 0.4, z: 0 }   // index now on right (back of hand showing)
      landmarks[9] = mid
      landmarks[17] = { x: 0.42, y: 0.4, z: 0 }
    } else if (palmDir === 'up') {
      // palm faces +Y in VRM (ceiling)
      // Cross(index-wrist, pinky-wrist) should point along +Y in VRM = -Y in MP screen
      // index and pinky differ in Z (depth) instead of X
      landmarks[5] = { x: 0.5, y: 0.4, z: -0.08 } // index closer to camera
      landmarks[9] = mid
      landmarks[17] = { x: 0.5, y: 0.4, z: 0.08 } // pinky farther
    } else { // down
      landmarks[5] = { x: 0.5, y: 0.4, z: 0.08 }
      landmarks[9] = mid
      landmarks[17] = { x: 0.5, y: 0.4, z: -0.08 }
    }
    // Ring MCP between middle and pinky.
    landmarks[13] = {
      x: (landmarks[9].x + landmarks[17].x) / 2,
      y: 0.4,
      z: (landmarks[9].z + landmarks[17].z) / 2,
    }
    // Fill PIP/DIP/TIP for each finger (fingers point up — decreasing Y).
    for (const base of [5, 9, 13, 17]) {
      const mcp = landmarks[base]
      for (let i = 1; i <= 3; i++) {
        landmarks[base + i] = { x: mcp.x, y: mcp.y - 0.08 * i, z: mcp.z }
      }
    }
    // Thumb (extended sideways).
    landmarks[1] = { x: 0.4, y: 0.45, z: 0 }
    landmarks[2] = { x: 0.35, y: 0.4, z: 0 }
    landmarks[3] = { x: 0.32, y: 0.35, z: 0 }
    landmarks[4] = { x: 0.3, y: 0.3, z: 0 }
    return landmarks
  }

  it('returns a wristFrame with hand axis and palm normal for a valid hand', () => {
    const result = solveHand(makeReachingHand('camera'), 'left')!
    expect(result.wristFrame).not.toBeNull()
    expect(typeof result.wristFrame!.handAxis.x).toBe('number')
    expect(typeof result.wristFrame!.palmNormal.x).toBe('number')
  })

  it('palm normal points opposite direction for palm-to-camera vs palm-away', () => {
    const cam = solveHand(makeReachingHand('camera'), 'left')!
    const away = solveHand(makeReachingHand('away'), 'left')!
    // Dot product should be strongly negative for flipped palm orientations.
    const dot =
      cam.wristFrame!.palmNormal.x * away.wristFrame!.palmNormal.x +
      cam.wristFrame!.palmNormal.y * away.wristFrame!.palmNormal.y +
      cam.wristFrame!.palmNormal.z * away.wristFrame!.palmNormal.z
    expect(dot).toBeLessThan(-0.5)
  })

  it('hand axis points along the wrist→middleMCP direction', () => {
    const result = solveHand(makeReachingHand('camera'), 'left')!
    // For makeReachingHand, middleMCP is above the wrist on screen
    // (smaller MP y), which becomes larger solver y after the Y-flip in
    // toVRMSpace. So handAxis.y should be positive.
    expect(result.wristFrame!.handAxis.y).toBeGreaterThan(0.5)
  })
})
