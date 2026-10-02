import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import { VRMExpression, VRMExpressionMorphTargetBind } from '@pixiv/three-vrm'
import type { VRM } from '@pixiv/three-vrm'
import { ensureEyelidExpressions } from './ensure-eye-expressions'

function makeMesh(targetNames: string[]): THREE.Mesh {
  const mesh = new THREE.Mesh()
  mesh.morphTargetDictionary = Object.fromEntries(
    targetNames.map((name, i) => [name, i]),
  )
  mesh.morphTargetInfluences = targetNames.map(() => 0)
  return mesh
}

function makeVRM(meshes: THREE.Mesh[], existing: Record<string, VRMExpression> = {}): VRM {
  const scene = new THREE.Group()
  meshes.forEach((m) => scene.add(m))

  const expressionMap: Record<string, VRMExpression> = { ...existing }
  const expressionManager = {
    getExpression: vi.fn((name: string) => expressionMap[name] ?? null),
    registerExpression: vi.fn((exp: VRMExpression) => {
      expressionMap[exp.expressionName] = exp
    }),
  }

  return {
    scene,
    expressionManager,
  } as unknown as VRM
}

function addShoulders(vrm: VRM): void {
  const left = new THREE.Bone()
  const right = new THREE.Bone()
  left.position.x = 0.2
  right.position.x = -0.2
  vrm.scene.add(left, right)
  Object.assign(vrm, { humanoid: {
    getRawBoneNode: (name: string) => name === 'leftUpperArm' ? left : right,
  } })
}

describe('ensureEyelidExpressions', () => {
  it('classifies separate eyelid meshes with the same morph name independently', () => {
    const meshes = [-0.05, 0.05].map((x) => {
      const mesh = makeMesh(['ウィンク'])
      mesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute([x, 1, 0], 3))
      mesh.geometry.morphTargetsRelative = true
      mesh.geometry.morphAttributes.position = [new THREE.Float32BufferAttribute([0, -0.02, 0], 3)]
      return mesh
    })
    const vrm = makeVRM(meshes)
    addShoulders(vrm)

    ensureEyelidExpressions(vrm)

    const left = vrm.expressionManager!.getExpression('blinkLeft')!.binds as VRMExpressionMorphTargetBind[]
    const right = vrm.expressionManager!.getExpression('blinkRight')!.binds as VRMExpressionMorphTargetBind[]
    expect(left.flatMap((bind) => bind.primitives)).toEqual([meshes[1]])
    expect(right.flatMap((bind) => bind.primitives)).toEqual([meshes[0]])
  })

  it('keeps name fallback for a moving midline morph beside a decidable eyelid', () => {
    const meshes = [-0.05, 0].map((x) => {
      const mesh = makeMesh(['ウィンク'])
      mesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute([x, 1, 0], 3))
      mesh.geometry.morphTargetsRelative = true
      mesh.geometry.morphAttributes.position = [new THREE.Float32BufferAttribute([0, -0.02, 0], 3)]
      return mesh
    })
    const vrm = makeVRM(meshes)
    addShoulders(vrm)

    ensureEyelidExpressions(vrm)

    const left = vrm.expressionManager!.getExpression('blinkLeft')!.binds[0] as VRMExpressionMorphTargetBind
    const right = vrm.expressionManager!.getExpression('blinkRight')!.binds[0] as VRMExpressionMorphTargetBind
    expect(left.primitives).toEqual([meshes[1]])
    expect(right.primitives).toEqual([meshes[0]])
  })

  it.each([false, true])('binds ウィンク to the right eyelid from geometry (skinned: %s)', (skinned) => {
    const geometry = new THREE.BufferGeometry()
    // A small delta on the left must not outweigh the right eyelid's motion.
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-0.05, 1, 0, 0.05, 1, 0], 3))
    geometry.morphTargetsRelative = true
    geometry.morphAttributes.position = [
      new THREE.Float32BufferAttribute([0, -0.02, 0, 0, -0.001, 0], 3),
      new THREE.Float32BufferAttribute([0, 0, 0, 0, -0.02, 0], 3),
    ]
    const mesh = skinned ? new THREE.SkinnedMesh(geometry) : new THREE.Mesh(geometry)
    mesh.morphTargetDictionary = { ウィンク: 0, ウィンク右: 1 }
    // glTF primitives can share morph names even when one primitive never moves.
    const unused = makeMesh(['ウィンク', 'ウィンク右'])
    unused.geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3))
    unused.geometry.morphTargetsRelative = true
    unused.geometry.morphAttributes.position = [
      new THREE.Float32BufferAttribute([0, 0, 0], 3),
      new THREE.Float32BufferAttribute([0, 0, 0], 3),
    ]
    const vrm = makeVRM([unused, mesh])
    addShoulders(vrm)
    if (mesh instanceof THREE.SkinnedMesh) {
      geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0], 4))
      geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0], 4))
      const bone = new THREE.Bone()
      vrm.scene.add(bone)
      // The mesh transform differs from the skeleton's world frame.
      mesh.position.x = 3
      vrm.scene.updateMatrixWorld(true)
      mesh.bind(new THREE.Skeleton([bone]), new THREE.Matrix4())
    }
    vrm.scene.rotation.y = Math.PI / 2
    vrm.scene.position.set(4, 2, -3)
    vrm.scene.scale.setScalar(2)

    ensureEyelidExpressions(vrm)

    const left = vrm.expressionManager!.getExpression('blinkLeft')!.binds as VRMExpressionMorphTargetBind[]
    const right = vrm.expressionManager!.getExpression('blinkRight')!.binds as VRMExpressionMorphTargetBind[]
    expect(left.map((bind) => bind.index)).toEqual([1, 1])
    expect(right.map((bind) => bind.index)).toEqual([0, 0])
    expect(right.flatMap((bind) => bind.primitives)).toEqual([unused, mesh])
  })

  it.each(['absolute', 'centered', 'unmoved', 'missing shoulders'] as const)(
    'resolves absolute morphs and preserves name fallback: %s', (kind) => {
      const mesh = makeMesh(['ウィンク'])
      mesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute([-0.05, 1, 0], 3))
      mesh.geometry.morphTargetsRelative = kind !== 'absolute'
      mesh.geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(
        kind === 'absolute' ? [-0.05, 0.98, 0] : [0, kind === 'unmoved' ? 0 : -0.02, 0], 3,
      )]
      if (kind === 'centered') mesh.geometry.attributes.position.setX(0, 0)
      const vrm = makeVRM([mesh])
      if (kind !== 'missing shoulders') addShoulders(vrm)

      ensureEyelidExpressions(vrm)

      expect(vrm.expressionManager!.getExpression(kind === 'absolute' ? 'blinkRight' : 'blinkLeft')).toBeTruthy()
      expect(vrm.expressionManager!.getExpression(kind === 'absolute' ? 'blinkLeft' : 'blinkRight')).toBeNull()
    },
  )

  it('binds Japanese MMD-style morphs (ウィンク / ウィンク右 / まばたき)', () => {
    const body = makeMesh(['--Eyes--', 'まばたき', 'ウィンク', 'ウィンク右', 'unrelated'])
    const vrm = makeVRM([body])

    ensureEyelidExpressions(vrm)

    const manager = vrm.expressionManager!
    const reg = manager.registerExpression as ReturnType<typeof vi.fn>
    expect(reg).toHaveBeenCalledTimes(3)

    const names = reg.mock.calls.map((c) => (c[0] as VRMExpression).expressionName).sort()
    expect(names).toEqual(['blink', 'blinkLeft', 'blinkRight'])

    const blinkLeft = reg.mock.calls.find(
      (c) => (c[0] as VRMExpression).expressionName === 'blinkLeft',
    )![0] as VRMExpression
    const bind = blinkLeft.binds[0] as VRMExpressionMorphTargetBind
    expect(bind.index).toBe(body.morphTargetDictionary!['ウィンク'])
    expect(bind.weight).toBe(1.0)
    expect(bind.primitives).toContain(body)
  })

  it('binds English Blink_L / Blink_R / Blink case-insensitively', () => {
    const body = makeMesh(['blink_l', 'BLINK_R', 'Blink'])
    const vrm = makeVRM([body])

    ensureEyelidExpressions(vrm)

    const reg = vrm.expressionManager!.registerExpression as ReturnType<typeof vi.fn>
    const names = reg.mock.calls.map((c) => (c[0] as VRMExpression).expressionName).sort()
    expect(names).toEqual(['blink', 'blinkLeft', 'blinkRight'])
  })

  it('does not overwrite expressions that already exist', () => {
    const body = makeMesh(['Blink_L', 'Blink_R', 'Blink'])
    const existingLeft = new VRMExpression('blinkLeft')
    const vrm = makeVRM([body], { blinkLeft: existingLeft })

    ensureEyelidExpressions(vrm)

    const reg = vrm.expressionManager!.registerExpression as ReturnType<typeof vi.fn>
    const names = reg.mock.calls.map((c) => (c[0] as VRMExpression).expressionName).sort()
    expect(names).toEqual(['blink', 'blinkRight'])
  })

  it('falls back to "both eyes" morph for missing L/R with halved weight', () => {
    const body = makeMesh(['まばたき'])
    const vrm = makeVRM([body])

    ensureEyelidExpressions(vrm)

    const reg = vrm.expressionManager!.registerExpression as ReturnType<typeof vi.fn>
    const exps = reg.mock.calls.map((c) => c[0] as VRMExpression)
    const byName = Object.fromEntries(exps.map((e) => [e.expressionName, e]))

    expect(byName.blink).toBeDefined()
    expect(byName.blinkLeft).toBeDefined()
    expect(byName.blinkRight).toBeDefined()

    const leftBind = byName.blinkLeft.binds[0] as VRMExpressionMorphTargetBind
    const rightBind = byName.blinkRight.binds[0] as VRMExpressionMorphTargetBind
    expect(leftBind.weight).toBe(0.5)
    expect(rightBind.weight).toBe(0.5)
    expect(leftBind.index).toBe(body.morphTargetDictionary!['まばたき'])
  })

  it('does nothing when no eyelid morphs are present', () => {
    const body = makeMesh(['onlyMouth', 'somethingElse'])
    const vrm = makeVRM([body])

    ensureEyelidExpressions(vrm)

    const reg = vrm.expressionManager!.registerExpression as ReturnType<typeof vi.fn>
    expect(reg).not.toHaveBeenCalled()
  })

  it('does nothing when expressionManager is absent', () => {
    const vrm = { scene: new THREE.Group(), expressionManager: undefined } as unknown as VRM
    expect(() => ensureEyelidExpressions(vrm)).not.toThrow()
  })

  it('discovers morphs across multiple meshes', () => {
    const bodyA = makeMesh(['まばたき', 'something'])
    const bodyB = makeMesh(['ウィンク', 'ウィンク右'])
    const vrm = makeVRM([bodyA, bodyB])

    ensureEyelidExpressions(vrm)

    const reg = vrm.expressionManager!.registerExpression as ReturnType<typeof vi.fn>
    const exps = reg.mock.calls.map((c) => c[0] as VRMExpression)
    const byName = Object.fromEntries(exps.map((e) => [e.expressionName, e]))

    const leftBind = byName.blinkLeft.binds[0] as VRMExpressionMorphTargetBind
    expect(leftBind.primitives).toContain(bodyB)
    expect(leftBind.index).toBe(0)

    const blinkBind = byName.blink.binds[0] as VRMExpressionMorphTargetBind
    expect(blinkBind.primitives).toContain(bodyA)
  })
})
