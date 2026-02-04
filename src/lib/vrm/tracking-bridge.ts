/**
 * TrackingBridge - Connects tracking results to VRM avatar animation.
 * Applies solver output to VRM bones and expressions with optional smoothing.
 */

import type { VRM } from '@pixiv/three-vrm'
import type { HolisticResult } from '../solver/holistic-solver'
import type { FaceResult } from '../solver/face-solver'
import type { PoseResult } from '../solver/pose-solver'
import type { HandResult } from '../solver/hand-solver'
import { KalmanFilter } from '../math/kalman-filter'

export interface TrackingBridgeOptions {
  /** Enable face tracking (default: true) */
  faceTracking?: boolean
  /** Enable pose tracking (default: true) */
  poseTracking?: boolean
  /** Enable hand tracking (default: true) */
  handTracking?: boolean
  /** Smoothing factor 0-1 (default: 0.5) */
  smoothing?: number
}

interface EulerAngles {
  pitch: number
  yaw: number
  roll: number
}

type FilterMap = Map<string, KalmanFilter>

export class TrackingBridge {
  private vrm: VRM
  private options: Required<TrackingBridgeOptions>
  private filters: FilterMap = new Map()

  constructor(vrm: VRM, options: TrackingBridgeOptions = {}) {
    this.vrm = vrm
    this.options = {
      faceTracking: options.faceTracking ?? true,
      poseTracking: options.poseTracking ?? true,
      handTracking: options.handTracking ?? true,
      smoothing: options.smoothing ?? 0.5,
    }
  }

  /**
   * Update VRM with tracking results
   */
  update(results: HolisticResult): void {
    if (this.options.faceTracking && results.face) {
      this.applyFaceTracking(results.face)
    }

    if (this.options.poseTracking && results.pose) {
      this.applyPoseTracking(results.pose)
    }

    if (this.options.handTracking) {
      if (results.leftHand) {
        this.applyHandTracking('left', results.leftHand)
      }
      if (results.rightHand) {
        this.applyHandTracking('right', results.rightHand)
      }
    }
  }

  /**
   * Update options dynamically
   */
  setOptions(options: Partial<TrackingBridgeOptions>): void {
    this.options = { ...this.options, ...options }
  }

  /**
   * Update smoothing factor
   */
  setSmoothing(smoothing: number): void {
    this.options.smoothing = Math.max(0, Math.min(1, smoothing))
    // Clear filters to recreate with new responsiveness
    this.filters.clear()
  }

  private applyFaceTracking(face: FaceResult): void {
    // Apply head rotation
    const headBone = this.vrm.humanoid.getNormalizedBoneNode('head')
    if (headBone) {
      const smoothedRotation = this.smoothEuler('head', face.head)
      headBone.rotation.set(
        smoothedRotation.pitch,
        smoothedRotation.yaw,
        smoothedRotation.roll
      )
    }

    // Apply blendshapes
    if (this.vrm.expressionManager) {
      this.applyBlendShape('blinkLeft', face.eyes.leftBlink)
      this.applyBlendShape('blinkRight', face.eyes.rightBlink)
      this.applyBlendShape('aa', face.mouth.open) // VRM uses 'aa' for mouth open
      this.applyBlendShape('happy', face.mouth.smile) // VRM uses 'happy' for smile
    }
  }

  private applyPoseTracking(pose: PoseResult): void {
    // Apply spine rotation
    const spineBone = this.vrm.humanoid.getNormalizedBoneNode('spine')
    if (spineBone) {
      const smoothedRotation = this.smoothEuler('spine', pose.spine)
      spineBone.rotation.set(
        smoothedRotation.pitch,
        smoothedRotation.yaw,
        smoothedRotation.roll
      )
    }

    // Apply arm rotations
    this.applyArmBone('leftUpperArm', {
      pitch: pose.leftArm.shoulder.x,
      yaw: pose.leftArm.shoulder.y,
      roll: pose.leftArm.shoulder.z,
    })
    this.applyArmBone('rightUpperArm', {
      pitch: pose.rightArm.shoulder.x,
      yaw: pose.rightArm.shoulder.y,
      roll: pose.rightArm.shoulder.z,
    })
    this.applyArmBone('leftLowerArm', {
      pitch: pose.leftArm.elbow.x,
      yaw: pose.leftArm.elbow.y,
      roll: pose.leftArm.elbow.z,
    })
    this.applyArmBone('rightLowerArm', {
      pitch: pose.rightArm.elbow.x,
      yaw: pose.rightArm.elbow.y,
      roll: pose.rightArm.elbow.z,
    })
  }

  private applyArmBone(boneName: string, rotation: EulerAngles): void {
    const bone = this.vrm.humanoid.getNormalizedBoneNode(boneName as never)
    if (bone) {
      const smoothedRotation = this.smoothEuler(boneName, rotation)
      bone.rotation.set(
        smoothedRotation.pitch,
        smoothedRotation.yaw,
        smoothedRotation.roll
      )
    }
  }

  private applyHandTracking(side: 'left' | 'right', hand: HandResult): void {
    const prefix = side === 'left' ? 'left' : 'right'
    const fingerNames = ['thumb', 'index', 'middle', 'ring', 'pinky'] as const

    for (const finger of fingerNames) {
      const fingerData = hand[finger]
      if (!fingerData) continue

      // Apply curl to proximal bone (simplified - real impl would do all phalanges)
      const boneName = `${prefix}${finger.charAt(0).toUpperCase()}${finger.slice(1)}Proximal`
      const bone = this.vrm.humanoid.getNormalizedBoneNode(boneName as never)
      if (bone) {
        const curl = this.smoothValue(`${boneName}Curl`, fingerData.curl)
        // Curl is applied as X rotation (bending finger)
        bone.rotation.x = curl * Math.PI * 0.5 // Max 90 degrees
      }
    }
  }

  private applyBlendShape(name: string, value: number): void {
    if (this.vrm.expressionManager) {
      const smoothedValue = this.smoothValue(`blendshape_${name}`, value)
      this.vrm.expressionManager.setValue(name, smoothedValue)
    }
  }

  private smoothEuler(key: string, angles: EulerAngles): EulerAngles {
    return {
      pitch: this.smoothValue(`${key}_pitch`, angles.pitch),
      yaw: this.smoothValue(`${key}_yaw`, angles.yaw),
      roll: this.smoothValue(`${key}_roll`, angles.roll),
    }
  }

  private smoothValue(key: string, value: number): number {
    let filter = this.filters.get(key)
    if (!filter) {
      filter = new KalmanFilter({ responsiveness: 1 - this.options.smoothing })
      this.filters.set(key, filter)
    }
    return filter.update(value)
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.filters.clear()
  }
}
