import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { VRMDropZone } from './vrm-drop-zone'

describe('VRMDropZone', () => {
  const mockOnLoad = vi.fn()
  const mockOnError = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should accept .vrm files via drag and drop', async () => {
    render(<VRMDropZone onLoad={mockOnLoad} onError={mockOnError} />)

    const dropZone = screen.getByTestId('vrm-drop-zone')
    const vrmFile = new File(['vrm content'], 'avatar.vrm', {
      type: 'model/gltf-binary',
    })

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [vrmFile],
      },
    })

    await waitFor(() => {
      expect(mockOnLoad).toHaveBeenCalledWith(vrmFile)
    })
  })

  it('should show visual feedback during drag', () => {
    render(<VRMDropZone onLoad={mockOnLoad} />)

    const dropZone = screen.getByTestId('vrm-drop-zone')

    fireEvent.dragEnter(dropZone)
    expect(dropZone).toHaveClass('vrm-drop-zone--dragging')

    fireEvent.dragLeave(dropZone)
    expect(dropZone).not.toHaveClass('vrm-drop-zone--dragging')
  })

  it('should validate file extension before loading', async () => {
    render(<VRMDropZone onLoad={mockOnLoad} onError={mockOnError} />)

    const dropZone = screen.getByTestId('vrm-drop-zone')
    const invalidFile = new File(['text'], 'readme.txt', {
      type: 'text/plain',
    })

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [invalidFile],
      },
    })

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Invalid file'),
        })
      )
    })

    expect(mockOnLoad).not.toHaveBeenCalled()
  })

  it('should accept .glb files as valid VRM files', async () => {
    render(<VRMDropZone onLoad={mockOnLoad} onError={mockOnError} />)

    const dropZone = screen.getByTestId('vrm-drop-zone')
    const glbFile = new File(['glb content'], 'model.glb', {
      type: 'model/gltf-binary',
    })

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [glbFile],
      },
    })

    await waitFor(() => {
      expect(mockOnLoad).toHaveBeenCalledWith(glbFile)
    })
  })

  it('should show loading state during file processing', () => {
    render(<VRMDropZone onLoad={mockOnLoad} loading />)

    expect(screen.getByTestId('vrm-drop-zone-loading')).toBeInTheDocument()
  })

  it('should display error for invalid files', async () => {
    render(<VRMDropZone onLoad={mockOnLoad} onError={mockOnError} />)

    const dropZone = screen.getByTestId('vrm-drop-zone')
    const invalidFile = new File([''], 'image.png', { type: 'image/png' })

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [invalidFile],
      },
    })

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalled()
    })
  })

  it('should support click to browse files', () => {
    render(<VRMDropZone onLoad={mockOnLoad} />)

    const input = screen.getByTestId('vrm-file-input')
    expect(input).toHaveAttribute('accept', '.vrm,.glb')
  })

  it('should handle file selection via input', async () => {
    render(<VRMDropZone onLoad={mockOnLoad} onError={mockOnError} />)

    const input = screen.getByTestId('vrm-file-input')
    const vrmFile = new File(['vrm content'], 'avatar.vrm', {
      type: 'model/gltf-binary',
    })

    Object.defineProperty(input, 'files', {
      value: [vrmFile],
    })

    fireEvent.change(input)

    await waitFor(() => {
      expect(mockOnLoad).toHaveBeenCalledWith(vrmFile)
    })
  })

  it('should only accept single file', async () => {
    render(<VRMDropZone onLoad={mockOnLoad} onError={mockOnError} />)

    const dropZone = screen.getByTestId('vrm-drop-zone')
    const file1 = new File(['vrm1'], 'avatar1.vrm', { type: 'model/gltf-binary' })
    const file2 = new File(['vrm2'], 'avatar2.vrm', { type: 'model/gltf-binary' })

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file1, file2],
      },
    })

    await waitFor(() => {
      // Should only load the first file
      expect(mockOnLoad).toHaveBeenCalledTimes(1)
      expect(mockOnLoad).toHaveBeenCalledWith(file1)
    })
  })

  it('should show progress indicator during load', () => {
    render(<VRMDropZone onLoad={mockOnLoad} loading progress={50} />)

    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '50')
  })

  it('should render children as drop zone content', () => {
    render(
      <VRMDropZone onLoad={mockOnLoad}>
        <span data-testid="custom-content">Drop your avatar here</span>
      </VRMDropZone>
    )

    expect(screen.getByTestId('custom-content')).toBeInTheDocument()
  })

  it('should be disabled when disabled prop is true', () => {
    render(<VRMDropZone onLoad={mockOnLoad} disabled />)

    const dropZone = screen.getByTestId('vrm-drop-zone')
    expect(dropZone).toHaveClass('vrm-drop-zone--disabled')
  })
})
