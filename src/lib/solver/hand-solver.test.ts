import { describe, it, expect } from 'vitest'
import { solveHand, type HandLandmarks } from './hand-solver'

// MediaPipe Hand landmarks: 0 is the wrist. Each finger has four, knuckle to
// tip: thumb 1-4, index 5-8, middle 9-12, ring 13-16, pinky 17-20.
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
  // With the palm facing the camera, the fingers curl along z. A metric on
  // image y alone reads ~0 for both hands below.

  function makePalmAtCameraHand(curled: boolean): HandLandmarks {
    const landmarks: HandLandmarks = []
    landmarks[0] = { x: 0.5, y: 0.6, z: 0 } // wrist
    // Thumb
    landmarks[1] = { x: 0.4, y: 0.55, z: 0 }
    landmarks[2] = { x: 0.35, y: 0.5, z: 0 }
    landmarks[3] = { x: 0.32, y: 0.46, z: 0 }
    landmarks[4] = { x: 0.3, y: 0.42, z: 0 }
    const fingerXs = [0.42, 0.5, 0.58, 0.66]
    const fingerNames = [5, 9, 13, 17] // MCP indices for index/middle/ring/pinky
    for (let i = 0; i < 4; i++) {
      const x = fingerXs[i]
      const mcpIdx = fingerNames[i]
      if (curled) {
        // The palm faces the camera, so curling folds the joints toward it (-z).
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

    expect(result.index.spread).toBeLessThan(0)
    expect(result.ring.spread).toBeGreaterThan(0)
    expect(Math.abs(Math.abs(result.index.spread) - Math.abs(result.ring.spread))).toBeLessThan(0.3)
  })
})

describe('Wrist frame', () => {
  // A left hand with the fingers pointing up on screen. For 'camera', the index
  // knuckle sits at the smaller x, as it does when a left palm faces the camera.
  // 'away' swaps the index and pinky knuckles.
  function makeReachingHand(palmDir: 'camera' | 'away'): HandLandmarks {
    const landmarks: HandLandmarks = []
    landmarks[0] = { x: 0.5, y: 0.5, z: 0 }
    const indexX = palmDir === 'camera' ? 0.42 : 0.58
    landmarks[5] = { x: indexX, y: 0.4, z: 0 }
    landmarks[9] = { x: 0.5, y: 0.4, z: 0 }
    landmarks[17] = { x: 1 - indexX, y: 0.4, z: 0 }
    landmarks[13] = {
      x: (landmarks[9].x + landmarks[17].x) / 2,
      y: 0.4,
      z: (landmarks[9].z + landmarks[17].z) / 2,
    }
    for (const base of [5, 9, 13, 17]) {
      const mcp = landmarks[base]
      for (let i = 1; i <= 3; i++) {
        landmarks[base + i] = { x: mcp.x, y: mcp.y - 0.08 * i, z: mcp.z }
      }
    }
    landmarks[1] = { x: 0.4, y: 0.45, z: 0 }
    landmarks[2] = { x: 0.35, y: 0.4, z: 0 }
    landmarks[3] = { x: 0.32, y: 0.35, z: 0 }
    landmarks[4] = { x: 0.3, y: 0.3, z: 0 }
    return landmarks
  }

  function dot(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
    return a.x * b.x + a.y * b.y + a.z * b.z
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
    expect(dot(cam.wristFrame!.palmNormal, away.wristFrame!.palmNormal)).toBeLessThan(-0.5)
  })

  it('hand axis points along the wrist→middleMCP direction', () => {
    const result = solveHand(makeReachingHand('camera'), 'left')!
    // The middle knuckle sits above the wrist on screen (smaller y), which is +Y in solver space.
    expect(result.wristFrame!.handAxis.y).toBeGreaterThan(0.5)
  })

  // rotationFromTwoPairs needs perpendicular axes, and real knuckles arch out of
  // the plane through the wrist and the index and pinky knuckles.
  it('keeps the hand axis perpendicular to the palm normal when the middle knuckle is off the palm plane', () => {
    const landmarks = makeReachingHand('camera')
    landmarks[9] = { ...landmarks[9], z: -0.012 }

    const frame = solveHand(landmarks, 'left')!.wristFrame!

    expect(Math.abs(dot(frame.handAxis, frame.palmNormal))).toBeLessThan(1e-9)
    expect(frame.handAxis.y).toBeGreaterThan(0.9)
  })
})
