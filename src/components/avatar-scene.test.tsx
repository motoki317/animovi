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
    position = { set: vi.fn() }
    aspect = 1
    updateProjectionMatrix = vi.fn()
  }
  class MockWebGLRenderer {
    domElement = document.createElement('canvas')
    setSize = vi.fn()
    setPixelRatio = vi.fn()
    render = vi.fn()
    dispose = vi.fn()
  }
  class MockDirectionalLight {
    position = { set: vi.fn() }
  }
  class MockAmbientLight {}
  class MockColor {}

  return {
    Scene: MockScene,
    PerspectiveCamera: MockPerspectiveCamera,
    WebGLRenderer: MockWebGLRenderer,
    DirectionalLight: MockDirectionalLight,
    AmbientLight: MockAmbientLight,
    Color: MockColor,
  }
})

describe('AvatarScene', () => {
  it('should render canvas element', () => {
    render(<AvatarScene />)

    const container = screen.getByTestId('avatar-scene')
    expect(container).toBeDefined()
  })
})
