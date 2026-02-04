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
})
