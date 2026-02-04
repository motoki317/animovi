import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BackgroundSettings } from './background-settings'

describe('BackgroundSettings', () => {
  const mockOnChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should allow solid color background', () => {
    render(
      <BackgroundSettings
        type="solid"
        color="#4a90d9"
        onChange={mockOnChange}
      />
    )

    // Use getByRole with type='color' to find the color input specifically
    const colorInput = screen.getByTestId('color-input')
    expect(colorInput).toHaveValue('#4a90d9')

    fireEvent.change(colorInput, { target: { value: '#ff0000' } })

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'solid',
        color: '#ff0000',
      })
    )
  })

  it('should allow transparent background for OBS', () => {
    render(
      <BackgroundSettings
        type="transparent"
        onChange={mockOnChange}
      />
    )

    const transparentOption = screen.getByRole('radio', { name: /transparent/i })
    expect(transparentOption).toBeChecked()
  })

  it('should switch between background types', () => {
    render(
      <BackgroundSettings
        type="solid"
        color="#ffffff"
        onChange={mockOnChange}
      />
    )

    const transparentOption = screen.getByRole('radio', { name: /transparent/i })
    fireEvent.click(transparentOption)

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'transparent',
      })
    )
  })

  it('should allow custom image background', () => {
    render(
      <BackgroundSettings
        type="image"
        imageUrl="/bg.jpg"
        onChange={mockOnChange}
      />
    )

    const imageOption = screen.getByRole('radio', { name: /image/i })
    expect(imageOption).toBeChecked()
  })

  it('should persist background preference', () => {
    const storedSettings = {
      type: 'solid' as const,
      color: '#3498db',
    }

    render(
      <BackgroundSettings
        type={storedSettings.type}
        color={storedSettings.color}
        onChange={mockOnChange}
      />
    )

    expect(screen.getByTestId('color-input')).toHaveValue('#3498db')
  })

  it('should show color picker only for solid type', () => {
    const { rerender } = render(
      <BackgroundSettings
        type="solid"
        color="#ffffff"
        onChange={mockOnChange}
      />
    )

    expect(screen.getByTestId('color-input')).toBeVisible()

    rerender(
      <BackgroundSettings type="transparent" onChange={mockOnChange} />
    )

    expect(screen.queryByTestId('color-input')).not.toBeInTheDocument()
  })

  it('should show image upload for image type', () => {
    render(
      <BackgroundSettings
        type="image"
        onChange={mockOnChange}
      />
    )

    expect(screen.getByLabelText(/upload/i)).toBeInTheDocument()
  })

  it('should handle image file selection', () => {
    render(
      <BackgroundSettings
        type="image"
        onChange={mockOnChange}
      />
    )

    const input = screen.getByLabelText(/upload/i)
    const file = new File(['image'], 'bg.png', { type: 'image/png' })

    Object.defineProperty(input, 'files', {
      value: [file],
    })

    fireEvent.change(input)

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'image',
        imageFile: file,
      })
    )
  })

  it('should display preset color options', () => {
    render(
      <BackgroundSettings
        type="solid"
        color="#ffffff"
        onChange={mockOnChange}
        showPresets
      />
    )

    expect(screen.getByTestId('color-presets')).toBeInTheDocument()
  })

  it('should apply preset color when clicked', () => {
    render(
      <BackgroundSettings
        type="solid"
        color="#ffffff"
        onChange={mockOnChange}
        showPresets
      />
    )

    const greenPreset = screen.getByRole('button', { name: /green/i })
    fireEvent.click(greenPreset)

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'solid',
        color: expect.stringMatching(/#00ff00|green/i),
      })
    )
  })
})
