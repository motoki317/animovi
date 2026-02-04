'use client'

/**
 * VRMDropZone - Drag and drop component for VRM file loading.
 * Provides visual feedback and file validation.
 */

import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react'
import './vrm-drop-zone.css'

const VALID_EXTENSIONS = ['.vrm', '.glb']

export interface VRMDropZoneProps {
  /** Callback when a valid VRM file is dropped/selected */
  onLoad: (file: File) => void
  /** Callback when an error occurs */
  onError?: (error: Error) => void
  /** Whether loading is in progress */
  loading?: boolean
  /** Loading progress 0-100 */
  progress?: number
  /** Whether the drop zone is disabled */
  disabled?: boolean
  /** Custom content for the drop zone */
  children?: React.ReactNode
}

export function VRMDropZone({
  onLoad,
  onError,
  loading = false,
  progress,
  disabled = false,
  children,
}: VRMDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateFile = useCallback(
    (file: File): boolean => {
      const fileName = file.name.toLowerCase()
      const isValid = VALID_EXTENSIONS.some((ext) => fileName.endsWith(ext))

      if (!isValid) {
        onError?.(
          new Error(
            `Invalid file type. Please upload a .vrm or .glb file. Got: ${file.name}`
          )
        )
        return false
      }

      return true
    },
    [onError]
  )

  const handleFile = useCallback(
    (file: File) => {
      if (disabled) return
      if (!validateFile(file)) return
      onLoad(file)
    },
    [onLoad, validateFile, disabled]
  )

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = e.dataTransfer?.files
      if (files && files.length > 0) {
        // Only process the first file
        handleFile(files[0])
      }
    },
    [handleFile]
  )

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        handleFile(files[0])
      }
    },
    [handleFile]
  )

  const handleClick = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click()
    }
  }, [disabled])

  const classNames = [
    'vrm-drop-zone',
    isDragging && 'vrm-drop-zone--dragging',
    loading && 'vrm-drop-zone--loading',
    disabled && 'vrm-drop-zone--disabled',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      data-testid="vrm-drop-zone"
      className={classNames}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={inputRef}
        data-testid="vrm-file-input"
        type="file"
        accept=".vrm,.glb"
        onChange={handleInputChange}
        className="vrm-drop-zone__input"
      />

      {loading && (
        <div data-testid="vrm-drop-zone-loading" className="vrm-drop-zone__loading">
          {progress !== undefined && (
            <div
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              className="vrm-drop-zone__progress"
            >
              <div
                className="vrm-drop-zone__progress-bar"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          <span>Loading...</span>
        </div>
      )}

      {children || (
        <div className="vrm-drop-zone__content">
          <span className="vrm-drop-zone__icon">📦</span>
          <span className="vrm-drop-zone__text">
            Drop VRM file here or click to browse
          </span>
          <span className="vrm-drop-zone__hint">Supports .vrm and .glb files</span>
        </div>
      )}
    </div>
  )
}
