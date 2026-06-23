/**
 * Holistic Solver - Combines face, pose, and hand solving.
 */

import { solveFace, type FaceLandmarks, type FaceResult } from './face-solver'
import { solvePose, type PoseLandmarks, type PoseResult } from './pose-solver'
import { solveHand, type HandLandmarks, type HandResult } from './hand-solver'

export interface HolisticLandmarks {
  face: FaceLandmarks
  pose: PoseLandmarks
  // Metric 3D pose landmarks (poseWorldLandmarks); optional for face-only callers.
  poseWorld?: PoseLandmarks
  leftHand: HandLandmarks
  rightHand: HandLandmarks
}

export interface HolisticResult {
  face: FaceResult | null
  pose: PoseResult | null
  leftHand: HandResult | null
  rightHand: HandResult | null
}

export function solveHolistic(landmarks: HolisticLandmarks): HolisticResult {
  return {
    face: solveFace(landmarks.face),
    pose: solvePose(landmarks.pose, landmarks.poseWorld),
    leftHand: solveHand(landmarks.leftHand, 'left'),
    rightHand: solveHand(landmarks.rightHand, 'right'),
  }
}
