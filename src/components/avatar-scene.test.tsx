import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AvatarScene } from './avatar-scene'

// Mock Three.js with proper classes
vi.mock('three', () => {
  class MockScene {
    background = null
    add = vi.fn()
    remove = vi.fn()
  }
  class MockPerspectiveCamera {
    position = { set: vi.fn(), y: 1.3, z: 1.5 }
    aspect = 1
    updateProjectionMatrix = vi.fn()
    lookAt = vi.fn()
  }
  class MockWebGLRenderer {
    domElement = document.createElement('canvas')
    setSize = vi.fn()
    setPixelRatio = vi.fn()
    setClearColor = vi.fn()
    render = vi.fn()
    dispose = vi.fn()
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

  return {
    Scene: MockScene,
    PerspectiveCamera: MockPerspectiveCamera,
    WebGLRenderer: MockWebGLRenderer,
    DirectionalLight: MockDirectionalLight,
    AmbientLight: MockAmbientLight,
    Color: MockColor,
    Vector3: MockVector3,
    Box3: MockBox3,
  }
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

  it('should call onAutoFrame only once per VRM load', () => {
    const onAutoFrame = vi.fn()

    // Create a mock VRM
    const mockVRM = {
      scene: {
        traverse: vi.fn(),
      },
      humanoid: {
        getNormalizedBoneNode: vi.fn().mockReturnValue({
          getWorldPosition: vi.fn((vec) => {
            vec.y = 1.5
            return vec
          }),
        }),
      },
    }

    const { rerender } = render(
      <AvatarScene
        vrm={mockVRM as never}
        autoFrameOnLoad={true}
        onAutoFrame={onAutoFrame}
      />
    )

    // First render with VRM should call onAutoFrame once
    expect(onAutoFrame).toHaveBeenCalledTimes(1)

    // Re-render with same VRM should NOT call onAutoFrame again
    rerender(
      <AvatarScene
        vrm={mockVRM as never}
        autoFrameOnLoad={true}
        onAutoFrame={onAutoFrame}
      />
    )

    // Should still be 1, not 2
    expect(onAutoFrame).toHaveBeenCalledTimes(1)
  })

  it('should call onAutoFrame when a different VRM is loaded', () => {
    const onAutoFrame = vi.fn()

    const mockVRM1 = {
      scene: { traverse: vi.fn() },
      humanoid: {
        getNormalizedBoneNode: vi.fn().mockReturnValue({
          getWorldPosition: vi.fn((vec) => {
            vec.y = 1.5
            return vec
          }),
        }),
      },
    }

    const mockVRM2 = {
      scene: { traverse: vi.fn() },
      humanoid: {
        getNormalizedBoneNode: vi.fn().mockReturnValue({
          getWorldPosition: vi.fn((vec) => {
            vec.y = 1.8
            return vec
          }),
        }),
      },
    }

    const { rerender } = render(
      <AvatarScene
        vrm={mockVRM1 as never}
        autoFrameOnLoad={true}
        onAutoFrame={onAutoFrame}
      />
    )

    expect(onAutoFrame).toHaveBeenCalledTimes(1)

    // Load a different VRM
    rerender(
      <AvatarScene
        vrm={mockVRM2 as never}
        autoFrameOnLoad={true}
        onAutoFrame={onAutoFrame}
      />
    )

    // Should be called again for the new VRM
    expect(onAutoFrame).toHaveBeenCalledTimes(2)
  })

  it('should not call onAutoFrame when autoFrameOnLoad is false', () => {
    const onAutoFrame = vi.fn()

    const mockVRM = {
      scene: { traverse: vi.fn() },
      humanoid: {
        getNormalizedBoneNode: vi.fn().mockReturnValue({
          getWorldPosition: vi.fn((vec) => {
            vec.y = 1.5
            return vec
          }),
        }),
      },
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

  it('should handle callback updates without infinite loops', () => {
    const onAutoFrame1 = vi.fn()
    const onAutoFrame2 = vi.fn()

    const mockVRM = {
      scene: { traverse: vi.fn() },
      humanoid: {
        getNormalizedBoneNode: vi.fn().mockReturnValue({
          getWorldPosition: vi.fn((vec) => {
            vec.y = 1.5
            return vec
          }),
        }),
      },
    }

    // Initial render
    const { rerender } = render(
      <AvatarScene
        vrm={mockVRM as never}
        autoFrameOnLoad={true}
        onAutoFrame={onAutoFrame1}
      />
    )

    expect(onAutoFrame1).toHaveBeenCalledTimes(1)
    expect(onAutoFrame2).not.toHaveBeenCalled()

    // Change callback - should NOT trigger auto-frame again for same VRM
    rerender(
      <AvatarScene
        vrm={mockVRM as never}
        autoFrameOnLoad={true}
        onAutoFrame={onAutoFrame2}
      />
    )

    // onAutoFrame1 should still be 1 (not called again)
    // onAutoFrame2 should be 0 (auto-frame already happened for this VRM)
    expect(onAutoFrame1).toHaveBeenCalledTimes(1)
    expect(onAutoFrame2).not.toHaveBeenCalled()
  })
})
