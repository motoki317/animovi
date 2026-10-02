/**
 * Pose landmark fixtures for the arm solver tests, in normalized MediaPipe
 * coordinates: x and y in [0, 1] from the image's top-left corner, and z
 * negative toward the camera. The left arm (11, 13, 15) has the larger x, as in
 * real footage.
 */

import type { PoseLandmarks } from '../solver/pose-solver'
import type { Vector3 } from '../math/vector'

export interface PoseFixture {
  name: string
  landmarks: PoseLandmarks
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

function createEmptyLandmarks(count = 33): PoseLandmarks {
  return Array.from({ length: count }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 1.0,
  }))
}

export function createArmFixture(params: {
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

export const T_POSE: PoseFixture = {
  name: 'T-Pose',
  landmarks: createArmFixture({
    leftShoulder: { x: 0.65, y: 0.30, z: 0 },
    leftElbow: { x: 0.80, y: 0.30, z: 0 },
    leftWrist: { x: 0.95, y: 0.30, z: 0 },
    rightShoulder: { x: 0.35, y: 0.30, z: 0 },
    rightElbow: { x: 0.20, y: 0.30, z: 0 },
    rightWrist: { x: 0.05, y: 0.30, z: 0 },
  }),
}

export const ARMS_FORWARD: PoseFixture = {
  name: 'Arms Forward',
  landmarks: createArmFixture({
    leftShoulder: { x: 0.65, y: 0.30, z: 0 },
    rightShoulder: { x: 0.35, y: 0.30, z: 0 },
    leftElbow: { x: 0.65, y: 0.30, z: -0.15 },
    rightElbow: { x: 0.35, y: 0.30, z: -0.15 },
    leftWrist: { x: 0.65, y: 0.30, z: -0.30 },
    rightWrist: { x: 0.35, y: 0.30, z: -0.30 },
  }),
}

export const ARMS_DOWN: PoseFixture = {
  name: 'Arms Down',
  landmarks: createArmFixture({
    leftShoulder: { x: 0.65, y: 0.30, z: 0 },
    rightShoulder: { x: 0.35, y: 0.30, z: 0 },
    leftElbow: { x: 0.65, y: 0.50, z: 0 },
    rightElbow: { x: 0.35, y: 0.50, z: 0 },
    leftWrist: { x: 0.65, y: 0.70, z: 0 },
    rightWrist: { x: 0.35, y: 0.70, z: 0 },
  }),
}

export const ARMS_UP: PoseFixture = {
  name: 'Arms Up',
  landmarks: createArmFixture({
    leftShoulder: { x: 0.65, y: 0.30, z: 0 },
    rightShoulder: { x: 0.35, y: 0.30, z: 0 },
    leftElbow: { x: 0.65, y: 0.15, z: 0 },
    rightElbow: { x: 0.35, y: 0.15, z: 0 },
    leftWrist: { x: 0.65, y: 0.02, z: 0 },
    rightWrist: { x: 0.35, y: 0.02, z: 0 },
  }),
}

/** Upper arms down and forward, forearms toward the camera, as when typing. */
export const ELBOWS_BENT: PoseFixture = {
  name: 'Elbows Bent',
  landmarks: createArmFixture({
    leftShoulder: { x: 0.65, y: 0.30, z: 0 },
    rightShoulder: { x: 0.35, y: 0.30, z: 0 },
    leftElbow: { x: 0.65, y: 0.45, z: -0.05 },
    rightElbow: { x: 0.35, y: 0.45, z: -0.05 },
    leftWrist: { x: 0.65, y: 0.45, z: -0.20 },
    rightWrist: { x: 0.35, y: 0.45, z: -0.20 },
  }),
}

export const ALL_FIXTURES: PoseFixture[] = [T_POSE, ARMS_FORWARD, ARMS_DOWN, ARMS_UP, ELBOWS_BENT]
