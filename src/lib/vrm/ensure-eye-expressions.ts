/**
 * A model can have eyelid morph targets without blink presets, so preset
 * expression calls do nothing. Morph names vary between models, so geometry
 * determines which eyelid each candidate moves.
 */

import * as THREE from 'three'
import type { VRM } from '@pixiv/three-vrm'
import { VRMExpression, VRMExpressionMorphTargetBind } from '@pixiv/three-vrm'

// Each list's side is only a fallback when geometry cannot decide.
// ASCII names match in any letter case. The first name in list order that
// any mesh has supplies the candidates.
const LEFT_BLINK_NAMES = [
  'Blink_L',
  'BlinkLeft',
  'Wink_L',
  'ウィンク',
  'EyeCloseL',
  'Eye_L_Close',
]
const RIGHT_BLINK_NAMES = [
  'Blink_R',
  'BlinkRight',
  'Wink_R',
  'ウィンク右',
  'EyeCloseR',
  'Eye_R_Close',
]
const BOTH_BLINK_NAMES = [
  'Blink',
  'Eyes_Closed',
  'まばたき',
  '瞬き',
  '目閉じ',
]

interface MorphHit {
  mesh: THREE.Mesh
  index: number
}

type EyelidSide = 'blinkLeft' | 'blinkRight'

/**
 * `null` preserves the name fallback when data is missing, or the centroid is
 * on the midline or nonfinite. `'unmoved'` means every delta is zero, so other
 * hits with the same morph name can supply the side.
 */
function eyelidSide(
  { mesh, index }: MorphHit,
  midpoint: THREE.Vector3,
  leftAxis: THREE.Vector3,
): EyelidSide | 'unmoved' | null {
  const centroid = new THREE.Vector3()
  const position = new THREE.Vector3()
  const delta = new THREE.Vector3()
  let totalWeight = 0
  const positions = mesh.geometry.attributes.position
  const morph = mesh.geometry.morphAttributes.position?.[index]
  if (!positions || !morph || positions.count !== morph.count) return null
  for (let i = 0; i < positions.count; i++) {
    position.fromBufferAttribute(positions, i)
    delta.fromBufferAttribute(morph, i)
    if (!mesh.geometry.morphTargetsRelative) delta.sub(position)
    const weight = delta.length()
    if (weight === 0) continue
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
      (mesh as THREE.SkinnedMesh).applyBoneTransform(i, position)
    }
    position.applyMatrix4(mesh.matrixWorld)
    centroid.addScaledVector(position, weight)
    totalWeight += weight
  }
  if (totalWeight === 0) return 'unmoved'
  const projection = centroid.divideScalar(totalWeight).sub(midpoint).dot(leftAxis)
  // A centroid on the midline cannot identify one eyelid. The distance between
  // the upper-arm bones scales the tolerance, so scene scale does not change
  // the classification.
  if (!Number.isFinite(projection) || Math.abs(projection) <= leftAxis.lengthSq() * 1e-4) return null
  return projection > 0 ? 'blinkLeft' : 'blinkRight'
}

function findSideMorphs(vrm: VRM, meshes: THREE.Mesh[]): Record<EyelidSide, MorphHit[]> {
  const hits: Record<EyelidSide, MorphHit[]> = { blinkLeft: [], blinkRight: [] }
  const left = vrm.humanoid?.getRawBoneNode('leftUpperArm')
  const right = vrm.humanoid?.getRawBoneNode('rightUpperArm')
  vrm.scene.updateMatrixWorld(true)
  const leftPosition = left?.getWorldPosition(new THREE.Vector3())
  const rightPosition = right?.getWorldPosition(new THREE.Vector3())
  const leftAxis = leftPosition && rightPosition ? leftPosition.clone().sub(rightPosition) : null
  const midpoint = leftPosition && rightPosition ? leftPosition.clone().add(rightPosition).multiplyScalar(0.5) : null

  for (const [fallback, names] of [
    ['blinkLeft', LEFT_BLINK_NAMES],
    ['blinkRight', RIGHT_BLINK_NAMES],
  ] as const) {
    const candidates = findMorphHits(meshes, names)
    const classified = candidates.map((hit) => ({
      hit,
      side: leftAxis && midpoint ? eyelidSide(hit, midpoint, leftAxis) : null,
    }))
    // Unmoved hits lack side information, so they take the side of other hits
    // with the same morph name when those agree. Otherwise, they use the
    // list's side.
    const knownSides = new Set(classified.map(({ side }) => side).filter(
      (side) => side === 'blinkLeft' || side === 'blinkRight',
    ))
    const sharedSide = knownSides.size === 1 ? [...knownSides][0] : null
    for (const { hit, side } of classified) {
      const resolved = side === 'unmoved' ? sharedSide : side
      hits[resolved ?? fallback].push(hit)
    }
  }
  return hits
}

function isAscii(s: string): boolean {
  return /^\p{ASCII}*$/u.test(s)
}

function findMorphHits(meshes: THREE.Mesh[], names: readonly string[]): MorphHit[] {
  for (const name of names) {
    const ascii = isAscii(name)
    const needle = ascii ? name.toLowerCase() : name
    const hits: MorphHit[] = []
    for (const mesh of meshes) {
      const dict = mesh.morphTargetDictionary
      if (!dict) continue
      if (ascii) {
        for (const key of Object.keys(dict)) {
          if (key.toLowerCase() === needle) {
            hits.push({ mesh, index: dict[key] })
            break
          }
        }
      } else {
        if (dict[needle] !== undefined) {
          hits.push({ mesh, index: dict[needle] })
        }
      }
    }
    if (hits.length > 0) return hits
  }
  return []
}

function collectMorphMeshes(vrm: VRM): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = []
  vrm.scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (mesh.isMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
      meshes.push(mesh)
    }
  })
  return meshes
}

function registerExpressionFromHits(
  vrm: VRM,
  name: string,
  hits: readonly MorphHit[],
  weight: number,
): void {
  const expression = new VRMExpression(name)
  vrm.scene.add(expression)
  for (const hit of hits) {
    expression.addBind(
      new VRMExpressionMorphTargetBind({
        primitives: [hit.mesh],
        index: hit.index,
        weight,
      }),
    )
  }
  vrm.expressionManager?.registerExpression(expression)
}

/**
 * Call at rest pose so the raw upper-arm bones locate the eyelids' sides.
 * Existing blink presets retain their authored bindings.
 */
export function ensureEyelidExpressions(vrm: VRM): void {
  if (!vrm.expressionManager) return
  const manager = vrm.expressionManager
  const meshes = collectMorphMeshes(vrm)
  if (meshes.length === 0) return

  if (!manager.getExpression('blinkLeft') || !manager.getExpression('blinkRight')) {
    const sideHits = findSideMorphs(vrm, meshes)
    for (const side of ['blinkLeft', 'blinkRight'] as const) {
      if (!manager.getExpression(side) && sideHits[side].length > 0) {
        registerExpressionFromHits(vrm, side, sideHits[side], 1.0)
      }
    }
  }
  if (!manager.getExpression('blink')) {
    const hits = findMorphHits(meshes, BOTH_BLINK_NAMES)
    if (hits.length > 0) registerExpressionFromHits(vrm, 'blink', hits, 1.0)
  }

  // Missing sides share the both-eyes morph at weight 0.5 so two fully active
  // fallback expressions give the morph a total weight of 1.
  // If only one side is missing, a wink on that side half-closes both eyes.
  const blinkExp = manager.getExpression('blink')
  if (blinkExp) {
    for (const side of ['blinkLeft', 'blinkRight'] as const) {
      if (manager.getExpression(side)) continue
      const exp = new VRMExpression(side)
      vrm.scene.add(exp)
      for (const bind of blinkExp.binds) {
        if (!(bind instanceof VRMExpressionMorphTargetBind)) continue
        exp.addBind(
          new VRMExpressionMorphTargetBind({
            primitives: [...bind.primitives],
            index: bind.index,
            weight: 0.5,
          }),
        )
      }
      manager.registerExpression(exp)
    }
  }
}
