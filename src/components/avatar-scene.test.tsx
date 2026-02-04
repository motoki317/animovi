import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
})
