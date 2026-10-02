/**
 * Textures can hang GLTFLoader in jsdom, so this test substitutes untextured
 * materials. Geometry, sparse morph accessors, and skin bind matrices stay intact.
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { VRMExpressionManager, VRMExpressionMorphTargetBind } from '@pixiv/three-vrm'
import type { VRM } from '@pixiv/three-vrm'
import { ensureEyelidExpressions } from './ensure-eye-expressions'

const TEST_VRM = path.resolve(process.cwd(), '.local/test2.vrm')
const hasFile = fs.existsSync(TEST_VRM)

describe.skipIf(!hasFile)('ensureEyelidExpressions vs real test2.vrm', () => {
  it('binds blinkLeft to ウィンク右 from real skinned eyelid geometry', async () => {
    const loader = new GLTFLoader()
    loader.register(() => ({
      name: 'TestUntexturedMaterials',
      loadMaterial: async () => new THREE.MeshBasicMaterial(),
    }))
    const buffer = fs.readFileSync(TEST_VRM)
    const gltf = await loader.parseAsync(new Uint8Array(buffer).buffer, '')
    const extension = gltf.parser.json.extensions.VRMC_vrm
    const preset = extension.expressions?.preset ?? {}
    expect(preset.blink).toBeUndefined()
    expect(preset.blinkLeft).toBeUndefined()
    expect(preset.blinkRight).toBeUndefined()

    const bones: Record<string, THREE.Object3D> = {}
    for (const name of ['leftUpperArm', 'rightUpperArm', 'leftEye', 'rightEye']) {
      bones[name] = await gltf.parser.getDependency('node', extension.humanoid.humanBones[name].node)
    }
    gltf.scene.updateMatrixWorld(true)
    expect(bones.leftEye.getWorldPosition(new THREE.Vector3()).x).toBeGreaterThan(0)
    expect(bones.rightEye.getWorldPosition(new THREE.Vector3()).x).toBeLessThan(0)
    const expressionManager = new VRMExpressionManager()
    const vrm = {
      scene: gltf.scene,
      expressionManager,
      humanoid: { getRawBoneNode: (name: string) => bones[name] },
    } as unknown as VRM

    ensureEyelidExpressions(vrm)

    const left = expressionManager.getExpression('blinkLeft')!.binds[0] as VRMExpressionMorphTargetBind
    const right = expressionManager.getExpression('blinkRight')!.binds[0] as VRMExpressionMorphTargetBind
    const blink = expressionManager.getExpression('blink')!.binds[0] as VRMExpressionMorphTargetBind
    const morphName = (bind: VRMExpressionMorphTargetBind) => Object.entries(
      bind.primitives[0].morphTargetDictionary!,
    ).find(([, index]) => index === bind.index)?.[0]
    expect(morphName(left)).toBe('ウィンク右')
    expect(morphName(right)).toBe('ウィンク')
    expect(morphName(blink)).toBe('まばたき')
    expect(left.weight).toBe(1)
    expect(right.weight).toBe(1)
    expect(left.primitives[0]).toBeInstanceOf(THREE.SkinnedMesh)
    expect(left.primitives[0].geometry.attributes.position.count).toBeGreaterThan(0)
  })
})
