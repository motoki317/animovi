'use client'

/**
 * BackgroundSettings - Controls for avatar scene background.
 * Supports solid color, transparent (for OBS), and image backgrounds.
 */

import { type ChangeEvent } from 'react'
import './background-settings.css'

export type BackgroundType = 'solid' | 'transparent' | 'image'

export interface BackgroundConfig {
  type: BackgroundType
  color?: string
  imageUrl?: string
  imageFile?: File
}

export interface BackgroundSettingsProps {
  /** Current background type */
  type: BackgroundType
  /** Color for solid background */
  color?: string
  /** URL for image background */
  imageUrl?: string
  /** Callback when settings change */
  onChange: (config: BackgroundConfig) => void
  /** Whether to show preset colors */
  showPresets?: boolean
}

const PRESET_COLORS = [
  { name: 'White', color: '#ffffff' },
  { name: 'Black', color: '#000000' },
  { name: 'Green', color: '#00ff00' },
  { name: 'Blue', color: '#0000ff' },
  { name: 'Red', color: '#ff0000' },
  { name: 'Gray', color: '#808080' },
]

export function BackgroundSettings({
  type,
  color = '#ffffff',
  imageUrl,
  onChange,
  showPresets = false,
}: BackgroundSettingsProps) {
  const handleTypeChange = (newType: BackgroundType) => {
    onChange({
      type: newType,
      color: newType === 'solid' ? color : undefined,
      imageUrl: newType === 'image' ? imageUrl : undefined,
    })
  }

  const handleColorChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({
      type: 'solid',
      color: e.target.value,
    })
  }

  const handlePresetClick = (presetColor: string) => {
    onChange({
      type: 'solid',
      color: presetColor,
    })
  }

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onChange({
        type: 'image',
        imageFile: file,
      })
    }
  }

  return (
    <div className="background-settings">
      <fieldset className="background-settings__types">
        <legend className="background-settings__legend">Background Type</legend>

        <label className="background-settings__option">
          <input
            type="radio"
            name="bg-type"
            value="solid"
            checked={type === 'solid'}
            onChange={() => handleTypeChange('solid')}
          />
          Solid Color
        </label>

        <label className="background-settings__option">
          <input
            type="radio"
            name="bg-type"
            value="transparent"
            checked={type === 'transparent'}
            onChange={() => handleTypeChange('transparent')}
          />
          Transparent (OBS)
        </label>

        <label className="background-settings__option">
          <input
            type="radio"
            name="bg-type"
            value="image"
            checked={type === 'image'}
            onChange={() => handleTypeChange('image')}
          />
          Image
        </label>
      </fieldset>

      {type === 'solid' && (
        <div className="background-settings__color-section">
          <label className="background-settings__color-label">
            Color
            <input
              type="color"
              data-testid="color-input"
              value={color}
              onChange={handleColorChange}
              className="background-settings__color-input"
            />
          </label>

          {showPresets && (
            <div
              data-testid="color-presets"
              className="background-settings__presets"
            >
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  aria-label={preset.name}
                  className="background-settings__preset"
                  style={{ backgroundColor: preset.color }}
                  onClick={() => handlePresetClick(preset.color)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {type === 'image' && (
        <div className="background-settings__image-section">
          <label className="background-settings__image-label">
            Upload Background Image
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="background-settings__image-input"
            />
          </label>
          {imageUrl && (
            <div
              className="background-settings__preview"
              style={{ backgroundImage: `url(${imageUrl})` }}
            />
          )}
        </div>
      )}
    </div>
  )
}
