import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVRMLoader } from './use-vrm-loader'
import type { StoredVRM } from '../lib/vrm/vrm-storage'

// Mock VRM instance
const createMockVRM = () => ({
  scene: {
    traverse: vi.fn((callback: (obj: unknown) => void) => {
      // Simulate traversing a mesh with geometry and material
      callback({
        geometry: { dispose: vi.fn() },
        material: { dispose: vi.fn() },
      })
    }),
  },
  meta: { name: 'Test VRM' },
})

// Mock GLTFLoader load function - will be set per test
let mockGLTFLoad: ReturnType<typeof vi.fn>

// Mock three.js and VRM loader
vi.mock('three', () => ({
  LoadingManager: vi.fn(() => ({
    onProgress: null,
    onError: null,
  })),
}))

vi.mock('@pixiv/three-vrm', () => ({
  VRMLoaderPlugin: vi.fn(),
}))

// Mock VRM storage
const mockSaveVRM = vi.fn().mockResolvedValue(1)
const mockLoadVRMFromDB = vi.fn().mockResolvedValue(null)
const mockUpdateLastUsed = vi.fn().mockResolvedValue(undefined)

vi.mock('../lib/vrm/vrm-storage', () => ({
  saveVRM: (...args: unknown[]) => mockSaveVRM(...args),
  loadVRM: (...args: unknown[]) => mockLoadVRMFromDB(...args),
  updateLastUsed: (...args: unknown[]) => mockUpdateLastUsed(...args),
}))

vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class MockGLTFLoader {
    register() {
      return this
    }
    load(
      url: string,
      onLoad: (gltf: unknown) => void,
      onProgress?: (event: { loaded: number; total: number }) => void,
      onError?: (error: Error) => void
    ) {
      if (mockGLTFLoad) {
        mockGLTFLoad(url, onLoad, onProgress, onError)
      }
    }
  },
}))

describe('useVRMLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGLTFLoad = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should start with loading false and no model', () => {
    const { result } = renderHook(() => useVRMLoader())

    expect(result.current.vrm).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.progress).toBe(0)
  })

  it('should load VRM file from URL using GLTFLoader', async () => {
    const mockVRM = createMockVRM()

    mockGLTFLoad.mockImplementation((url, onLoad) => {
      onLoad({ userData: { vrm: mockVRM } })
    })

    const { result } = renderHook(() => useVRMLoader())

    await act(async () => {
      await result.current.loadFromUrl('/models/test.vrm')
    })

    expect(result.current.vrm).toBe(mockVRM)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should load VRM from File object via URL.createObjectURL', async () => {
    const mockVRM = createMockVRM()
    const mockObjectURL = 'blob:http://localhost/mock-url'

    vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockObjectURL)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    mockGLTFLoad.mockImplementation((url, onLoad) => {
      expect(url).toBe(mockObjectURL)
      onLoad({ userData: { vrm: mockVRM } })
    })

    const { result } = renderHook(() => useVRMLoader())
    const mockFile = new File(['vrm-content'], 'avatar.vrm', {
      type: 'model/gltf-binary',
    })
    mockFile.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8))

    await act(async () => {
      await result.current.loadFromFile(mockFile)
    })

    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(result.current.vrm).toBe(mockVRM)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockObjectURL)
  })

  it('should report loading progress (0-100%)', async () => {
    const mockVRM = createMockVRM()
    const progressValues: number[] = []

    mockGLTFLoad.mockImplementation((url, onLoad, onProgress) => {
      // Simulate progress events
      onProgress({ loaded: 25, total: 100 })
      onProgress({ loaded: 50, total: 100 })
      onProgress({ loaded: 75, total: 100 })
      onProgress({ loaded: 100, total: 100 })
      onLoad({ userData: { vrm: mockVRM } })
    })

    const { result } = renderHook(() => useVRMLoader())

    await act(async () => {
      const progressPromise = result.current.loadFromUrl('/test.vrm')
      progressValues.push(result.current.progress)
      await progressPromise
    })

    // Progress should have been updated during loading
    expect(result.current.progress).toBe(100)
  })

  it('should dispose previous VRM when loading new one', async () => {
    const firstVRM = createMockVRM()
    const secondVRM = createMockVRM()

    let loadCount = 0
    mockGLTFLoad.mockImplementation((url, onLoad) => {
      loadCount++
      onLoad({ userData: { vrm: loadCount === 1 ? firstVRM : secondVRM } })
    })

    const { result } = renderHook(() => useVRMLoader())

    // Load first VRM
    await act(async () => {
      await result.current.loadFromUrl('/first.vrm')
    })
    expect(result.current.vrm).toBe(firstVRM)

    // Load second VRM - first should be disposed
    await act(async () => {
      await result.current.loadFromUrl('/second.vrm')
    })

    expect(firstVRM.scene.traverse).toHaveBeenCalled()
    expect(result.current.vrm).toBe(secondVRM)
  })

  it('should reject invalid/corrupted VRM files', async () => {
    mockGLTFLoad.mockImplementation((url, onLoad, onProgress, onError) => {
      onError(new Error('Invalid VRM file'))
    })

    const { result } = renderHook(() => useVRMLoader())

    await act(async () => {
      await result.current.loadFromUrl('/invalid.vrm').catch(() => {})
    })

    expect(result.current.error).not.toBeNull()
    expect(result.current.error?.message).toBe('Invalid VRM file')
    expect(result.current.vrm).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('should handle GLTF without VRM data', async () => {
    mockGLTFLoad.mockImplementation((url, onLoad) => {
      // GLTF loaded but no VRM data
      onLoad({ userData: {} })
    })

    const { result } = renderHook(() => useVRMLoader())

    await act(async () => {
      await result.current.loadFromUrl('/not-vrm.glb').catch(() => {})
    })

    expect(result.current.error).not.toBeNull()
    expect(result.current.error?.message).toContain('VRM')
    expect(result.current.vrm).toBeNull()
  })

  describe('loadFromFile persistence', () => {
    it('should persist ArrayBuffer to IndexedDB after file load', async () => {
      const mockVRM = createMockVRM()
      mockSaveVRM.mockResolvedValue(42)

      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/mock-url')
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

      mockGLTFLoad.mockImplementation((_url, onLoad) => {
        onLoad({ userData: { vrm: mockVRM } })
      })

      const { result } = renderHook(() => useVRMLoader())
      const mockBuffer = new ArrayBuffer(8)
      const mockFile = new File(['vrm-data'], 'avatar.vrm', { type: 'model/gltf-binary' })
      // jsdom File doesn't implement arrayBuffer(), so we add it
      mockFile.arrayBuffer = vi.fn().mockResolvedValue(mockBuffer)

      await act(async () => {
        await result.current.loadFromFile(mockFile)
      })

      // Wait for async fire-and-forget save
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(mockSaveVRM).toHaveBeenCalledWith(
        expect.any(ArrayBuffer),
        expect.any(Blob),
        'avatar.vrm',
        mockFile.size
      )
      expect(result.current.lastSavedId).toBe(42)
    })
  })

  describe('loadFromStorage', () => {
    it('should load VRM from IndexedDB by ID', async () => {
      const mockVRM = createMockVRM()
      const stored: StoredVRM = {
        id: 5,
        data: new ArrayBuffer(100),
        thumbnail: new Blob([], { type: 'image/jpeg' }),
        name: 'stored.vrm',
        size: 100,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      }
      mockLoadVRMFromDB.mockResolvedValue(stored)

      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/stored-url')
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

      mockGLTFLoad.mockImplementation((_url, onLoad) => {
        onLoad({ userData: { vrm: mockVRM } })
      })

      const { result } = renderHook(() => useVRMLoader())

      await act(async () => {
        await result.current.loadFromStorage(5)
      })

      expect(mockLoadVRMFromDB).toHaveBeenCalledWith(5)
      expect(result.current.vrm).toBe(mockVRM)
      expect(mockUpdateLastUsed).toHaveBeenCalledWith(5)
      expect(result.current.lastSavedId).toBe(5)
    })

    it('should set error when VRM not found in storage', async () => {
      mockLoadVRMFromDB.mockResolvedValue(null)

      const { result } = renderHook(() => useVRMLoader())

      await act(async () => {
        await result.current.loadFromStorage(999).catch(() => {})
      })

      expect(result.current.error).not.toBeNull()
      expect(result.current.error?.message).toBe('VRM not found in storage')
      expect(result.current.loading).toBe(false)
    })
  })

  it('should set loading true during load operation', async () => {
    const mockVRM = createMockVRM()
    let loadingDuringLoad = false
    let resolveLoad: () => void

    const loadPromise = new Promise<void>((resolve) => {
      resolveLoad = resolve
    })

    mockGLTFLoad.mockImplementation((url, onLoad) => {
      // Capture loading state while load is in progress
      loadingDuringLoad = true
      loadPromise.then(() => {
        onLoad({ userData: { vrm: mockVRM } })
      })
    })

    const { result } = renderHook(() => useVRMLoader())

    let outerLoadPromise: Promise<void>

    act(() => {
      outerLoadPromise = result.current.loadFromUrl('/test.vrm')
    })

    // After starting load, loading should be true
    expect(result.current.loading).toBe(true)

    // Complete the load
    await act(async () => {
      resolveLoad!()
      await outerLoadPromise!
    })

    expect(loadingDuringLoad).toBe(true)
    expect(result.current.loading).toBe(false)
  })
})
