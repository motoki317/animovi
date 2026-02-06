import { describe, it, expect } from 'vitest'
import { solveFace, type FaceLandmarks } from './face-solver'

// MediaPipe Face Landmarker returns 478 landmarks
// Key landmarks for head rotation: nose tip (1), forehead (10), chin (152)
function createNeutralFaceLandmarks(): FaceLandmarks {
  const landmarks: FaceLandmarks = []
  for (let i = 0; i < 478; i++) {
    landmarks.push({ x: 0.5, y: 0.5, z: 0 })
  }
  // Position key landmarks for neutral pose (facing camera)
  landmarks[1] = { x: 0.5, y: 0.5, z: 0.05 } // nose tip (forward)
  landmarks[10] = { x: 0.5, y: 0.3, z: 0 } // forehead (above)
  landmarks[152] = { x: 0.5, y: 0.7, z: 0 } // chin (below)
  return landmarks
}

describe('FaceSolver', () => {
  it('should return null for empty landmarks array', () => {
    const landmarks: FaceLandmarks = []

    const result = solveFace(landmarks)

    expect(result).toBeNull()
  })

  it('should calculate near-zero head rotation for neutral face pose', () => {
    const landmarks = createNeutralFaceLandmarks()

    const result = solveFace(landmarks)

    expect(result).not.toBeNull()
    // Neutral pose should have near-zero rotation
    expect(result!.head.pitch).toBeCloseTo(0, 1)
    expect(result!.head.yaw).toBeCloseTo(0, 1)
    expect(result!.head.roll).toBeCloseTo(0, 1)
  })

  it('should detect positive yaw when face turns right', () => {
    const landmarks = createNeutralFaceLandmarks()
    // Shift nose to the left in image (face turned right from camera's view)
    landmarks[1] = { x: 0.3, y: 0.5, z: 0.02 }

    const result = solveFace(landmarks)

    expect(result).not.toBeNull()
    expect(result!.head.yaw).toBeGreaterThan(0.1)
  })

  it('should detect positive pitch when face tilts down (VRM: +X = forward/down)', () => {
    const landmarks = createNeutralFaceLandmarks()
    // Move forehead closer (forward) and chin back (head tilting down)
    // In MediaPipe face mesh: forward = more positive Z
    landmarks[10] = { x: 0.5, y: 0.3, z: 0.03 } // forehead forward
    landmarks[152] = { x: 0.5, y: 0.7, z: -0.02 } // chin back

    const result = solveFace(landmarks)

    expect(result).not.toBeNull()
    // VRM bone convention: positive X rotation = head tilts forward = looking down
    expect(result!.head.pitch).toBeGreaterThan(0.1)
  })

  it('should detect negative pitch when face tilts up (VRM: -X = backward/up)', () => {
    const landmarks = createNeutralFaceLandmarks()
    // Move chin forward and forehead back (head tilting up / looking up)
    landmarks[10] = { x: 0.5, y: 0.3, z: -0.02 } // forehead back
    landmarks[152] = { x: 0.5, y: 0.7, z: 0.03 } // chin forward

    const result = solveFace(landmarks)

    expect(result).not.toBeNull()
    // VRM bone convention: negative X rotation = head tilts backward = looking up
    expect(result!.head.pitch).toBeLessThan(-0.1)
  })

  it('should detect left eye blink when eye is closed', () => {
    const landmarks = createNeutralFaceLandmarks()
    // Left eye landmarks (upper: 159, lower: 145) - close them
    // Eye open: upper.y ~0.35, lower.y ~0.40 (5% gap)
    // Eye closed: upper.y ~0.38, lower.y ~0.38 (0% gap)
    landmarks[159] = { x: 0.35, y: 0.38, z: 0 } // upper lid down
    landmarks[145] = { x: 0.35, y: 0.38, z: 0 } // lower lid up (closed)

    const result = solveFace(landmarks)

    expect(result).not.toBeNull()
    expect(result!.eyes.leftBlink).toBeGreaterThan(0.5)
  })

  it('should detect mouth open when lips are apart', () => {
    const landmarks = createNeutralFaceLandmarks()
    // Mouth landmarks (upper lip: 13, lower lip: 14)
    landmarks[13] = { x: 0.5, y: 0.6, z: 0 } // upper lip
    landmarks[14] = { x: 0.5, y: 0.7, z: 0 } // lower lip (mouth open)

    const result = solveFace(landmarks)

    expect(result).not.toBeNull()
    expect(result!.mouth.open).toBeGreaterThan(0.3)
  })

  it('should detect smile when mouth corners are raised', () => {
    const landmarks = createNeutralFaceLandmarks()
    // Mouth corners: left (61), right (291)
    // Neutral: corners at y=0.58
    // Smile: corners raised (lower y value) and wider apart
    landmarks[61] = { x: 0.35, y: 0.55, z: 0 } // left corner raised
    landmarks[291] = { x: 0.65, y: 0.55, z: 0 } // right corner raised

    const result = solveFace(landmarks)

    expect(result).not.toBeNull()
    expect(result!.mouth.smile).toBeGreaterThan(0.3)
  })
})
