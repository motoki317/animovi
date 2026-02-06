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
