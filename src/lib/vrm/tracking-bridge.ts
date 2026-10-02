import type { VRM } from '@pixiv/three-vrm'
import type { HolisticResult } from '../solver/holistic-solver'
import type { FaceResult } from '../solver/face-solver'
import type { PoseResult, ArmResult } from '../solver/pose-solver'
import type { HandResult, WristFrame } from '../solver/hand-solver'
import {
  eulerZYXToQuat,
  quatMul,
  quaternionToEulerZYX,
  rotationFromTwoPairs,
  type Quat,
} from '../math/quaternion'
import { ExponentialSmoother } from '../math/exponential-smoother'

export interface TrackingBridgeOptions {
  /** Default: true. */
  faceTracking?: boolean
  /** Default: true. */
  poseTracking?: boolean
  /** Default: true. */
  handTracking?: boolean
  /** 0 (no smoothing) to 1. Filter responsiveness is 1 - smoothing, at least 0.1. Default: 0.5. */
  smoothing?: number
}

interface EulerAngles {
  pitch: number
  yaw: number
  roll: number
}

/**
 * The rotation that the last update() wrote to one VRM bone. The stick-figure
 * debug overlay compares `raw` with `applied` to separate solver errors from
 * smoothing and sign errors.
 *
 * `applied` is the value written to bone.rotation: bone-local, ZYX order, after
 * smoothing and boneSign. `raw` is the solver output for that bone, before both.
 * For finger bones, `raw` holds the unitless curl in x and spread in z.
 */
export interface AppliedRotation {
  applied: { x: number; y: number; z: number }
  raw: { x: number; y: number; z: number }
}

export type AppliedRotations = Record<string, AppliedRotation>

type FilterMap = Map<string, ExponentialSmoother>

// Eye and mouth values ignore the smoothing setting, so blinks, gaze, and
// mouth shapes stay responsive while the head and body stay smooth.
const FAST_RESPONSIVENESS = 0.9

const FAST_RESPONSE_KEYS = new Set([
  'gazeX',
  'gazeY',
  'blendshape_blinkLeft',
  'blendshape_blinkRight',
  'blendshape_aa',
  'blendshape_happy',
])

// Smoothing 1 would give responsiveness 0, which freezes every bone.
const MIN_RESPONSIVENESS = 0.1

// Upper-arm roll for the arms-down pose: 72° below horizontal. Before boneSign,
// positive roll lowers the left arm and negative roll lowers the right arm.
const ARMS_DOWN_ROLL = Math.PI / 2.5

const FINGER_NAMES = ['thumb', 'index', 'middle', 'ring', 'pinky'] as const

export class TrackingBridge {
  private vrm: VRM
  private options: Required<TrackingBridgeOptions>
  private filters: FilterMap = new Map()
  private prevFaceActive = false
  private prevPoseActive = false
  private prevLeftHandActive = false
  private prevRightHandActive = false
  private appliedRotations: AppliedRotations = {}
  // Normalized bones rest with identity rotations in the VRM file's own frame,
  // the glTF scene root. VRMUtils.rotateVRM0 turns a VRM 0.x scene by π about Y,
  // so a bone rotation R acts in three.js world space with its X and Z
  // components negated. The solver and the fixed poses use that VRM 0.x
  // convention, so VRM 1.x (no scene rotation) negates X and Z here.
  // tracking-bridge.integration.test.ts shows that both versions then put the
  // hands at the same world positions. If an avatar arm points away from the
  // user's arm, the cause lies elsewhere, so do not change this sign.
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

  /** Rotations written by the last update(). Callers share the object, so they must not mutate it. */
  getAppliedRotations(): AppliedRotations {
    return this.appliedRotations
  }

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
          this.resetFiltersWithPrefix('spine_')
        }
        // The arm filters stay, so a dropped frame eases the arms toward the
        // default pose instead of snapping them there.
        this.applyDefaultArmPose()
      }
    }

    // The Hand Tracking checkbox in the settings panel starts unchecked
    // (handTrackingEnabled in settings-store.ts). If the fingers do not move,
    // check it before the rotation math.
    if (this.options.handTracking) {
      if (results.leftHand) {
        this.prevLeftHandActive = true
        this.applyHandTracking('left', results.leftHand)
        if (results.leftHand.wristFrame && results.pose?.leftArm) {
          this.applyWristTracking('left', results.leftHand.wristFrame, results.pose.leftArm)
        }
      } else if (this.prevLeftHandActive) {
        this.prevLeftHandActive = false
        this.resetHandFilters('left')
      }
      if (results.rightHand) {
        this.prevRightHandActive = true
        this.applyHandTracking('right', results.rightHand)
        if (results.rightHand.wristFrame && results.pose?.rightArm) {
          this.applyWristTracking('right', results.rightHand.wristFrame, results.pose.rightArm)
        }
      } else if (this.prevRightHandActive) {
        this.prevRightHandActive = false
        this.resetHandFilters('right')
      }
    }
  }

  private applyDefaultArmPose(): void {
    this.applyArmBone('leftUpperArm', { pitch: 0, yaw: 0, roll: ARMS_DOWN_ROLL })
    this.applyArmBone('rightUpperArm', { pitch: 0, yaw: 0, roll: -ARMS_DOWN_ROLL })
    this.applyArmBone('leftLowerArm', { pitch: 0, yaw: 0, roll: 0 })
    this.applyArmBone('rightLowerArm', { pitch: 0, yaw: 0, roll: 0 })
  }

  setOptions(options: Partial<TrackingBridgeOptions>): void {
    const { smoothing, ...toggles } = options
    this.options = { ...this.options, ...toggles }
    if (smoothing !== undefined) this.setSmoothing(smoothing)
  }

  /** Existing filters keep their state, so the bones do not jump. */
  setSmoothing(smoothing: number): void {
    this.options.smoothing = Math.max(0, Math.min(1, smoothing))
    for (const [key, filter] of this.filters) {
      filter.responsiveness = this.responsivenessFor(key)
    }
  }

  private applyFaceTracking(face: FaceResult): void {
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

    // Gaze values are in [-1, 1], so the eyes turn at most 30°. Before boneSign,
    // a positive pitch turns the eyes up in three.js world space, and gazeY > 0
    // means up.
    const gazeYaw = this.smoothValue('gazeX', face.eyes.gazeX) * (Math.PI / 6)
    const gazePitch = this.smoothValue('gazeY', face.eyes.gazeY) * (Math.PI / 6)
    for (const eyeName of ['leftEye', 'rightEye'] as const) {
      const eyeBone = this.vrm.humanoid.getNormalizedBoneNode(eyeName)
      if (eyeBone) {
        eyeBone.rotation.set(this.boneSign * gazePitch, gazeYaw, 0, 'ZYX')
      }
    }

    if (this.vrm.expressionManager) {
      this.applyBlendShape('blinkLeft', face.eyes.leftBlink)
      this.applyBlendShape('blinkRight', face.eyes.rightBlink)
      this.applyBlendShape('aa', face.mouth.open)
      this.applyBlendShape('happy', face.mouth.smile)
    }
  }

  private applyPoseTracking(pose: PoseResult): void {
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
      this.applyArmBone('leftUpperArm', { pitch: 0, yaw: 0, roll: ARMS_DOWN_ROLL })
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
      this.applyArmBone('rightUpperArm', { pitch: 0, yaw: 0, roll: -ARMS_DOWN_ROLL })
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
    // Normalized finger bones extend along their local X axis, so a rotation
    // about X only twists the finger. Curl rotates about Z and spread about Y.
    // In three.js world space, left fingers extend toward +X and right fingers
    // toward -X, so the same curl needs opposite signs (sideSign). boneSign is
    // the VRM version correction that the arms also use. Positive curl bends the
    // fingers toward world -Y.
    const sideSign = side === 'left' ? 1 : -1
    // Curl spreads over three joints, so a full curl makes a fist instead of
    // bending only the knuckle.
    const jointWeights = [
      { suffix: 'Proximal', curlFactor: 0.5, spreadFactor: 1 },
      { suffix: 'Intermediate', curlFactor: 0.5, spreadFactor: 0 },
      { suffix: 'Distal', curlFactor: 0.4, spreadFactor: 0 },
    ] as const

    for (const finger of FINGER_NAMES) {
      const fingerData = hand[finger]
      if (!fingerData) continue

      const capName = finger.charAt(0).toUpperCase() + finger.slice(1)
      for (const { suffix, curlFactor, spreadFactor } of jointWeights) {
        const boneName = `${side}${capName}${suffix}`
        const bone = this.vrm.humanoid.getNormalizedBoneNode(boneName as never)
        if (!bone) continue
        const curl = this.smoothValue(`${boneName}Curl`, fingerData.curl)
        const spread = this.smoothValue(`${boneName}Spread`, fingerData.spread)
        const rz = this.boneSign * sideSign * curl * Math.PI * curlFactor
        const ry = this.boneSign * sideSign * spread * (Math.PI / 6) * spreadFactor
        bone.rotation.set(0, ry, rz, 'ZYX')
        this.appliedRotations[boneName] = {
          applied: { x: 0, y: ry, z: rz },
          raw: { x: fingerData.curl, y: 0, z: fingerData.spread },
        }
      }
    }
  }

  /**
   * All vectors are in solver space (see toSolverSpace). R_target maps the
   * T-pose hand frame (hand axis and palm normal) onto the detected one. The
   * hand bone's local rotation is R_chain⁻¹ · R_target, where
   * R_chain = quat(shoulder) · quat(elbow).
   */
  private applyWristTracking(
    side: 'left' | 'right',
    wristFrame: WristFrame,
    arm: ArmResult,
  ): void {
    const boneName = side === 'left' ? 'leftHand' : 'rightHand'
    const bone = this.vrm.humanoid.getNormalizedBoneNode(boneName as never)
    if (!bone) return

    const restHandAxis = side === 'left'
      ? { x: -1, y: 0, z: 0 }
      : { x: 1, y: 0, z: 0 }
    // Palms down at T-pose matched the one test model. A model with palms
    // forward or inward at rest needs a different axis here.
    const restPalmNormal = { x: 0, y: -1, z: 0 }

    const qTarget = rotationFromTwoPairs(
      restHandAxis,
      restPalmNormal,
      wristFrame.handAxis,
      wristFrame.palmNormal,
    )

    const qShoulder = eulerZYXToQuat(arm.shoulder)
    const qElbow = eulerZYXToQuat(arm.elbow)
    const qChain = quatMul(qShoulder, qElbow)
    const qChainInv: Quat = [-qChain[0], -qChain[1], -qChain[2], qChain[3]]
    const qHandLocal = quatMul(qChainInv, qTarget)

    const eulerSolver = quaternionToEulerZYX(qHandLocal)

    const smoothedX = this.smoothValue(`${boneName}_x`, eulerSolver.x)
    const smoothedY = this.smoothValue(`${boneName}_y`, eulerSolver.y)
    const smoothedZ = this.smoothValue(`${boneName}_z`, eulerSolver.z)

    const x = this.boneSign * smoothedX
    const y = smoothedY
    const z = this.boneSign * smoothedZ
    bone.rotation.set(x, y, z, 'ZYX')
    this.appliedRotations[boneName] = {
      applied: { x, y, z },
      raw: { x: eulerSolver.x, y: eulerSolver.y, z: eulerSolver.z },
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
      filter = new ExponentialSmoother({ responsiveness: this.responsivenessFor(key) })
      this.filters.set(key, filter)
    }
    return filter.update(value)
  }

  private responsivenessFor(key: string): number {
    if (FAST_RESPONSE_KEYS.has(key)) return FAST_RESPONSIVENESS
    return Math.max(MIN_RESPONSIVENESS, 1 - this.options.smoothing)
  }

  private resetFiltersWithPrefix(...prefixes: string[]): void {
    for (const key of this.filters.keys()) {
      if (prefixes.some(p => key.startsWith(p))) {
        this.filters.delete(key)
      }
    }
  }

  // A bare 'left' prefix also matches the leftUpperArm and leftLowerArm filters.
  private resetHandFilters(side: 'left' | 'right'): void {
    this.resetFiltersWithPrefix(
      `${side}Hand_`,
      ...FINGER_NAMES.map((finger) => side + finger.charAt(0).toUpperCase() + finger.slice(1)),
    )
  }

  dispose(): void {
    this.filters.clear()
  }
}
