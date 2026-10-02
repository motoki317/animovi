import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { createElement, useEffect } from 'react'
import { render, renderHook, act } from '@testing-library/react'
import { BufferGeometry, Group, Mesh, Texture } from 'three'
import { MToonMaterial, VRMUtils, type VRM } from '@pixiv/three-vrm'
import { useVRMLoader, type UseVRMLoaderResult } from './use-vrm-loader'
import type { StoredVRM } from '../lib/vrm/vrm-storage'

const createMockVRM = () => ({
  scene: {
    traverse: vi.fn((callback: (obj: unknown) => void) => {
      callback({
        geometry: { dispose: vi.fn() },
        material: { dispose: vi.fn() },
      })
    }),
  },
  meta: { name: 'Test VRM' },
})

const vrmFile = () => new File(['vrm'], 'avatar.vrm')

type GLTFLoad = (
  url: string,
  onLoad: (gltf: unknown) => void,
  onProgress: (event: { loaded: number; total: number }) => void,
  onError: (error: Error) => void,
) => void

let mockGLTFLoad: Mock<GLTFLoad>

vi.mock('@pixiv/three-vrm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@pixiv/three-vrm')>()),
  VRMLoaderPlugin: vi.fn(),
}))

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
    load(...args: Parameters<GLTFLoad>) {
      mockGLTFLoad(...args)
    }
  },
}))

describe('useVRMLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGLTFLoad = vi.fn<GLTFLoad>()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
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
    mockGLTFLoad.mockImplementation((_url, _onLoad, onProgress) => {
      onProgress({ loaded: 25, total: 100 })
      onProgress({ loaded: 75, total: 100 })
    })

    const { result } = renderHook(() => useVRMLoader())

    await act(async () => {
      void result.current.loadFromFile(vrmFile())
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(result.current.progress).toBe(75)
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

    await act(async () => {
      await result.current.loadFromFile(vrmFile())
    })
    expect(result.current.vrm).toBe(firstVRM)

    await act(async () => {
      await result.current.loadFromFile(vrmFile())
    })

    expect(firstVRM.scene.traverse).toHaveBeenCalled()
    expect(result.current.vrm).toBe(secondVRM)
  })

  it('disposes the MToon textures of the previous VRM', async () => {
    // MToon keeps its textures in uniforms behind prototype getters.
    const texture = new Texture()
    const disposeTexture = vi.spyOn(texture, 'dispose')
    const scene = new Group()
    scene.add(new Mesh(new BufferGeometry(), new MToonMaterial({ map: texture })))
    mockGLTFLoad
      .mockImplementationOnce((_url, onLoad) => onLoad({ userData: { vrm: { scene } } }))
      .mockImplementationOnce((_url, onLoad) => onLoad({ userData: { vrm: createMockVRM() } }))

    const { result } = renderHook(() => useVRMLoader())
    await act(async () => {
      await result.current.loadFromFile(vrmFile())
    })
    await act(async () => {
      await result.current.loadFromFile(vrmFile())
    })

    expect(disposeTexture).toHaveBeenCalled()
  })

  it('disposes the previous VRM after the scene removes it', async () => {
    // A frame between the dispose and the removal uploads the disposed
    // geometries and textures again, and nothing frees them later.
    const displayScene = new Group()
    const first = { scene: new Group() }
    let attachedAtDispose: boolean | undefined
    vi.spyOn(VRMUtils, 'deepDispose').mockImplementation((object) => {
      if (object === first.scene) attachedAtDispose = first.scene.parent !== null
    })
    mockGLTFLoad
      .mockImplementationOnce((_url, onLoad) => onLoad({ userData: { vrm: first } }))
      .mockImplementationOnce((_url, onLoad) => onLoad({ userData: { vrm: { scene: new Group() } } }))

    // Mirrors page.tsx and its child AvatarScene, which adds vrm.scene in an
    // effect and removes it in the cleanup.
    function SceneChild({ vrm }: { vrm: VRM | null }) {
      useEffect(() => {
        if (!vrm) return
        displayScene.add(vrm.scene)
        return () => {
          displayScene.remove(vrm.scene)
        }
      }, [vrm])
      return null
    }
    let loader!: UseVRMLoaderResult
    function Page() {
      loader = useVRMLoader()
      return createElement(SceneChild, { vrm: loader.vrm })
    }
    render(createElement(Page))

    await act(async () => {
      await loader.loadFromFile(vrmFile())
    })
    await act(async () => {
      await loader.loadFromFile(vrmFile())
    })

    expect(attachedAtDispose).toBe(false)
  })

  it('should reject invalid/corrupted VRM files', async () => {
    mockGLTFLoad.mockImplementation((url, onLoad, onProgress, onError) => {
      onError(new Error('Invalid VRM file'))
    })

    const { result } = renderHook(() => useVRMLoader())

    await act(async () => {
      await result.current.loadFromFile(vrmFile()).catch(() => {})
    })

    expect(result.current.error).not.toBeNull()
    expect(result.current.error?.message).toBe('Invalid VRM file')
    expect(result.current.vrm).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('should handle GLTF without VRM data', async () => {
    mockGLTFLoad.mockImplementation((url, onLoad) => {
      onLoad({ userData: {} })
    })

    const { result } = renderHook(() => useVRMLoader())

    await act(async () => {
      await result.current.loadFromFile(vrmFile()).catch(() => {})
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
      mockFile.arrayBuffer = vi.fn().mockResolvedValue(mockBuffer)

      await act(async () => {
        await result.current.loadFromFile(mockFile)
      })

      // saveVRM() runs after loadFromFile() resolves.
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

    it('clears loading when the file read fails', async () => {
      const { result } = renderHook(() => useVRMLoader())
      const file = new File([], 'avatar.vrm')
      file.arrayBuffer = vi.fn().mockRejectedValue(new Error('file read failed'))

      await act(async () => {
        await result.current.loadFromFile(file).catch(() => {})
      })

      expect(result.current.loading).toBe(false)
      expect(result.current.error?.message).toBe('file read failed')
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

    it('clears loading when the IndexedDB read fails', async () => {
      mockLoadVRMFromDB.mockRejectedValueOnce(new Error('IndexedDB unavailable'))

      const { result } = renderHook(() => useVRMLoader())

      await act(async () => {
        await result.current.loadFromStorage(1).catch(() => {})
      })

      expect(result.current.loading).toBe(false)
      expect(result.current.error?.message).toBe('IndexedDB unavailable')
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
      loadingDuringLoad = true
      loadPromise.then(() => {
        onLoad({ userData: { vrm: mockVRM } })
      })
    })

    const { result } = renderHook(() => useVRMLoader())

    let outerLoadPromise: Promise<void>

    act(() => {
      outerLoadPromise = result.current.loadFromFile(vrmFile())
    })

    expect(result.current.loading).toBe(true)

    await act(async () => {
      resolveLoad!()
      await outerLoadPromise!
    })

    expect(loadingDuringLoad).toBe(true)
    expect(result.current.loading).toBe(false)
  })
})
