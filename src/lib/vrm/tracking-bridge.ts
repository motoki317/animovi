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

/**
 * Snapshot of the rotation actually written to a VRM bone in the last update.
 * Captured so the stick-figure debug overlay can compare "what was applied"
 * against the raw MediaPipe input — pinpointing whether arm-rotation shortfalls
 * live in the solver/clamp/smoothing or upstream in tracking.
 *
 * `applied` is the post-smoothing, post-boneSign value written to bone.rotation
 * (in the bone's local frame, ZYX order). `raw` is the input the bridge received
 * for that bone before smoothing — useful for isolating the smoothing contribution.
 */
export interface AppliedRotation {
  applied: { x: number; y: number; z: number }
  raw: { x: number; y: number; z: number }
}

export type AppliedRotations = Record<string, AppliedRotation>

type FilterMap = Map<string, KalmanFilter>

const FAST_RESPONSIVENESS = 0.9

const FAST_RESPONSE_KEYS = new Set([
  'gazeX',
  'gazeY',
  'blendshape_blinkLeft',
  'blendshape_blinkRight',
  'blendshape_aa',
  'blendshape_happy',
])

export class TrackingBridge {
  private vrm: VRM
  private options: Required<TrackingBridgeOptions>
  private filters: FilterMap = new Map()
  private prevFaceActive = false
  private prevPoseActive = false
  private prevLeftHandActive = false
  private prevRightHandActive = false
  private appliedRotations: AppliedRotations = {}
  // Bone rotation sign correction for VRM 1.x.
  // VRM 0.x is loaded with a PI scene rotation (VRMUtils.rotateVRM0), so the bone's
  // effective world rotation is conj(R, rotY(PI)) — equivalent to flipping the sign
  // of X and Z components of R. The solver and hardcoded poses were calibrated for
  // that convention. For VRM 1.x (no scene rotation, but rest-pose bone axes are
  // permuted), the effective world rotation is just R, so we must flip X/Z to match.
  private boneSign: 1 | -1

  constructor(vrm: VRM, options: TrackingBridgeOptions = {}) {
    this.vrm = vrm
    this.options = {
      faceTracking: options.faceTracking ?? true,
      poseTracking: options.poseTracking ?? true,
      handTracking: options.handTracking ?? true,
      smoothing: options.smoothing ?? 0.5,
    }
    this.boneSign = vrm.meta?.metaVersion === '1' ? -1 : 1
  }

  /**
   * Snapshot of the bone rotations applied during the most recent update().
   * Returned by reference for efficiency; do not mutate.
   */
  getAppliedRotations(): AppliedRotations {
    return this.appliedRotations
  }

  /**
   * Update VRM with tracking results
   */
  update(results: HolisticResult): void {
    this.appliedRotations = {}

    if (this.options.faceTracking) {
      if (results.face) {
        this.prevFaceActive = true
        this.applyFaceTracking(results.face)
      } else if (this.prevFaceActive) {
        this.prevFaceActive = false
        this.resetFiltersWithPrefix('head_', 'gaze')
      }
    }

    if (this.options.poseTracking) {
      if (results.pose) {
        this.prevPoseActive = true
        this.applyPoseTracking(results.pose)
      } else {
        if (this.prevPoseActive) {
          this.prevPoseActive = false
          this.resetFiltersWithPrefix('spine_', 'leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm')
        }
        // Apply natural "arms down" pose when tracking not available
        this.applyDefaultArmPose()
      }
    }

    if (this.options.handTracking) {
      if (results.leftHand) {
        this.prevLeftHandActive = true
        this.applyHandTracking('left', results.leftHand)
      } else if (this.prevLeftHandActive) {
        this.prevLeftHandActive = false
        this.resetFiltersWithPrefix('left')
      }
      if (results.rightHand) {
        this.prevRightHandActive = true
        this.applyHandTracking('right', results.rightHand)
      } else if (this.prevRightHandActive) {
        this.prevRightHandActive = false
        this.resetFiltersWithPrefix('right')
      }
    }
  }

  /**
   * Apply a natural "arms down" pose (relaxed standing position)
   */
  private applyDefaultArmPose(): void {
    // Arms naturally hang down from T-pose
    // Left arm: positive Z rotation lowers it
    // Right arm: negative Z rotation lowers it
    const armsDownAngle = Math.PI / 2.5 // About 72 degrees down from horizontal

    this.applyArmBone('leftUpperArm', {
      pitch: 0,
      yaw: 0,
      roll: armsDownAngle,
    })
    this.applyArmBone('rightUpperArm', {
      pitch: 0,
      yaw: 0,
      roll: -armsDownAngle,
    })
    // Keep lower arms straight
    this.applyArmBone('leftLowerArm', { pitch: 0, yaw: 0, roll: 0 })
    this.applyArmBone('rightLowerArm', { pitch: 0, yaw: 0, roll: 0 })
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
      const x = this.boneSign * smoothedRotation.pitch
      const y = smoothedRotation.yaw
      const z = this.boneSign * smoothedRotation.roll
      headBone.rotation.set(x, y, z, 'ZYX')
      this.appliedRotations.head = {
        applied: { x, y, z },
        raw: { x: face.head.pitch, y: face.head.yaw, z: face.head.roll },
      }
    }

    // Apply eye gaze to eye bones
    const gazeYaw = this.smoothValue('gazeX', face.eyes.gazeX) * (Math.PI / 6) // max ~30 degrees
    const gazePitch = this.smoothValue('gazeY', -face.eyes.gazeY) * (Math.PI / 6) // invert: VRM +X = down
    for (const eyeName of ['leftEye', 'rightEye'] as const) {
      const eyeBone = this.vrm.humanoid.getNormalizedBoneNode(eyeName)
      if (eyeBone) {
        eyeBone.rotation.set(this.boneSign * gazePitch, gazeYaw, 0, 'ZYX')
      }
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
      const x = this.boneSign * smoothedRotation.pitch
      const y = smoothedRotation.yaw
      const z = this.boneSign * smoothedRotation.roll
      spineBone.rotation.set(x, y, z, 'ZYX')
      this.appliedRotations.spine = {
        applied: { x, y, z },
        raw: { x: pose.spine.pitch, y: pose.spine.yaw, z: pose.spine.roll },
      }
    }

    // Apply arm rotations (fall back to default pose if arm not visible)
    const armsDownAngle = Math.PI / 2.5

    if (pose.leftArm) {
      this.applyArmBone('leftUpperArm', {
        pitch: pose.leftArm.shoulder.x,
        yaw: pose.leftArm.shoulder.y,
        roll: pose.leftArm.shoulder.z,
      })
      this.applyArmBone('leftLowerArm', {
        pitch: pose.leftArm.elbow.x,
        yaw: pose.leftArm.elbow.y,
        roll: pose.leftArm.elbow.z,
      })
    } else {
      this.applyArmBone('leftUpperArm', { pitch: 0, yaw: 0, roll: armsDownAngle })
      this.applyArmBone('leftLowerArm', { pitch: 0, yaw: 0, roll: 0 })
    }

    if (pose.rightArm) {
      this.applyArmBone('rightUpperArm', {
        pitch: pose.rightArm.shoulder.x,
        yaw: pose.rightArm.shoulder.y,
        roll: pose.rightArm.shoulder.z,
      })
      this.applyArmBone('rightLowerArm', {
        pitch: pose.rightArm.elbow.x,
        yaw: pose.rightArm.elbow.y,
        roll: pose.rightArm.elbow.z,
      })
    } else {
      this.applyArmBone('rightUpperArm', { pitch: 0, yaw: 0, roll: -armsDownAngle })
      this.applyArmBone('rightLowerArm', { pitch: 0, yaw: 0, roll: 0 })
    }
  }

  private applyArmBone(boneName: string, rotation: EulerAngles): void {
    const bone = this.vrm.humanoid.getNormalizedBoneNode(boneName as never)
    if (bone) {
      const smoothedRotation = this.smoothEuler(boneName, rotation)
      const x = this.boneSign * smoothedRotation.pitch
      const y = smoothedRotation.yaw
      const z = this.boneSign * smoothedRotation.roll
      bone.rotation.set(x, y, z, 'ZYX')
      this.appliedRotations[boneName] = {
        applied: { x, y, z },
        raw: { x: rotation.pitch, y: rotation.yaw, z: rotation.roll },
      }
    }
  }

  private applyHandTracking(side: 'left' | 'right', hand: HandResult): void {
    const prefix = side === 'left' ? 'left' : 'right'
    const fingerNames = ['thumb', 'index', 'middle', 'ring', 'pinky'] as const

    for (const finger of fingerNames) {
      const fingerData = hand[finger]
      if (!fingerData) continue

      // Apply curl and spread to proximal bone
      const boneName = `${prefix}${finger.charAt(0).toUpperCase()}${finger.slice(1)}Proximal`
      const bone = this.vrm.humanoid.getNormalizedBoneNode(boneName as never)
      if (bone) {
        const curl = this.smoothValue(`${boneName}Curl`, fingerData.curl)
        const spread = this.smoothValue(`${boneName}Spread`, fingerData.spread)
        // Curl is applied as X rotation (bending finger), max 90 degrees
        const rx = this.boneSign * curl * Math.PI * 0.5
        // Spread is applied as Z rotation (lateral splay), max ~30 degrees
        const rz = this.boneSign * spread * Math.PI / 6
        bone.rotation.x = rx
        bone.rotation.z = rz
        this.appliedRotations[boneName] = {
          applied: { x: rx, y: 0, z: rz },
          raw: { x: fingerData.curl, y: 0, z: fingerData.spread },
        }
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
      const responsiveness = FAST_RESPONSE_KEYS.has(key)
        ? FAST_RESPONSIVENESS
        : 1 - this.options.smoothing
      filter = new KalmanFilter({ responsiveness })
      this.filters.set(key, filter)
    }
    return filter.update(value)
  }

  /** Reset all Kalman filters whose key starts with any of the given prefixes */
  private resetFiltersWithPrefix(...prefixes: string[]): void {
    for (const key of this.filters.keys()) {
      if (prefixes.some(p => key.startsWith(p))) {
        this.filters.delete(key)
      }
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.filters.clear()
  }
}
