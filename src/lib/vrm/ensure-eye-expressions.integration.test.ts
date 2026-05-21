/**
 * Integration check against the real `.local/test2.vrm` file.
 *
 * GLTFLoader cannot complete in jsdom (it hangs decoding embedded textures),
 * so instead of running the full loader we parse the GLB JSON chunk ourselves
 * to obtain the authentic mesh morph-target names. We then synthesize a
 * minimal VRM-shaped object and run the helper against it.
 *
 * This pinpoints the mapping between the test2.vrm's authoring names
 * (まばたき / ウィンク / ウィンク右) and the VRM 1.x preset expressions
 * (blink / blinkLeft / blinkRight) the rest of the app expects.
 *
 * Skips automatically if the local VRM is not present.
 */

import { describe, it, expect, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as THREE from 'three'
import { VRMExpression, VRMExpressionMorphTargetBind } from '@pixiv/three-vrm'
import type { VRM } from '@pixiv/three-vrm'
import { ensureEyelidExpressions } from './ensure-eye-expressions'

const TEST_VRM = path.resolve(process.cwd(), '.local/test2.vrm')
const hasFile = fs.existsSync(TEST_VRM)

interface GlbJson {
  meshes?: Array<{ name?: string; extras?: { targetNames?: string[] } }>
  extensions?: {
    VRMC_vrm?: { expressions?: { preset?: Record<string, unknown> } }
  }
}

function readGlbJson(filePath: string): GlbJson {
  const buf = fs.readFileSync(filePath)
  const jsonLen = buf.readUInt32LE(12)
  return JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'))
}

describe.skipIf(!hasFile)('ensureEyelidExpressions vs real test2.vrm', () => {
  it('discovers Japanese eyelid morphs and registers all three blink presets', () => {
    const glb = readGlbJson(TEST_VRM)

    // Sanity: confirm this VRM still lacks blink presets (the precondition for our fix)
    const preset = glb.extensions?.VRMC_vrm?.expressions?.preset ?? {}
    expect(preset.blink).toBeUndefined()
    expect(preset.blinkLeft).toBeUndefined()
    expect(preset.blinkRight).toBeUndefined()

    // Build mock meshes mirroring the real GLB target names
    const meshes = (glb.meshes ?? [])
      .filter((m) => m.extras?.targetNames?.length)
      .map((m) => {
        const targets = m.extras!.targetNames!
        const mesh = new THREE.Mesh()
        mesh.morphTargetDictionary = Object.fromEntries(targets.map((n, i) => [n, i]))
        mesh.morphTargetInfluences = targets.map(() => 0)
        return mesh
      })

    const scene = new THREE.Group()
    meshes.forEach((m) => scene.add(m))

    const expressionMap: Record<string, VRMExpression> = {}
    const expressionManager = {
      getExpression: vi.fn((name: string) => expressionMap[name] ?? null),
      registerExpression: vi.fn((exp: VRMExpression) => {
        expressionMap[exp.expressionName] = exp
      }),
    }
    const vrm = { scene, expressionManager } as unknown as VRM

    ensureEyelidExpressions(vrm)

    // All three should now exist
    expect(expressionMap.blinkLeft).toBeDefined()
    expect(expressionMap.blinkRight).toBeDefined()
    expect(expressionMap.blink).toBeDefined()

    // Each one should bind to the right Japanese morph
    const blinkLeftBind = expressionMap.blinkLeft.binds[0] as VRMExpressionMorphTargetBind
    const blinkRightBind = expressionMap.blinkRight.binds[0] as VRMExpressionMorphTargetBind
    const blinkBind = expressionMap.blink.binds[0] as VRMExpressionMorphTargetBind

    const dictForBind = (b: VRMExpressionMorphTargetBind) => {
      const dict = b.primitives[0].morphTargetDictionary!
      return Object.entries(dict).find(([, idx]) => idx === b.index)?.[0]
    }
    expect(dictForBind(blinkLeftBind)).toBe('ウィンク')
    expect(dictForBind(blinkRightBind)).toBe('ウィンク右')
    expect(dictForBind(blinkBind)).toBe('まばたき')

    // Direct-bind path uses full weight (not the half-weight fallback)
    expect(blinkLeftBind.weight).toBe(1.0)
    expect(blinkRightBind.weight).toBe(1.0)
  })
})
