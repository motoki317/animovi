/**
 * Some VRM 1.x models, MMD conversions in particular, have eyelid morph targets
 * but do not bind them to the blink presets. `expressionManager.setValue('blinkLeft', ...)`
 * then does nothing. This module finds the eyelid morphs by common authoring
 * names and registers the missing expressions.
 */

import * as THREE from 'three'
import type { VRM } from '@pixiv/three-vrm'
import { VRMExpression, VRMExpressionMorphTargetBind } from '@pixiv/three-vrm'

// Eyelid morph names in common use. Latin names match in any letter case.
// Within a list, the first match wins.
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
        // Authors mix letter case, for example Blink_L and blink_l.
        for (const key of Object.keys(dict)) {
          if (key.toLowerCase() === needle) {
            hits.push({ mesh, index: dict[key] })
            break
          }
        }
      } else {
        // Japanese names have no letter case, so a direct lookup finds them.
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
 * Adds each missing blink, blinkLeft, and blinkRight expression to `vrm.scene`
 * and to the expression manager. Does nothing when no eyelid morph matches.
 */
export function ensureEyelidExpressions(vrm: VRM): void {
  if (!vrm.expressionManager) return
  const manager = vrm.expressionManager
  const meshes = collectMorphMeshes(vrm)
  if (meshes.length === 0) return

  // Pass 1: bind each missing preset to its own morph.
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

  // Pass 2: bind a still-missing side to the both-eyes morph at weight 0.5.
  // three-vrm adds the weights of active expressions, so blinkLeft = blinkRight = 1
  // closes both eyes. At weight 1, blinkLeft alone would close both eyes.
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
