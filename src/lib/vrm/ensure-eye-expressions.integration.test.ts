/**
 * Runs ensureEyelidExpressions against the morph names in `.local/test2.vrm`.
 * GLTFLoader did not finish in jsdom: it hung while it decoded the embedded
 * textures. The test therefore reads the morph names from the GLB JSON chunk
 * and builds a minimal VRM-shaped object.
 *
 * The suite skips when the file is absent.
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

    // The helper matters only for a VRM without blink presets.
    const preset = glb.extensions?.VRMC_vrm?.expressions?.preset ?? {}
    expect(preset.blink).toBeUndefined()
    expect(preset.blinkLeft).toBeUndefined()
    expect(preset.blinkRight).toBeUndefined()

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

    expect(expressionMap.blinkLeft).toBeDefined()
    expect(expressionMap.blinkRight).toBeDefined()
    expect(expressionMap.blink).toBeDefined()

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

    // Direct binds use weight 1. The both-eyes fallback uses 0.5.
    expect(blinkLeftBind.weight).toBe(1.0)
    expect(blinkRightBind.weight).toBe(1.0)
  })
})
