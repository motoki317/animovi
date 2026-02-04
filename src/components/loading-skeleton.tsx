'use client'

/**
 * LoadingSkeleton - Visual loading state indicator.
 * Provides skeleton UI for different loading scenarios.
 */

import './loading-skeleton.css'

export type SkeletonType = 'vrm' | 'camera-permission' | 'generic'
export type SkeletonSize = 'small' | 'medium' | 'large'

export interface LoadingSkeletonProps {
  /** Type of loading skeleton to display */
  type?: SkeletonType
  /** Custom loading message */
  message?: string
  /** Size of the skeleton */
  size?: SkeletonSize
  /** Whether to display full-screen */
  fullScreen?: boolean
}

export function LoadingSkeleton({
  type = 'generic',
  message,
  size = 'medium',
  fullScreen = false,
}: LoadingSkeletonProps) {
  const classNames = [
    'loading-skeleton',
    'loading-skeleton--animated',
    `loading-skeleton--${type}`,
    `loading-skeleton--${size}`,
    fullScreen && 'loading-skeleton--fullscreen',
  ]
    .filter(Boolean)
    .join(' ')

  const defaultMessages: Record<SkeletonType, string> = {
    vrm: 'Loading avatar...',
    'camera-permission': 'Waiting for camera access...',
    generic: 'Loading...',
  }

  const displayMessage = message || defaultMessages[type]

  return (
    <div data-testid="loading-skeleton" className={classNames}>
      <div className="loading-skeleton__content">
        {type === 'vrm' && (
          <div className="loading-skeleton__avatar">
            <div className="loading-skeleton__avatar-head" />
            <div className="loading-skeleton__avatar-body" />
          </div>
        )}

        {type === 'camera-permission' && (
          <div className="loading-skeleton__camera">
            <span className="loading-skeleton__icon">📷</span>
            <p>Please allow camera access to use tracking</p>
          </div>
        )}

        <div className="loading-skeleton__spinner" />
        <span className="loading-skeleton__message">{displayMessage}</span>
      </div>
    </div>
  )
}
