import { describe, it, expect } from 'vitest'
import { solveFace, type FaceLandmarks } from './face-solver'

// MediaPipe Face Landmarker returns 478 landmarks. Head rotation reads the nose
// tip (1), forehead (10), and chin (152).
function createNeutralFaceLandmarks(): FaceLandmarks {
  const landmarks: FaceLandmarks = []
  for (let i = 0; i < 478; i++) {
    landmarks.push({ x: 0.5, y: 0.5, z: 0 })
  }
  landmarks[1] = { x: 0.5, y: 0.5, z: 0.05 } // nose tip
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
    expect(result!.head.pitch).toBeCloseTo(0, 1)
    expect(result!.head.yaw).toBeCloseTo(0, 1)
    expect(result!.head.roll).toBeCloseTo(0, 1)
  })

  it('should detect positive yaw when face turns right', () => {
    const landmarks = createNeutralFaceLandmarks()
    // Nose left of the image center: the subject turns to their right.
    landmarks[1] = { x: 0.3, y: 0.5, z: 0.02 }

    const result = solveFace(landmarks)

    expect(result).not.toBeNull()
    expect(result!.head.yaw).toBeGreaterThan(0.1)
  })

  it('detects positive pitch when the head tilts back (forehead farther than chin)', () => {
    const landmarks = createNeutralFaceLandmarks()
    // MediaPipe z grows away from the camera.
    landmarks[10] = { x: 0.5, y: 0.3, z: 0.03 }
    landmarks[152] = { x: 0.5, y: 0.7, z: -0.02 }

    const result = solveFace(landmarks)

    expect(result).not.toBeNull()
    expect(result!.head.pitch).toBeGreaterThan(0.1)
  })

  it('detects negative pitch when the head tilts forward (forehead closer than chin)', () => {
    const landmarks = createNeutralFaceLandmarks()
    landmarks[10] = { x: 0.5, y: 0.3, z: -0.02 }
    landmarks[152] = { x: 0.5, y: 0.7, z: 0.03 }

    const result = solveFace(landmarks)

    expect(result).not.toBeNull()
    expect(result!.head.pitch).toBeLessThan(-0.1)
  })

  it('should detect left eye blink when eye is closed', () => {
    const landmarks = createNeutralFaceLandmarks()
    // The upper lid (159) meets the lower lid (145) of the image-left eye.
    landmarks[159] = { x: 0.35, y: 0.38, z: 0 }
    landmarks[145] = { x: 0.35, y: 0.38, z: 0 }

    const result = solveFace(landmarks)

    expect(result).not.toBeNull()
    expect(result!.eyes.leftBlink).toBeGreaterThan(0.5)
  })

  it('should detect mouth open when lips are apart', () => {
    const landmarks = createNeutralFaceLandmarks()
    landmarks[13] = { x: 0.5, y: 0.6, z: 0 } // upper lip
    landmarks[14] = { x: 0.5, y: 0.7, z: 0 } // lower lip

    const result = solveFace(landmarks)

    expect(result).not.toBeNull()
    expect(result!.mouth.open).toBeGreaterThan(0.3)
  })

  it('should detect smile when the mouth widens', () => {
    const landmarks = createNeutralFaceLandmarks()
    // Smile reads only the width between the mouth corners (61, 291).
    landmarks[61] = { x: 0.35, y: 0.55, z: 0 }
    landmarks[291] = { x: 0.65, y: 0.55, z: 0 }

    const result = solveFace(landmarks)

    expect(result).not.toBeNull()
    expect(result!.mouth.smile).toBeGreaterThan(0.3)
  })
})

describe('Eye Gaze', () => {
  // The eye corners and lids bound each socket. The iris centers (468, 473) move inside it.
  function createGazeLandmarks(
    leftIrisX: number,
    leftIrisY: number,
    rightIrisX: number,
    rightIrisY: number
  ): FaceLandmarks {
    const landmarks = createNeutralFaceLandmarks()

    // Left eye corners (define the socket bounds)
    landmarks[33] = { x: 0.32, y: 0.42, z: 0 }  // outer corner
    landmarks[133] = { x: 0.42, y: 0.42, z: 0 }  // inner corner

    // Left eye upper/lower (for blink)
    landmarks[159] = { x: 0.37, y: 0.40, z: 0 } // upper
    landmarks[145] = { x: 0.37, y: 0.44, z: 0 } // lower

    // Right eye corners
    landmarks[263] = { x: 0.68, y: 0.42, z: 0 } // outer corner
    landmarks[362] = { x: 0.58, y: 0.42, z: 0 } // inner corner

    // Right eye upper/lower
    landmarks[386] = { x: 0.63, y: 0.40, z: 0 } // upper
    landmarks[374] = { x: 0.63, y: 0.44, z: 0 } // lower

    // Iris centers
    landmarks[468] = { x: leftIrisX, y: leftIrisY, z: 0 }
    landmarks[473] = { x: rightIrisX, y: rightIrisY, z: 0 }

    return landmarks
  }

  it('should detect near-zero gaze when iris is centered in eye socket', () => {
    const landmarks = createGazeLandmarks(0.37, 0.42, 0.63, 0.42)
    const result = solveFace(landmarks)!

    expect(Math.abs(result.eyes.gazeX)).toBeLessThan(0.15)
    expect(Math.abs(result.eyes.gazeY)).toBeLessThan(0.15)
  })

  it('should detect positive gazeX when looking right (iris shifted right in image)', () => {
    const landmarks = createGazeLandmarks(0.40, 0.42, 0.66, 0.42)
    const result = solveFace(landmarks)!

    expect(result.eyes.gazeX).toBeGreaterThan(0.2)
  })

  it('should detect negative gazeX when looking left', () => {
    const landmarks = createGazeLandmarks(0.34, 0.42, 0.60, 0.42)
    const result = solveFace(landmarks)!

    expect(result.eyes.gazeX).toBeLessThan(-0.2)
  })

  it('should detect positive gazeY when looking up (iris shifted up in image)', () => {
    // Both irises shifted up (lower Y in MediaPipe = higher in image)
    const landmarks = createGazeLandmarks(0.37, 0.40, 0.63, 0.40)
    const result = solveFace(landmarks)!

    expect(result.eyes.gazeY).toBeGreaterThan(0.2)
  })

  it('should detect negative gazeY when looking down', () => {
    // Both irises shifted down (higher Y in MediaPipe = lower in image)
    const landmarks = createGazeLandmarks(0.37, 0.44, 0.63, 0.44)
    const result = solveFace(landmarks)!

    expect(result.eyes.gazeY).toBeLessThan(-0.2)
  })

  it('should clamp gaze values to [-1, 1]', () => {
    // Extreme iris positions (outside normal eye socket)
    const landmarks = createGazeLandmarks(0.25, 0.35, 0.75, 0.35)
    const result = solveFace(landmarks)!

    expect(result.eyes.gazeX).toBeGreaterThanOrEqual(-1)
    expect(result.eyes.gazeX).toBeLessThanOrEqual(1)
    expect(result.eyes.gazeY).toBeGreaterThanOrEqual(-1)
    expect(result.eyes.gazeY).toBeLessThanOrEqual(1)
  })
})
