/**
 * Pose Fixtures - Test data for IK verification
 *
 * Contains landmark positions for common poses with expected outputs.
 * MediaPipe coordinate system: X (0-1 left-right), Y (0-1 top-bottom), Z (depth, negative=toward camera)
 */

import type { PoseLandmarks } from '../solver/pose-solver'

export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface PoseFixture {
  name: string
  description: string
  landmarks: PoseLandmarks
  expected: {
    leftArm: {
      shoulder: Vector3
      elbow: Vector3
    }
    rightArm: {
      shoulder: Vector3
      elbow: Vector3
    }
  }
  rotationTolerance?: number
}

/** MediaPipe Pose landmark indices */
export const LANDMARKS = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
} as const

/** Create empty landmarks array with default values */
export function createEmptyLandmarks(count = 33): PoseLandmarks {
  return Array.from({ length: count }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 1.0,
  }))
}

/** Helper to create fixture with arm landmarks */
export function createArmFixture(params: {
  name: string
  description: string
  leftShoulder: Vector3
  leftElbow: Vector3
  leftWrist: Vector3
  rightShoulder: Vector3
  rightElbow: Vector3
  rightWrist: Vector3
}): PoseLandmarks {
  const landmarks = createEmptyLandmarks()

  landmarks[LANDMARKS.LEFT_SHOULDER] = { ...params.leftShoulder, visibility: 1.0 }
  landmarks[LANDMARKS.RIGHT_SHOULDER] = { ...params.rightShoulder, visibility: 1.0 }
  landmarks[LANDMARKS.LEFT_ELBOW] = { ...params.leftElbow, visibility: 1.0 }
  landmarks[LANDMARKS.RIGHT_ELBOW] = { ...params.rightElbow, visibility: 1.0 }
  landmarks[LANDMARKS.LEFT_WRIST] = { ...params.leftWrist, visibility: 1.0 }
  landmarks[LANDMARKS.RIGHT_WRIST] = { ...params.rightWrist, visibility: 1.0 }
  landmarks[LANDMARKS.LEFT_HIP] = { x: 0.45, y: 0.7, z: 0, visibility: 1.0 }
  landmarks[LANDMARKS.RIGHT_HIP] = { x: 0.55, y: 0.7, z: 0, visibility: 1.0 }

  return landmarks
}

/**
 * T-Pose: Arms extended horizontally
 * In mirrored webcam view, person's left arm appears on RIGHT side of image (higher X)
 */
export const T_POSE: PoseFixture = {
  name: 'T-Pose',
  description: 'Arms extended horizontally to sides (VRM default)',
  landmarks: createArmFixture({
    name: 'T-Pose',
    description: 'Horizontal arms',
    // Person's left = higher X in mirrored view
    leftShoulder: { x: 0.65, y: 0.30, z: 0 },
    leftElbow: { x: 0.80, y: 0.30, z: 0 },
    leftWrist: { x: 0.95, y: 0.30, z: 0 },
    // Person's right = lower X in mirrored view
    rightShoulder: { x: 0.35, y: 0.30, z: 0 },
    rightElbow: { x: 0.20, y: 0.30, z: 0 },
    rightWrist: { x: 0.05, y: 0.30, z: 0 },
  }),
  expected: {
    leftArm: { shoulder: { x: 0, y: 0, z: 0 }, elbow: { x: 0, y: 0, z: 0 } },
    rightArm: { shoulder: { x: 0, y: 0, z: 0 }, elbow: { x: 0, y: 0, z: 0 } },
  },
  rotationTolerance: 0.3,
}

/**
 * Arms Forward: Extended toward camera
 * Z negative = toward camera in MediaPipe
 */
export const ARMS_FORWARD: PoseFixture = {
  name: 'Arms Forward',
  description: 'Arms extended forward toward camera',
  landmarks: createArmFixture({
    name: 'Arms Forward',
    description: 'Forward arms',
    leftShoulder: { x: 0.65, y: 0.30, z: 0 },
    rightShoulder: { x: 0.35, y: 0.30, z: 0 },
    // Arms straight forward - elbows and wrists have same X/Y as shoulders
    leftElbow: { x: 0.65, y: 0.30, z: -0.15 },
    rightElbow: { x: 0.35, y: 0.30, z: -0.15 },
    leftWrist: { x: 0.65, y: 0.30, z: -0.30 },
    rightWrist: { x: 0.35, y: 0.30, z: -0.30 },
  }),
  expected: {
    // Forward = positive X rotation (pitch forward) ~90 degrees
    leftArm: { shoulder: { x: Math.PI / 2, y: 0, z: 0 }, elbow: { x: 0, y: 0, z: 0 } },
    rightArm: { shoulder: { x: Math.PI / 2, y: 0, z: 0 }, elbow: { x: 0, y: 0, z: 0 } },
  },
  rotationTolerance: 0.5,
}

/**
 * Arms Down: Natural resting position
 */
export const ARMS_DOWN: PoseFixture = {
  name: 'Arms Down',
  description: 'Arms hanging at sides',
  landmarks: createArmFixture({
    name: 'Arms Down',
    description: 'Arms at sides',
    leftShoulder: { x: 0.65, y: 0.30, z: 0 },
    rightShoulder: { x: 0.35, y: 0.30, z: 0 },
    // Arms pointing down (higher Y in MediaPipe = lower in world)
    leftElbow: { x: 0.65, y: 0.50, z: 0 },
    rightElbow: { x: 0.35, y: 0.50, z: 0 },
    leftWrist: { x: 0.65, y: 0.70, z: 0 },
    rightWrist: { x: 0.35, y: 0.70, z: 0 },
  }),
  expected: {
    // Down = Z rotation (roll), opposite signs for left/right
    // Left arm: positive Z lowers arm in VRM
    // Right arm: negative Z lowers arm in VRM
    leftArm: { shoulder: { x: 0, y: 0, z: Math.PI / 2 }, elbow: { x: 0, y: 0, z: 0 } },
    rightArm: { shoulder: { x: 0, y: 0, z: -Math.PI / 2 }, elbow: { x: 0, y: 0, z: 0 } },
  },
  rotationTolerance: 0.5,
}

/**
 * Arms Up: Raised above head
 */
export const ARMS_UP: PoseFixture = {
  name: 'Arms Up',
  description: 'Arms raised above head',
  landmarks: createArmFixture({
    name: 'Arms Up',
    description: 'Arms raised',
    leftShoulder: { x: 0.65, y: 0.30, z: 0 },
    rightShoulder: { x: 0.35, y: 0.30, z: 0 },
    // Arms pointing up (lower Y in MediaPipe = higher in world)
    leftElbow: { x: 0.65, y: 0.15, z: 0 },
    rightElbow: { x: 0.35, y: 0.15, z: 0 },
    leftWrist: { x: 0.65, y: 0.02, z: 0 },
    rightWrist: { x: 0.35, y: 0.02, z: 0 },
  }),
  expected: {
    // Up = opposite Z rotation from down
    leftArm: { shoulder: { x: 0, y: 0, z: -Math.PI / 2 }, elbow: { x: 0, y: 0, z: 0 } },
    rightArm: { shoulder: { x: 0, y: 0, z: Math.PI / 2 }, elbow: { x: 0, y: 0, z: 0 } },
  },
  rotationTolerance: 0.5,
}

/**
 * Elbows Bent: Typing/relaxed position
 */
export const ELBOWS_BENT: PoseFixture = {
  name: 'Elbows Bent',
  description: 'Arms forward with bent elbows',
  landmarks: createArmFixture({
    name: 'Elbows Bent',
    description: 'Bent arms',
    leftShoulder: { x: 0.65, y: 0.30, z: 0 },
    rightShoulder: { x: 0.35, y: 0.30, z: 0 },
    // Elbows slightly down and forward
    leftElbow: { x: 0.65, y: 0.45, z: -0.05 },
    rightElbow: { x: 0.35, y: 0.45, z: -0.05 },
    // Wrists forward (bent 90 degrees)
    leftWrist: { x: 0.65, y: 0.45, z: -0.20 },
    rightWrist: { x: 0.35, y: 0.45, z: -0.20 },
  }),
  expected: {
    // Combination of down rotation and elbow bend
    leftArm: { shoulder: { x: 0.3, y: 0, z: 0.5 }, elbow: { x: -Math.PI / 2, y: 0, z: 0 } },
    rightArm: { shoulder: { x: 0.3, y: 0, z: -0.5 }, elbow: { x: -Math.PI / 2, y: 0, z: 0 } },
  },
  rotationTolerance: 0.6,
}

export const ALL_FIXTURES: PoseFixture[] = [T_POSE, ARMS_FORWARD, ARMS_DOWN, ARMS_UP, ELBOWS_BENT]
