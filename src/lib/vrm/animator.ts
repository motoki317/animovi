/**
 * VRM Animator - Applies tracking results to VRM models.
 */

import type { VRM } from '@pixiv/three-vrm'
import type { HolisticResult } from '../solver/holistic-solver'

export class VRMAnimator {
  private vrm: VRM

  constructor(vrm: VRM) {
    this.vrm = vrm
  }

  /**
   * Apply tracking results to the VRM model.
   */
  apply(result: HolisticResult): void {
    this.applyFace(result.face)
    this.applyPose(result.pose)
  }

  private applyFace(face: HolisticResult['face']): void {
    if (!face) return

    // Apply head rotation
    const headBone = this.vrm.humanoid?.getNormalizedBoneNode('head')
    if (headBone) {
      headBone.rotation.x = face.head.pitch
      headBone.rotation.y = face.head.yaw
      headBone.rotation.z = face.head.roll
    }

    // Apply eye blendshapes
    this.vrm.expressionManager?.setValue('blinkLeft', face.eyes.leftBlink)
    this.vrm.expressionManager?.setValue('blinkRight', face.eyes.rightBlink)

    // Apply mouth blendshapes
    this.vrm.expressionManager?.setValue('aa', face.mouth.open)
    // Smile could be mapped to 'happy' expression if available
  }

  private applyPose(pose: HolisticResult['pose']): void {
    if (!pose) return

    // Apply spine rotation
    const spineBone = this.vrm.humanoid?.getNormalizedBoneNode('spine')
    if (spineBone) {
      spineBone.rotation.x = pose.spine.pitch
      spineBone.rotation.y = pose.spine.yaw
      spineBone.rotation.z = pose.spine.roll
    }
  }
}
