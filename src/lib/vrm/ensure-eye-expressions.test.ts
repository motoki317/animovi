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

describe('ensureEyelidExpressions', () => {
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
    // Only a single "both eyes" blink morph exists, no separate L/R
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
