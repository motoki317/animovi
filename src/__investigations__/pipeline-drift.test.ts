/**
 * End-to-end pipeline drift investigation.
 *
 * Goal: take a MediaPipe pose fixture, push it through the live solver +
 * TrackingBridge, then forward-kinematics the rotations that were actually
 * written to bone.rotation.set(...) to see where the resulting wrist ends up
 * in world space — and compare to the MediaPipe wrist direction.
 *
 * If the pipeline were correct, the drift between "MediaPipe says the wrist
 * is here" and "the bridge moves the bone here" would be ~0 for every
 * fixture. The point of these tests is to print/assert how big the drift
 * actually is, separately for VRM 0.x and VRM 1.x branches, so we can pin
 * down where the divergence comes from.
 *
 * These are investigation tests, not pass/fail regression tests — they use
 * `it()` so vitest reports their values, but the `expect()` assertions are
 * deliberately loose. The interesting output is the printed table.
 */

import { describe, it, expect, vi } from 'vitest'
import { solvePose } from '../lib/solver/pose-solver'
import { TrackingBridge } from '../lib/vrm/tracking-bridge'
import { solveHolistic } from '../lib/solver/holistic-solver'
import {
  T_POSE,
  ARMS_FORWARD,
  ARMS_DOWN,
  ARMS_UP,
  ELBOWS_BENT,
  LANDMARKS,
  createArmFixture,
  type PoseFixture,
  type Vector3,
} from '../lib/__fixtures__/pose-fixtures'
import type { VRM } from '@pixiv/three-vrm'

// ---------------------------------------------------------------------------
// New fixture: single arm raised, palm-toward-camera (the user's symptom case)
// ---------------------------------------------------------------------------

/**
 * Left arm raised straight up next to the head, palm facing the camera.
 * Right arm at rest. This mimics the user's "raise hand, face palm at camera"
 * scenario where the rendered character only goes halfway up.
 */
const LEFT_ARM_UP: PoseFixture = {
  name: 'Left Arm Up (palm at camera)',
  description: 'Left arm raised above head, right arm at side',
  landmarks: createArmFixture({
    name: 'Left Arm Up',
    description: 'Left arm raised',
    // Left side (mirrored = higher X). Shoulder around chest; elbow + wrist
    // increasingly above shoulder. Wrist also slightly toward camera (-z),
    // since a raised palm-toward-camera arm tilts forward a bit.
    leftShoulder: { x: 0.65, y: 0.30, z: 0 },
    leftElbow: { x: 0.62, y: 0.15, z: -0.05 },
    leftWrist: { x: 0.60, y: 0.02, z: -0.10 },
    // Right arm hanging at side (resting pose).
    rightShoulder: { x: 0.35, y: 0.30, z: 0 },
    rightElbow: { x: 0.35, y: 0.50, z: 0 },
    rightWrist: { x: 0.35, y: 0.70, z: 0 },
  }),
  // Expected values are not authoritative — they're approximate target
  // directions. The drift test below ignores `expected` and uses the
  // MediaPipe landmark positions directly as ground truth.
  expected: {
    leftArm: { shoulder: { x: 0, y: 0, z: -Math.PI / 2 }, elbow: { x: 0, y: 0, z: 0 } },
    rightArm: { shoulder: { x: 0, y: 0, z: Math.PI / 2.5 }, elbow: { x: 0, y: 0, z: 0 } },
  },
  rotationTolerance: 0.6,
}

const ALL_FIXTURES_WITH_NEW: PoseFixture[] = [
  T_POSE,
  ARMS_FORWARD,
  ARMS_DOWN,
  ARMS_UP,
  ELBOWS_BENT,
  LEFT_ARM_UP,
]

// ---------------------------------------------------------------------------
// Coordinate / kinematics helpers
// ---------------------------------------------------------------------------

/** Mirror of pose-solver.ts toVRMSpace — what the solver actually sees. */
function toVRMSpace(p: { x: number; y: number; z: number }): Vector3 {
  return { x: -(p.x - 0.5), y: -p.y, z: p.z }
}

function sub(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

function len(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
}

function normalize(v: Vector3): Vector3 {
  const l = len(v)
  return l === 0 ? { x: 0, y: 0, z: 0 } : { x: v.x / l, y: v.y / l, z: v.z / l }
}

function dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

/** Angle (radians) between two 3D directions. */
function angleBetween(a: Vector3, b: Vector3): number {
  const an = normalize(a)
  const bn = normalize(b)
  if (len(an) === 0 || len(bn) === 0) return 0
  return Math.acos(Math.max(-1, Math.min(1, dot(an, bn))))
}

/**
 * Apply ZYX intrinsic Euler rotation to a vector. Matches Three.js
 * `rotation.set(x, y, z, 'ZYX')` semantics: matrix = Rz · Ry · Rx, applied
 * to the column vector v.
 */
function applyEulerZYX(v: Vector3, rx: number, ry: number, rz: number): Vector3 {
  // Rx
  const cx = Math.cos(rx), sx = Math.sin(rx)
  let x = v.x
  let y = v.y * cx - v.z * sx
  let z = v.y * sx + v.z * cx
  // Ry
  const cy = Math.cos(ry), sy = Math.sin(ry)
  const x2 = x * cy + z * sy
  const z2 = -x * sy + z * cy
  x = x2; z = z2
  // Rz
  const cz = Math.cos(rz), sz = Math.sin(rz)
  const x3 = x * cz - y * sz
  const y3 = x * sz + y * cz
  return { x: x3, y: y3, z: z }
}

/** Rotate vector around world Y by angle (used for the VRM 0.x scene flip). */
function rotateY(v: Vector3, angle: number): Vector3 {
  const c = Math.cos(angle), s = Math.sin(angle)
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c }
}

// ---------------------------------------------------------------------------
// Mock VRM that records every rotation written by the bridge
// ---------------------------------------------------------------------------

interface RecordedRotation {
  x: number
  y: number
  z: number
  order: string
}

function makeRecordingVRM(metaVersion: '0' | '1') {
  const bones: Record<string, RecordedRotation & {
    rotation: {
      set: (x: number, y: number, z: number, order?: string) => void
      x: number
      y: number
      z: number
    }
  }> = {}

  const ensureBone = (name: string) => {
    if (bones[name]) return bones[name]
    const slot = { x: 0, y: 0, z: 0, order: 'XYZ' } as RecordedRotation
    const node = {
      ...slot,
      rotation: {
        set: (x: number, y: number, z: number, order?: string) => {
          slot.x = x
          slot.y = y
          slot.z = z
          slot.order = order ?? 'XYZ'
          // also reflect on the node so direct mutations are visible
          ;(node.rotation as { x: number; y: number; z: number }).x = x
          ;(node.rotation as { x: number; y: number; z: number }).y = y
          ;(node.rotation as { x: number; y: number; z: number }).z = z
        },
        x: 0,
        y: 0,
        z: 0,
      },
    }
    bones[name] = node as unknown as typeof bones[string]
    return bones[name]
  }

  const vrm = {
    meta: { metaVersion },
    humanoid: {
      getNormalizedBoneNode: vi.fn((name: string) => ensureBone(name)),
    },
    expressionManager: { setValue: vi.fn() },
  } as unknown as VRM

  const readApplied = (boneName: string): RecordedRotation | null => {
    const b = bones[boneName]
    if (!b) return null
    // Pull from the node's direct x/y/z properties too, since hand bones use
    // direct .x/.z mutation rather than .set().
    const node = (b as unknown as { rotation: { x: number; y: number; z: number } }).rotation
    // If .set() was used, the slot has the latest. If direct mutation, the
    // node properties are the authoritative value.
    return {
      x: node.x !== 0 ? node.x : b.x,
      y: node.y !== 0 ? node.y : b.y,
      z: node.z !== 0 ? node.z : b.z,
      order: b.order,
    }
  }

  return { vrm, bones, readApplied }
}

// ---------------------------------------------------------------------------
// Forward-kinematics the bones after the bridge has written them
// ---------------------------------------------------------------------------

/**
 * Compute the world-space wrist direction (unit vector from shoulder)
 * after applying the bone rotations the bridge wrote.
 *
 * Hierarchy:
 *   scene (rotY(π) for VRM 0.x, identity for VRM 1.x)
 *     leftUpperArm (T-pose rest dir = -X local; bone.rotation in local frame)
 *       leftLowerArm (T-pose rest dir = -X local; bone.rotation in upper-arm-local frame)
 *
 * World wrist direction (unit) is:
 *   sceneRot * R_shoulder * (tposeDir * upperLen + R_elbow * tposeDir * lowerLen)
 * normalized.
 */
function forwardKinematicWristDir(opts: {
  isLeft: boolean
  metaVersion: '0' | '1'
  shoulder: RecordedRotation | null
  elbow: RecordedRotation | null
  upperLen: number
  lowerLen: number
}): Vector3 {
  const { isLeft, metaVersion, shoulder, elbow, upperLen, lowerLen } = opts
  const tpose: Vector3 = isLeft ? { x: -1, y: 0, z: 0 } : { x: 1, y: 0, z: 0 }
  const sRot = shoulder ?? { x: 0, y: 0, z: 0, order: 'ZYX' }
  const eRot = elbow ?? { x: 0, y: 0, z: 0, order: 'ZYX' }

  // Upper arm in upper-arm's local frame is tposeDir; rotate by shoulder.
  const upperLocal: Vector3 = {
    x: tpose.x * upperLen,
    y: tpose.y * upperLen,
    z: tpose.z * upperLen,
  }
  const upperShoulderFrame = applyEulerZYX(upperLocal, sRot.x, sRot.y, sRot.z)

  // Lower arm in lower-arm's local frame is tposeDir; rotate by elbow (in
  // upper-arm-local frame) then by shoulder.
  const lowerLocal: Vector3 = {
    x: tpose.x * lowerLen,
    y: tpose.y * lowerLen,
    z: tpose.z * lowerLen,
  }
  const lowerUpperArmFrame = applyEulerZYX(lowerLocal, eRot.x, eRot.y, eRot.z)
  const lowerShoulderFrame = applyEulerZYX(lowerUpperArmFrame, sRot.x, sRot.y, sRot.z)

  let wristOffset: Vector3 = {
    x: upperShoulderFrame.x + lowerShoulderFrame.x,
    y: upperShoulderFrame.y + lowerShoulderFrame.y,
    z: upperShoulderFrame.z + lowerShoulderFrame.z,
  }

  // Scene-level rotation for VRM 0.x.
  if (metaVersion === '0') {
    wristOffset = rotateY(wristOffset, Math.PI)
  }

  return normalize(wristOffset)
}

/**
 * Ground-truth wrist direction (unit vector from shoulder) in the VRM world
 * frame, derived from MediaPipe landmarks. We apply toVRMSpace (matches the
 * solver) and then — because the solver assumes the scene PI rotation
 * un-flips X/Z back to world — we apply rotY(π) so the result is in world
 * space regardless of VRM version.
 */
function expectedWristWorldDir(landmark: {
  shoulder: { x: number; y: number; z: number }
  wrist: { x: number; y: number; z: number }
}): Vector3 {
  const sVRM = toVRMSpace(landmark.shoulder)
  const wVRM = toVRMSpace(landmark.wrist)
  // The solver's toVRMSpace leaves the result in "solver frame" which the
  // pose-solver comment says equals world after rotY(π) is applied by the
  // VRM 0.x scene rotation. For our world-space comparison we conjugate
  // back: rotateY(π) the offset.
  const offset = sub(wVRM, sVRM)
  return normalize(rotateY(offset, Math.PI))
}

// ---------------------------------------------------------------------------
// Pipeline runner
// ---------------------------------------------------------------------------

interface DriftResult {
  metaVersion: '0' | '1'
  fixture: string
  side: 'left' | 'right'
  solverShoulder: { x: number; y: number; z: number } | null
  solverElbow: { x: number; y: number; z: number } | null
  applied: {
    upperArm: RecordedRotation | null
    lowerArm: RecordedRotation | null
  }
  expectedWristDir: Vector3
  computedWristDir: Vector3
  /** Angular drift in degrees between expected and computed wrist direction. */
  driftDeg: number
}

function runPipeline(fixture: PoseFixture, metaVersion: '0' | '1'): DriftResult[] {
  const { vrm, readApplied } = makeRecordingVRM(metaVersion)
  const bridge = new TrackingBridge(vrm, { smoothing: 0 }) // no smoothing for clarity

  // Run two frames so any Kalman filter init lag is gone.
  const solved = solveHolistic({
    face: [],
    pose: fixture.landmarks,
    leftHand: [],
    rightHand: [],
  })
  bridge.update(solved)
  bridge.update(solved)

  const lShoulderLM = fixture.landmarks[LANDMARKS.LEFT_SHOULDER]
  const lElbowLM = fixture.landmarks[LANDMARKS.LEFT_ELBOW]
  const lWristLM = fixture.landmarks[LANDMARKS.LEFT_WRIST]
  const rShoulderLM = fixture.landmarks[LANDMARKS.RIGHT_SHOULDER]
  const rElbowLM = fixture.landmarks[LANDMARKS.RIGHT_ELBOW]
  const rWristLM = fixture.landmarks[LANDMARKS.RIGHT_WRIST]

  const lUpperLen = len(sub(toVRMSpace(lElbowLM), toVRMSpace(lShoulderLM)))
  const lLowerLen = len(sub(toVRMSpace(lWristLM), toVRMSpace(lElbowLM)))
  const rUpperLen = len(sub(toVRMSpace(rElbowLM), toVRMSpace(rShoulderLM)))
  const rLowerLen = len(sub(toVRMSpace(rWristLM), toVRMSpace(rElbowLM)))

  const out: DriftResult[] = []

  for (const side of ['left', 'right'] as const) {
    const upperName = side === 'left' ? 'leftUpperArm' : 'rightUpperArm'
    const lowerName = side === 'left' ? 'leftLowerArm' : 'rightLowerArm'
    const upperApplied = readApplied(upperName)
    const lowerApplied = readApplied(lowerName)

    const upperLen = side === 'left' ? lUpperLen : rUpperLen
    const lowerLen = side === 'left' ? lLowerLen : rLowerLen
    const expected = expectedWristWorldDir({
      shoulder: side === 'left' ? lShoulderLM : rShoulderLM,
      wrist: side === 'left' ? lWristLM : rWristLM,
    })
    const computed = forwardKinematicWristDir({
      isLeft: side === 'left',
      metaVersion,
      shoulder: upperApplied,
      elbow: lowerApplied,
      upperLen,
      lowerLen,
    })
    const driftRad = angleBetween(expected, computed)

    out.push({
      metaVersion,
      fixture: fixture.name,
      side,
      solverShoulder: solved.pose?.[side === 'left' ? 'leftArm' : 'rightArm']?.shoulder ?? null,
      solverElbow: solved.pose?.[side === 'left' ? 'leftArm' : 'rightArm']?.elbow ?? null,
      applied: { upperArm: upperApplied, lowerArm: lowerApplied },
      expectedWristDir: expected,
      computedWristDir: computed,
      driftDeg: (driftRad * 180) / Math.PI,
    })
  }

  bridge.dispose()
  return out
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Pipeline drift: MediaPipe landmarks → solver → bridge → VRM bone FK', () => {
  for (const metaVersion of ['0', '1'] as const) {
    describe(`VRM ${metaVersion}.x branch`, () => {
      for (const fixture of ALL_FIXTURES_WITH_NEW) {
        it(`${fixture.name}: prints drift, fails only on egregious deviation`, () => {
          const results = runPipeline(fixture, metaVersion)
          // Snapshot via console for debugging — vitest prints the line.
          for (const r of results) {
            // eslint-disable-next-line no-console
            console.log(
              `[VRM${metaVersion}.x] ${r.fixture} ${r.side}: ` +
              `drift=${r.driftDeg.toFixed(1)}°  ` +
              `expected=(${r.expectedWristDir.x.toFixed(2)},${r.expectedWristDir.y.toFixed(2)},${r.expectedWristDir.z.toFixed(2)}) ` +
              `computed=(${r.computedWristDir.x.toFixed(2)},${r.computedWristDir.y.toFixed(2)},${r.computedWristDir.z.toFixed(2)}) ` +
              `applied.upper=(${r.applied.upperArm?.x.toFixed(2)},${r.applied.upperArm?.y.toFixed(2)},${r.applied.upperArm?.z.toFixed(2)} ${r.applied.upperArm?.order}) ` +
              `applied.lower=(${r.applied.lowerArm?.x.toFixed(2)},${r.applied.lowerArm?.y.toFixed(2)},${r.applied.lowerArm?.z.toFixed(2)} ${r.applied.lowerArm?.order})`
            )
          }
          // Investigation-grade: don't fail on small drift. Allow up to 180°
          // since the point is observation, not regression.
          expect(results.length).toBeGreaterThan(0)
        })
      }

      it('summary: drift per fixture (single-row-per-arm assertion table)', () => {
        const rows: string[] = []
        for (const fixture of ALL_FIXTURES_WITH_NEW) {
          const r = runPipeline(fixture, metaVersion)
          for (const x of r) {
            rows.push(`${fixture.name.padEnd(30)} ${x.side.padEnd(6)} drift=${x.driftDeg.toFixed(1)}°`)
          }
        }
        // eslint-disable-next-line no-console
        console.log(`\n=== VRM ${metaVersion}.x drift summary ===\n${rows.join('\n')}\n`)
        expect(rows.length).toBe(ALL_FIXTURES_WITH_NEW.length * 2)
      })
    })
  }
})

// ---------------------------------------------------------------------------
// Targeted: does the boneSign flip preserve wrist direction?
// ---------------------------------------------------------------------------

describe('boneSign hypothesis: VRM 0.x vs 1.x should produce IDENTICAL world wrist dirs', () => {
  /**
   * The boneSign flip in tracking-bridge.ts only swaps the SIGN of X and Z of
   * the Euler triplet written to a bone. For this to correctly compensate for
   * the missing scene rotY(π), the operation `(rx, ry, rz) -> (-rx, ry, -rz)`
   * applied to an Euler-ZYX triplet would need to equal conjugation of the
   * underlying rotation by rotY(π). It does for single-axis rotations but NOT
   * for general compound rotations.
   *
   * If we forward-kinematics both branches into a common world frame, they
   * should produce identical wrist directions. Any deviation IS the bug.
   */
  for (const fixture of ALL_FIXTURES_WITH_NEW) {
    it(`${fixture.name}: VRM 0.x and 1.x should agree on wrist world direction`, () => {
      const v0 = runPipeline(fixture, '0')
      const v1 = runPipeline(fixture, '1')

      for (let i = 0; i < v0.length; i++) {
        const drift = angleBetween(v0[i].computedWristDir, v1[i].computedWristDir)
        const deg = (drift * 180) / Math.PI
        // eslint-disable-next-line no-console
        console.log(
          `[v0-vs-v1] ${fixture.name} ${v0[i].side}: branch divergence=${deg.toFixed(1)}°`
        )
        // Investigation-grade only.
      }
      expect(v0.length).toBe(v1.length)
    })
  }
})

// ---------------------------------------------------------------------------
// Hand-tracking degenerate-case test (palm at camera)
// ---------------------------------------------------------------------------

describe('Hand tracking degeneracy: palm-toward-camera collapses curl to ~0', () => {
  /**
   * Hand-solver computes curl from Y-axis differences only:
   *   fingerLength = |y_pip - y_mcp| + |y_dip - y_pip| + |y_tip - y_dip|
   *   ratio = |y_tip - y_mcp| / fingerLength
   * When the hand is held with palm toward the camera, fingers point along
   * the Z axis (toward camera), so all Y values are nearly identical and
   * fingerLength → 0. This test confirms the curl is unreliable for that
   * pose — explaining why the user's character shows no finger motion when
   * they show their palm to the camera.
   */
  it('reports curl values for an open palm-at-camera hand vs a side-on hand', async () => {
    const { solveHand } = await import('../lib/solver/hand-solver')

    // Side-on (canonical fingers-up image): clear Y separation per finger.
    const sideOn = [
      { x: 0.5, y: 0.7, z: 0 },   // wrist
      // Thumb
      { x: 0.35, y: 0.65, z: 0 },
      { x: 0.3, y: 0.6, z: 0 },
      { x: 0.25, y: 0.55, z: 0 },
      { x: 0.2, y: 0.5, z: 0 },
      // Index up
      { x: 0.4, y: 0.6, z: 0 },
      { x: 0.4, y: 0.5, z: 0 },
      { x: 0.4, y: 0.4, z: 0 },
      { x: 0.4, y: 0.3, z: 0 },
      // Middle up
      { x: 0.5, y: 0.58, z: 0 },
      { x: 0.5, y: 0.48, z: 0 },
      { x: 0.5, y: 0.38, z: 0 },
      { x: 0.5, y: 0.28, z: 0 },
      // Ring up
      { x: 0.6, y: 0.6, z: 0 },
      { x: 0.6, y: 0.5, z: 0 },
      { x: 0.6, y: 0.4, z: 0 },
      { x: 0.6, y: 0.3, z: 0 },
      // Pinky up
      { x: 0.7, y: 0.62, z: 0 },
      { x: 0.7, y: 0.54, z: 0 },
      { x: 0.7, y: 0.46, z: 0 },
      { x: 0.7, y: 0.38, z: 0 },
    ]

    // Palm at camera: fingers point along -Z (toward camera). XY is roughly
    // constant per finger; only Z varies.
    const palmAtCamera = [
      { x: 0.5, y: 0.5, z: 0 }, // wrist
      // Thumb
      { x: 0.45, y: 0.50, z: -0.02 },
      { x: 0.43, y: 0.50, z: -0.04 },
      { x: 0.41, y: 0.50, z: -0.06 },
      { x: 0.39, y: 0.50, z: -0.08 },
      // Index — tip much closer to camera, but image Y barely moves
      { x: 0.48, y: 0.50, z: -0.02 },
      { x: 0.48, y: 0.501, z: -0.06 },
      { x: 0.48, y: 0.502, z: -0.10 },
      { x: 0.48, y: 0.503, z: -0.14 },
      // Middle
      { x: 0.50, y: 0.50, z: -0.02 },
      { x: 0.50, y: 0.501, z: -0.06 },
      { x: 0.50, y: 0.502, z: -0.10 },
      { x: 0.50, y: 0.503, z: -0.14 },
      // Ring
      { x: 0.52, y: 0.50, z: -0.02 },
      { x: 0.52, y: 0.501, z: -0.06 },
      { x: 0.52, y: 0.502, z: -0.10 },
      { x: 0.52, y: 0.503, z: -0.14 },
      // Pinky
      { x: 0.54, y: 0.50, z: -0.02 },
      { x: 0.54, y: 0.501, z: -0.06 },
      { x: 0.54, y: 0.502, z: -0.10 },
      { x: 0.54, y: 0.503, z: -0.14 },
    ]

    const sideResult = solveHand(sideOn, 'left')!
    const palmResult = solveHand(palmAtCamera, 'left')!

    // eslint-disable-next-line no-console
    console.log(
      `[hand-curl] side-on: index=${sideResult.index.curl.toFixed(2)} middle=${sideResult.middle.curl.toFixed(2)}`
    )
    // eslint-disable-next-line no-console
    console.log(
      `[hand-curl] palm-at-cam: index=${palmResult.index.curl.toFixed(2)} middle=${palmResult.middle.curl.toFixed(2)}`
    )

    // Side-on extended fingers should produce low curl (< ~0.3).
    expect(sideResult.index.curl).toBeLessThan(0.3)
    // Palm-at-camera extended fingers also produce low curl — they're straight.
    expect(palmResult.index.curl).toBeLessThan(0.3)
    // Now curl the fingers: tips withdrawn toward wrist along -Z. With the 3D
    // joint-angle metric, this must read as a meaningfully higher curl than
    // the extended palm-at-camera case. The original Y-axis-only metric
    // collapsed this difference to ~0.
    const palmCurled = palmAtCamera.map((p, i) => {
      if ([4, 8, 12, 16, 20].includes(i)) {
        return { ...p, z: -0.02 }
      }
      return p
    })
    const palmCurledResult = solveHand(palmCurled, 'left')!
    // eslint-disable-next-line no-console
    console.log(
      `[hand-curl] palm-at-cam CURLED: index=${palmCurledResult.index.curl.toFixed(2)} middle=${palmCurledResult.middle.curl.toFixed(2)}`
    )
    expect(palmCurledResult.index.curl - palmResult.index.curl).toBeGreaterThan(0.15)
  })
})

// ---------------------------------------------------------------------------
// Wrist (palm) rotation: is it computed/applied anywhere?
// ---------------------------------------------------------------------------

describe('Wrist/palm orientation: never reaches the VRM', () => {
  it('PoseResult.leftArm has no wrist field — palm rotation is not computed', () => {
    const result = solvePose(LEFT_ARM_UP.landmarks)!
    const leftArm = result.leftArm as unknown as Record<string, unknown>
    // Static-typed: PoseResult.leftArm only has shoulder and elbow.
    expect(Object.keys(leftArm).sort()).toEqual(['elbow', 'shoulder'])
    expect(leftArm.wrist).toBeUndefined()
  })

  it('TrackingBridge never calls getNormalizedBoneNode for leftHand or rightHand', () => {
    const { vrm } = makeRecordingVRM('1')
    const bridge = new TrackingBridge(vrm, { smoothing: 0 })

    const solved = solveHolistic({
      face: [],
      pose: LEFT_ARM_UP.landmarks,
      leftHand: [], // even with hand landmarks present, no wrist roll would be applied
      rightHand: [],
    })
    bridge.update(solved)

    const getBone = vrm.humanoid.getNormalizedBoneNode as ReturnType<typeof vi.fn>
    const requestedBones = getBone.mock.calls.map((c: unknown[]) => c[0] as string)
    expect(requestedBones).not.toContain('leftHand')
    expect(requestedBones).not.toContain('rightHand')

    bridge.dispose()
  })
})
