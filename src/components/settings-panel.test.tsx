import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsPanel, type SettingsPanelProps } from './settings-panel'

describe('SettingsPanel', () => {
  const defaultProps: SettingsPanelProps = {
    smoothing: 0.5,
    onSmoothingChange: vi.fn(),
    faceTrackingEnabled: true,
    onFaceTrackingChange: vi.fn(),
    poseTrackingEnabled: true,
    onPoseTrackingChange: vi.fn(),
    handTrackingEnabled: false,
    onHandTrackingChange: vi.fn(),
    trackingFps: 30,
    onTrackingFpsChange: vi.fn(),
    drawingFps: 60,
    onDrawingFpsChange: vi.fn(),
  }

  it('should render smoothing slider', () => {
    render(<SettingsPanel {...defaultProps} />)

    expect(screen.getByLabelText(/smoothing/i)).toBeDefined()
  })

  it('should render tracking toggles', () => {
    render(<SettingsPanel {...defaultProps} />)

    expect(screen.getByLabelText(/face tracking/i)).toBeDefined()
    expect(screen.getByLabelText(/pose tracking/i)).toBeDefined()
    expect(screen.getByLabelText(/hand tracking/i)).toBeDefined()
  })

  it('should call onSmoothingChange when slider changes', () => {
    const onSmoothingChange = vi.fn()
    render(<SettingsPanel {...defaultProps} onSmoothingChange={onSmoothingChange} />)

    const slider = screen.getByLabelText(/smoothing/i)
    fireEvent.change(slider, { target: { value: '0.8' } })

    expect(onSmoothingChange).toHaveBeenCalledWith(0.8)
  })

  it('should show import VRM button when onVRMImport provided', () => {
    const onVRMImport = vi.fn()
    render(<SettingsPanel {...defaultProps} onVRMImport={onVRMImport} />)

    expect(screen.getByTestId('import-vrm-button')).toBeDefined()
  })

  it('should not show import VRM button when onVRMImport not provided', () => {
    render(<SettingsPanel {...defaultProps} />)

    expect(screen.queryByTestId('import-vrm-button')).toBeNull()
  })

  it('should call onVRMImport when file selected', () => {
    const onVRMImport = vi.fn()
    render(<SettingsPanel {...defaultProps} onVRMImport={onVRMImport} />)

    const fileInput = screen.getByTestId('vrm-file-input')
    const file = new File(['vrm content'], 'avatar.vrm', { type: 'model/gltf-binary' })

    Object.defineProperty(fileInput, 'files', { value: [file] })
    fireEvent.change(fileInput)

    expect(onVRMImport).toHaveBeenCalledWith(file)
  })

  it('should disable import button when vrmLoading is true', () => {
    const onVRMImport = vi.fn()
    render(<SettingsPanel {...defaultProps} onVRMImport={onVRMImport} vrmLoading={true} />)

    const button = screen.getByTestId('import-vrm-button')
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent('Loading...')
  })

  it('should render tracking FPS slider', () => {
    render(<SettingsPanel {...defaultProps} />)

    expect(screen.getByLabelText(/tracking fps/i)).toBeDefined()
  })

  it('should call onTrackingFpsChange when tracking FPS slider changes', () => {
    const onTrackingFpsChange = vi.fn()
    render(<SettingsPanel {...defaultProps} onTrackingFpsChange={onTrackingFpsChange} />)

    const slider = screen.getByLabelText(/tracking fps/i)
    fireEvent.change(slider, { target: { value: '15' } })

    expect(onTrackingFpsChange).toHaveBeenCalledWith(15)
  })

  it('should render drawing FPS slider', () => {
    render(<SettingsPanel {...defaultProps} />)

    expect(screen.getByLabelText(/drawing fps/i)).toBeDefined()
  })

  it('should call onDrawingFpsChange when drawing FPS slider changes', () => {
    const onDrawingFpsChange = vi.fn()
    render(<SettingsPanel {...defaultProps} onDrawingFpsChange={onDrawingFpsChange} />)

    const slider = screen.getByLabelText(/drawing fps/i)
    fireEvent.change(slider, { target: { value: '30' } })

    expect(onDrawingFpsChange).toHaveBeenCalledWith(30)
  })
})
