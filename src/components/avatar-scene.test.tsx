import { describe, it, expect, vi, beforeEach, onTestFinished } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { StrictMode, createRef } from 'react'
import { AvatarScene, type AvatarSceneHandle } from './avatar-scene'

const rendererInstances: {
  render: ReturnType<typeof vi.fn>
  setClearColor: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
  forceContextLoss: ReturnType<typeof vi.fn>
  domElement: HTMLCanvasElement & { toBlob: ReturnType<typeof vi.fn> }
}[] = []
const sceneInstances: { background: unknown }[] = []
const timerInstances: { update: ReturnType<typeof vi.fn> }[] = []
const controlsInstances: { target: { set: ReturnType<typeof vi.fn> } }[] = []

vi.mock('three', () => {
  class MockScene {
    background = null
    add = vi.fn()
    remove = vi.fn()

    constructor() {
      sceneInstances.push(this)
    }
  }
  class MockPerspectiveCamera {
    position = { set: vi.fn(), y: 1.3, z: 1.5 }
    aspect = 1
    updateProjectionMatrix = vi.fn()
    lookAt = vi.fn()
  }
  class MockWebGLRenderer {
    domElement = Object.assign(document.createElement('canvas'), {
      toBlob: vi.fn((callback: BlobCallback) => callback(new Blob(['jpeg'], { type: 'image/jpeg' }))),
    })
    setSize = vi.fn()
    setPixelRatio = vi.fn()
    setClearColor = vi.fn()
    render = vi.fn()
    dispose = vi.fn()
    forceContextLoss = vi.fn()

    constructor() {
      rendererInstances.push(this)
    }
  }
  class MockDirectionalLight {
    position = { set: vi.fn() }
  }
  class MockAmbientLight {}
  class MockColor {}
  class MockVector3 {
    x = 0
    y = 1
    z = 0
    set = vi.fn().mockReturnThis()
  }
  class MockBox3 {
    setFromObject = vi.fn().mockReturnThis()
    getCenter = vi.fn().mockReturnValue(new MockVector3())
    getSize = vi.fn().mockReturnValue(new MockVector3())
  }
  class MockTimer {
    update = vi.fn().mockReturnThis()
    getDelta = vi.fn().mockReturnValue(0.016)

    constructor() {
      timerInstances.push(this)
    }
  }

  return {
    Scene: MockScene,
    PerspectiveCamera: MockPerspectiveCamera,
    WebGLRenderer: MockWebGLRenderer,
    DirectionalLight: MockDirectionalLight,
    AmbientLight: MockAmbientLight,
    Color: MockColor,
    Vector3: MockVector3,
    Box3: MockBox3,
    Timer: MockTimer,
  }
})

vi.mock('three/addons/controls/OrbitControls.js', () => {
  class MockOrbitControls {
    target = { set: vi.fn() }
    enableDamping = false
    dampingFactor = 0.05
    minDistance = 0
    maxDistance = Infinity
    maxPolarAngle = Math.PI
    minPolarAngle = 0
    update = vi.fn()
    dispose = vi.fn()

    constructor() {
      controlsInstances.push(this)
    }
  }
  return { OrbitControls: MockOrbitControls }
})

describe('AvatarScene', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render canvas element', () => {
    render(<AvatarScene />)

    const container = screen.getByTestId('avatar-scene')
    expect(container).toBeDefined()
  })

  it('should accept background props', () => {
    render(<AvatarScene backgroundType="solid" backgroundColor="#00ff00" />)

    const container = screen.getByTestId('avatar-scene')
    expect(container).toBeDefined()
  })

  it('should accept camera position props', () => {
    render(<AvatarScene cameraY={1.5} cameraZ={2.0} />)

    const container = screen.getByTestId('avatar-scene')
    expect(container).toBeDefined()
  })

  it('should support transparent background', () => {
    render(<AvatarScene backgroundType="transparent" />)

    const container = screen.getByTestId('avatar-scene')
    expect(container).toBeDefined()
  })

  it('should not recreate renderer when background color changes', () => {
    rendererInstances.length = 0

    const { rerender, unmount } = render(
      <AvatarScene backgroundType="solid" backgroundColor="#000000" />
    )

    expect(rendererInstances).toHaveLength(1)
    const renderer = rendererInstances[0]

    rerender(<AvatarScene backgroundType="solid" backgroundColor="#ff0000" />)
    rerender(<AvatarScene backgroundType="solid" backgroundColor="#00ff00" />)

    expect(rendererInstances).toHaveLength(1)

    expect(renderer.dispose).not.toHaveBeenCalled()

    unmount()

    expect(renderer.dispose).toHaveBeenCalledTimes(1)
    expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1)
  })

  it('should call onAutoFrame only once per VRM load', () => {
    const onAutoFrame = vi.fn()

    const mockVRM = {
      scene: {
        traverse: vi.fn(),
        rotation: { y: 0 },
      },
      humanoid: {
        getNormalizedBoneNode: vi.fn().mockReturnValue({
          getWorldPosition: vi.fn((vec) => {
            vec.y = 1.5
            return vec
          }),
        }),
      },
      update: vi.fn(),
    }

    const { rerender } = render(
      <AvatarScene
        vrm={mockVRM as never}
        autoFrameOnLoad={true}
        onAutoFrame={onAutoFrame}
      />
    )

    expect(onAutoFrame).toHaveBeenCalledTimes(1)

    rerender(
      <AvatarScene
        vrm={mockVRM as never}
        autoFrameOnLoad={true}
        onAutoFrame={onAutoFrame}
      />
    )

    expect(onAutoFrame).toHaveBeenCalledTimes(1)
  })

  it('should call onAutoFrame when a different VRM is loaded', () => {
    const onAutoFrame = vi.fn()

    const mockVRM1 = {
      scene: { traverse: vi.fn(), rotation: { y: 0 } },
      humanoid: {
        getNormalizedBoneNode: vi.fn().mockReturnValue({
          getWorldPosition: vi.fn((vec) => {
            vec.y = 1.5
            return vec
          }),
        }),
      },
      update: vi.fn(),
    }

    const mockVRM2 = {
      scene: { traverse: vi.fn(), rotation: { y: 0 } },
      humanoid: {
        getNormalizedBoneNode: vi.fn().mockReturnValue({
          getWorldPosition: vi.fn((vec) => {
            vec.y = 1.8
            return vec
          }),
        }),
      },
      update: vi.fn(),
    }

    const { rerender } = render(
      <AvatarScene
        vrm={mockVRM1 as never}
        autoFrameOnLoad={true}
        onAutoFrame={onAutoFrame}
      />
    )

    expect(onAutoFrame).toHaveBeenCalledTimes(1)

    rerender(
      <AvatarScene
        vrm={mockVRM2 as never}
        autoFrameOnLoad={true}
        onAutoFrame={onAutoFrame}
      />
    )

    expect(onAutoFrame).toHaveBeenCalledTimes(2)
  })

  it('should not call onAutoFrame when autoFrameOnLoad is false', () => {
    const onAutoFrame = vi.fn()

    const mockVRM = {
      scene: { traverse: vi.fn(), rotation: { y: 0 } },
      humanoid: {
        getNormalizedBoneNode: vi.fn().mockReturnValue({
          getWorldPosition: vi.fn((vec) => {
            vec.y = 1.5
            return vec
          }),
        }),
      },
      update: vi.fn(),
    }

    render(
      <AvatarScene
        vrm={mockVRM as never}
        autoFrameOnLoad={false}
        onAutoFrame={onAutoFrame}
      />
    )

    expect(onAutoFrame).not.toHaveBeenCalled()
  })

  it('creates orbit controls', () => {
    controlsInstances.length = 0
    render(<AvatarScene />)

    expect(controlsInstances).toHaveLength(1)
  })

  it('should rotate VRM 0.x to face camera, leave VRM 1.x as-is', () => {
    const makeMockVRM = (metaVersion: '0' | '1') => ({
      meta: { metaVersion },
      scene: {
        traverse: vi.fn(),
        rotation: { y: 0 },
      },
      humanoid: {
        getNormalizedBoneNode: vi.fn().mockReturnValue({
          getWorldPosition: vi.fn((vec) => {
            vec.y = 1.5
            return vec
          }),
        }),
      },
      update: vi.fn(),
    })

    const v0 = makeMockVRM('0')
    render(<AvatarScene vrm={v0 as never} />)
    expect(v0.scene.rotation.y).toBe(Math.PI)

    const v1 = makeMockVRM('1')
    render(<AvatarScene vrm={v1 as never} />)
    expect(v1.scene.rotation.y).toBe(0)
  })

  it('should show context lost overlay when WebGL context is lost', () => {
    render(<AvatarScene />)

    expect(screen.queryByTestId('context-lost-overlay')).not.toBeInTheDocument()

    const container = screen.getByTestId('avatar-scene')
    const canvas = container.querySelector('canvas')
    expect(canvas).toBeTruthy()

    act(() => {
      const event = new Event('webglcontextlost')
      canvas!.dispatchEvent(event)
    })

    expect(screen.getByTestId('context-lost-overlay')).toBeInTheDocument()
    expect(screen.getByText('WebGL context lost')).toBeInTheDocument()

    act(() => {
      const event = new Event('webglcontextrestored')
      canvas!.dispatchEvent(event)
    })

    expect(screen.queryByTestId('context-lost-overlay')).not.toBeInTheDocument()
  })

  it('should handle callback updates without infinite loops', () => {
    const onAutoFrame1 = vi.fn()
    const onAutoFrame2 = vi.fn()

    const mockVRM = {
      scene: { traverse: vi.fn(), rotation: { y: 0 } },
      humanoid: {
        getNormalizedBoneNode: vi.fn().mockReturnValue({
          getWorldPosition: vi.fn((vec) => {
            vec.y = 1.5
            return vec
          }),
        }),
      },
      update: vi.fn(),
    }

    const { rerender } = render(
      <AvatarScene
        vrm={mockVRM as never}
        autoFrameOnLoad={true}
        onAutoFrame={onAutoFrame1}
      />
    )

    expect(onAutoFrame1).toHaveBeenCalledTimes(1)
    expect(onAutoFrame2).not.toHaveBeenCalled()

    rerender(
      <AvatarScene
        vrm={mockVRM as never}
        autoFrameOnLoad={true}
        onAutoFrame={onAutoFrame2}
      />
    )

    expect(onAutoFrame1).toHaveBeenCalledTimes(1)
    expect(onAutoFrame2).not.toHaveBeenCalled()
  })
})

describe('AvatarScene lifecycle', () => {
  beforeEach(() => {
    rendererInstances.length = 0
    controlsInstances.length = 0
  })

  it('leaves only the live canvas in the container after a StrictMode remount', () => {
    render(
      <StrictMode>
        <AvatarScene />
      </StrictMode>
    )

    const canvases = screen.getByTestId('avatar-scene').querySelectorAll('canvas')
    expect(canvases).toHaveLength(1)
    const owner = rendererInstances.find((r) => r.domElement === canvases[0])
    expect(owner?.dispose).not.toHaveBeenCalled()
  })

  it('points OrbitControls at the new camera height', () => {
    const { rerender } = render(<AvatarScene cameraY={1.3} cameraZ={1.5} />)
    rerender(<AvatarScene cameraY={2} cameraZ={1.5} />)

    expect(controlsInstances[0].target.set).toHaveBeenLastCalledWith(0, 2, 0)
  })

  it('points OrbitControls at the head after auto-framing', () => {
    const mockVRM = {
      scene: { traverse: vi.fn(), rotation: { y: 0 } },
      humanoid: {
        getNormalizedBoneNode: vi.fn().mockReturnValue({
          getWorldPosition: vi.fn((vec) => {
            vec.y = 1.45
            return vec
          }),
        }),
      },
      update: vi.fn(),
    }

    render(<AvatarScene vrm={mockVRM as never} autoFrameOnLoad={true} />)

    expect(controlsInstances[0].target.set).toHaveBeenLastCalledWith(0, 1.45, 0)
  })

  it('advances the VRM by the Timer delta on each drawn frame', () => {
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    onTestFinished(() => {
      vi.unstubAllGlobals()
    })
    timerInstances.length = 0
    const mockVRM = { scene: { traverse: vi.fn(), rotation: { y: 0 } }, update: vi.fn() }

    render(<AvatarScene vrm={mockVRM as never} autoFrameOnLoad={false} drawingFps={60} />)
    frames.splice(0).forEach((cb) => cb(100))

    expect(timerInstances[0].update).toHaveBeenCalledWith(100)
    expect(mockVRM.update).toHaveBeenCalledWith(0.016)
  })

  it('captures a thumbnail from a frame drawn in the same task', async () => {
    const ref = createRef<AvatarSceneHandle>()
    render(<AvatarScene ref={ref} />)
    const renderer = rendererInstances[0]
    renderer.render.mockClear()

    const blob = ref.current!.captureThumbnail()

    // The drawing buffer is not preserved, so toBlob() must run before the browser composites.
    expect(renderer.render).toHaveBeenCalledTimes(1)
    expect(renderer.domElement.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.7)
    expect(renderer.render.mock.invocationCallOrder[0])
      .toBeLessThan(renderer.domElement.toBlob.mock.invocationCallOrder[0])
    await expect(blob).resolves.toBeInstanceOf(Blob)
  })
})

describe('AvatarScene background', () => {
  beforeEach(() => {
    rendererInstances.length = 0
    sceneInstances.length = 0
  })

  it('shows an image background through a transparent canvas', () => {
    render(<AvatarScene backgroundType="image" backgroundImageUrl="blob:http://localhost/bg" />)

    expect(screen.getByTestId('avatar-scene').style.backgroundImage).toContain('blob:http://localhost/bg')
    expect(sceneInstances[0].background).toBeNull()
    expect(rendererInstances[0].setClearColor).toHaveBeenLastCalledWith(0x000000, 0)
  })

  it('falls back to the solid color when the image URL is missing', () => {
    render(<AvatarScene backgroundType="image" backgroundColor="#00ff00" />)

    expect(screen.getByTestId('avatar-scene').style.backgroundImage).toBe('')
    expect(sceneInstances[0].background).not.toBeNull()
    expect(rendererInstances[0].setClearColor).toHaveBeenLastCalledWith(0x000000, 1)
  })
})
