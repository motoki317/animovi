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

describe('Eye Gaze', () => {
  /**
   * Set up eye landmarks for gaze testing.
   * Eye corners define the eye socket; iris center moves within it.
   *
   * Left eye: inner corner 133, outer corner 33
   * Right eye: inner corner 362, outer corner 263
   * Left iris center: 468
   * Right iris center: 473
   */
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
    // Iris at center of eye socket
    const landmarks = createGazeLandmarks(0.37, 0.42, 0.63, 0.42)
    const result = solveFace(landmarks)!

    expect(Math.abs(result.eyes.gazeX)).toBeLessThan(0.15)
    expect(Math.abs(result.eyes.gazeY)).toBeLessThan(0.15)
  })

  it('should detect positive gazeX when looking right (iris shifted right in image)', () => {
    // Both irises shifted right within their eye sockets
    const landmarks = createGazeLandmarks(0.40, 0.42, 0.66, 0.42)
    const result = solveFace(landmarks)!

    // Looking right in image = positive gazeX (user's right from mirrored camera)
    expect(result.eyes.gazeX).toBeGreaterThan(0.2)
  })

  it('should detect negative gazeX when looking left', () => {
    // Both irises shifted left within their eye sockets
    const landmarks = createGazeLandmarks(0.34, 0.42, 0.60, 0.42)
    const result = solveFace(landmarks)!

    expect(result.eyes.gazeX).toBeLessThan(-0.2)
  })

  it('should detect positive gazeY when looking up (iris shifted up in image)', () => {
    // Both irises shifted up (lower Y in MediaPipe = higher in image)
    const landmarks = createGazeLandmarks(0.37, 0.40, 0.63, 0.40)
    const result = solveFace(landmarks)!

    // Looking up = positive gazeY
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
