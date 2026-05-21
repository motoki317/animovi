/**
 * Register blink expressions when a VRM's expressionManager lacks them.
 *
 * Some VRM 1.x authors (especially MMD-imported models) ship blendshape
 * morph targets but never bind them to the standard preset expressions.
 * As a result, calling `expressionManager.setValue('blinkLeft', ...)` no-ops
 * even though the underlying eyelid morph is present on the mesh.
 *
 * This helper discovers eyelid morph targets by their common authoring
 * names and registers the missing expressions so the rest of the pipeline
 * (TrackingBridge, etc.) works unchanged.
 */

import * as THREE from 'three'
import type { VRM } from '@pixiv/three-vrm'
import { VRMExpression, VRMExpressionMorphTargetBind } from '@pixiv/three-vrm'

// Authoring names commonly used for eyelid morphs.
// Order within each list = priority; the first hit wins.
const LEFT_BLINK_NAMES = [
  'Blink_L',
  'blink_l',
  'BlinkLeft',
  'Wink_L',
  'wink_l',
  'ウィンク',
  'EyeCloseL',
  'Eye_L_Close',
]
const RIGHT_BLINK_NAMES = [
  'Blink_R',
  'blink_r',
  'BlinkRight',
  'Wink_R',
  'wink_r',
  'ウィンク右',
  'EyeCloseR',
  'Eye_R_Close',
]
const BOTH_BLINK_NAMES = [
  'Blink',
  'blink',
  'Eyes_Closed',
  'まばたき',
  '瞬き',
  '目閉じ',
]

interface MorphHit {
  mesh: THREE.Mesh
  index: number
}

function isAscii(s: string): boolean {
  // ESLint complains about control chars in regex; check by char code.
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 127) return false
  }
  return true
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
        // Case-insensitive match for Latin names (authors are inconsistent: Blink_L vs blink_l)
        for (const key of Object.keys(dict)) {
          if (key.toLowerCase() === needle) {
            hits.push({ mesh, index: dict[key] })
            break
          }
        }
      } else {
        // Exact match for non-ASCII (Japanese is canonical in MMD authoring)
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
 * Register blink/blinkLeft/blinkRight expressions if they are missing.
 * No-op when the manager already has them or when no eyelid morphs are found.
 */
export function ensureEyelidExpressions(vrm: VRM): void {
  if (!vrm.expressionManager) return
  const manager = vrm.expressionManager
  const meshes = collectMorphMeshes(vrm)
  if (meshes.length === 0) return

  // Pass 1: bind each missing preset to its own dedicated morph if available.
  if (!manager.getExpression('blinkLeft')) {
    const hits = findMorphHits(meshes, LEFT_BLINK_NAMES)
    if (hits.length > 0) registerExpressionFromHits(vrm, 'blinkLeft', hits, 1.0)
  }
  if (!manager.getExpression('blinkRight')) {
    const hits = findMorphHits(meshes, RIGHT_BLINK_NAMES)
    if (hits.length > 0) registerExpressionFromHits(vrm, 'blinkRight', hits, 1.0)
  }
  if (!manager.getExpression('blink')) {
    const hits = findMorphHits(meshes, BOTH_BLINK_NAMES)
    if (hits.length > 0) registerExpressionFromHits(vrm, 'blink', hits, 1.0)
  }

  // Pass 2: if L/R still missing but a "both eyes" morph exists, fall back to it
  // with halved bind weight so independent L/R tracking signals each produce a
  // half-blink (and a true both-eye blink reaches weight 1).
  // Why halved: three-vrm sums bind weights across active expressions; without
  // this scale, blinkLeft=1 alone would already fully close both eyes.
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
