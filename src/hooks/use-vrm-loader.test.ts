import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useVRMLoader } from './use-vrm-loader'

// Mock three.js and VRM loader
vi.mock('three', () => ({
  LoadingManager: vi.fn(() => ({
    onProgress: null,
    onError: null,
  })),
}))

vi.mock('@pixiv/three-vrm', () => ({
  VRMLoaderPlugin: vi.fn(),
  VRM: {},
}))

vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: vi.fn(() => ({
    register: vi.fn(),
    load: vi.fn(),
  })),
}))

describe('useVRMLoader', () => {
  it('should start with loading false and no model', () => {
    const { result } = renderHook(() => useVRMLoader())

    expect(result.current.vrm).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should set error when loadFromUrl fails', async () => {
    const { result } = renderHook(() => useVRMLoader())

    await act(async () => {
      await result.current.loadFromUrl('/test.vrm').catch(() => {})
    })

    expect(result.current.error).not.toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('should set error when loadFromFile fails', async () => {
    const { result } = renderHook(() => useVRMLoader())
    const mockFile = new File([''], 'test.vrm', { type: 'model/gltf-binary' })

    await act(async () => {
      await result.current.loadFromFile(mockFile).catch(() => {})
    })

    expect(result.current.error).not.toBeNull()
    expect(result.current.loading).toBe(false)
  })
})
