'use client'

/**
 * TrackingDebugOverlay - Transparent debug panel showing tracking pipeline data
 *
 * Shows real-time information about:
 * - Pipeline state (idle, initializing, tracking, error)
 * - MediaPipe detection results (face, pose, hands)
 * - Solved tracking values (head rotation, blinks, mouth)
 * - Performance metrics (FPS, frame time)
 */

import { useState, useCallback, memo } from 'react'
import { useTrackingStore } from '../stores/tracking-store'

const StatusIndicator = memo(function StatusIndicator({
  active,
  label,
  count,
}: {
  active: boolean
  label: string
  count?: number
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ color: active ? '#4ade80' : '#f87171' }}>
        {active ? '●' : '○'}
      </span>
      <span>{label}</span>
      {count !== undefined && (
        <span style={{ color: '#888', fontSize: '10px' }}>({count})</span>
      )}
    </div>
  )
})

const ValueDisplay = memo(function ValueDisplay({
  label,
  value,
  precision = 2,
}: {
  label: string
  value: number | undefined | null
  precision?: number
}) {
  const displayValue = value != null ? value.toFixed(precision) : '--'
  return (
    <span style={{ marginRight: '8px' }}>
      {label}:{displayValue}
    </span>
  )
})

export const TrackingDebugOverlay = memo(function TrackingDebugOverlay() {
  const [isMinimized, setIsMinimized] = useState(false)
  const debugData = useTrackingStore((s) => s.debugData)
  const debugEnabled = useTrackingStore((s) => s.debugEnabled)

  const toggleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev)
  }, [])

  if (!debugEnabled) return null

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    top: 10,
    left: 10,
    background: 'rgba(0, 0, 0, 0.8)',
    color: '#fff',
    fontFamily: 'ui-monospace, monospace',
    fontSize: '10px',
    padding: '8px 12px',
    borderRadius: '6px',
    minWidth: isMinimized ? '140px' : '300px',
    maxHeight: '90vh',
    overflowY: 'auto',
    zIndex: 9999,
    pointerEvents: 'auto',
    backdropFilter: 'blur(4px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    userSelect: 'none',
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isMinimized ? 0 : '8px',
    paddingBottom: isMinimized ? 0 : '6px',
    borderBottom: isMinimized ? 'none' : '1px solid rgba(255, 255, 255, 0.2)',
  }

  const sectionStyle: React.CSSProperties = {
    marginBottom: '8px',
    paddingBottom: '6px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  }

  const stateColors: Record<string, string> = {
    idle: '#888',
    initializing: '#facc15',
    'waiting-video': '#fb923c',
    tracking: '#4ade80',
    error: '#f87171',
  }

  const pipelineState = debugData?.pipelineState ?? 'idle'
  const stateColor = stateColors[pipelineState] ?? '#888'

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={{ fontWeight: 'bold' }}>Debug</span>
        <button
          onClick={toggleMinimize}
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            fontSize: '10px',
            padding: '2px 4px',
          }}
        >
          {isMinimized ? '▼' : '▲'}
        </button>
      </div>

      {isMinimized ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: stateColor }}>●</span>
          <span style={{ textTransform: 'capitalize' }}>{pipelineState}</span>
          {debugData?.performance && (
            <span style={{ color: '#888' }}>
              {debugData.performance.fps.toFixed(0)} fps
            </span>
          )}
        </div>
      ) : (
        <>
          {/* Pipeline Status */}
          <div style={sectionStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: stateColor }}>●</span>
              <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>
                {pipelineState}
              </span>
              {debugData?.performance && (
                <span style={{ color: '#888', marginLeft: 'auto' }}>
                  {debugData.performance.fps.toFixed(1)} fps |{' '}
                  {debugData.performance.frameTimeMs.toFixed(1)}ms
                </span>
              )}
            </div>
            {debugData?.error && (
              <div style={{ color: '#f87171', marginTop: '4px', fontSize: '10px' }}>
                {debugData.error}
              </div>
            )}
          </div>

          {/* Detection Status */}
          <div style={sectionStyle}>
            <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>
              MediaPipe Detection
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px' }}>
              <StatusIndicator
                active={debugData?.detection.hasFace ?? false}
                label="Face"
                count={debugData?.detection.faceLandmarkCount}
              />
              <StatusIndicator
                active={debugData?.detection.hasPose ?? false}
                label="Pose"
                count={debugData?.detection.poseLandmarkCount}
              />
              <StatusIndicator
                active={debugData?.detection.hasLeftHand ?? false}
                label="L.Hand"
              />
              <StatusIndicator
                active={debugData?.detection.hasRightHand ?? false}
                label="R.Hand"
              />
            </div>
          </div>

          {/* Solved Values - Face */}
          {debugData?.solved?.face && (
            <div style={sectionStyle}>
              <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>
                Face
              </div>

              {/* Head rotation */}
              <div style={{ marginBottom: '4px' }}>
                <span style={{ color: '#888' }}>Head: </span>
                <ValueDisplay label="P" value={debugData.solved.face.head?.pitch} />
                <ValueDisplay label="Y" value={debugData.solved.face.head?.yaw} />
                <ValueDisplay label="R" value={debugData.solved.face.head?.roll} />
              </div>

              {/* Eyes */}
              <div style={{ marginBottom: '4px' }}>
                <span style={{ color: '#888' }}>Eyes: </span>
                <ValueDisplay label="L" value={debugData.solved.face.eyes?.leftBlink} />
                <ValueDisplay label="R" value={debugData.solved.face.eyes?.rightBlink} />
              </div>

              {/* Mouth */}
              <div>
                <span style={{ color: '#888' }}>Mouth: </span>
                <ValueDisplay label="Open" value={debugData.solved.face.mouth?.open} />
                <ValueDisplay label="Smile" value={debugData.solved.face.mouth?.smile} />
              </div>
            </div>
          )}

          {/* Solved Values - Pose */}
          {debugData?.solved?.pose && (
            <div style={sectionStyle}>
              <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>
                Pose
              </div>

              {/* Spine */}
              <div style={{ marginBottom: '4px' }}>
                <span style={{ color: '#888' }}>Spine: </span>
                <ValueDisplay label="P" value={debugData.solved.pose.spine?.pitch} />
                <ValueDisplay label="Y" value={debugData.solved.pose.spine?.yaw} />
                <ValueDisplay label="R" value={debugData.solved.pose.spine?.roll} />
              </div>

              {/* Left Arm */}
              <div style={{ marginBottom: '4px' }}>
                <span style={{ color: '#888' }}>L.Arm: </span>
                <ValueDisplay label="X" value={debugData.solved.pose.leftArm?.shoulder?.x} />
                <ValueDisplay label="Y" value={debugData.solved.pose.leftArm?.shoulder?.y} />
                <ValueDisplay label="Z" value={debugData.solved.pose.leftArm?.shoulder?.z} />
              </div>
              <div style={{ marginBottom: '4px' }}>
                <span style={{ color: '#888' }}>L.Elb: </span>
                <ValueDisplay label="X" value={debugData.solved.pose.leftArm?.elbow?.x} />
              </div>

              {/* Right Arm */}
              <div style={{ marginBottom: '4px' }}>
                <span style={{ color: '#888' }}>R.Arm: </span>
                <ValueDisplay label="X" value={debugData.solved.pose.rightArm?.shoulder?.x} />
                <ValueDisplay label="Y" value={debugData.solved.pose.rightArm?.shoulder?.y} />
                <ValueDisplay label="Z" value={debugData.solved.pose.rightArm?.shoulder?.z} />
              </div>
              <div>
                <span style={{ color: '#888' }}>R.Elb: </span>
                <ValueDisplay label="X" value={debugData.solved.pose.rightArm?.elbow?.x} />
              </div>
            </div>
          )}

          {/* Raw Pose Landmarks (for debugging IK) */}
          {debugData?.rawPose && (
            <div style={sectionStyle}>
              <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>
                Raw Pose (MediaPipe)
              </div>
              <div style={{ marginBottom: '4px' }}>
                <span style={{ color: '#888' }}>L.Wrist: </span>
                <ValueDisplay label="X" value={debugData.rawPose.leftWrist?.x} precision={3} />
                <ValueDisplay label="Y" value={debugData.rawPose.leftWrist?.y} precision={3} />
                <ValueDisplay label="Z" value={debugData.rawPose.leftWrist?.z} precision={3} />
              </div>
              <div>
                <span style={{ color: '#888' }}>R.Wrist: </span>
                <ValueDisplay label="X" value={debugData.rawPose.rightWrist?.x} precision={3} />
                <ValueDisplay label="Y" value={debugData.rawPose.rightWrist?.y} precision={3} />
                <ValueDisplay label="Z" value={debugData.rawPose.rightWrist?.z} precision={3} />
              </div>
            </div>
          )}

          {/* Solved Values - Hands */}
          {(debugData?.solved?.leftHand || debugData?.solved?.rightHand) && (
            <div>
              <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>
                Hands
              </div>

              {debugData.solved.leftHand && (
                <div style={{ marginBottom: '4px' }}>
                  <span style={{ color: '#888' }}>L: </span>
                  <ValueDisplay label="Th" value={debugData.solved.leftHand.thumb?.curl} precision={1} />
                  <ValueDisplay label="Ix" value={debugData.solved.leftHand.index?.curl} precision={1} />
                  <ValueDisplay label="Mi" value={debugData.solved.leftHand.middle?.curl} precision={1} />
                </div>
              )}

              {debugData.solved.rightHand && (
                <div>
                  <span style={{ color: '#888' }}>R: </span>
                  <ValueDisplay label="Th" value={debugData.solved.rightHand.thumb?.curl} precision={1} />
                  <ValueDisplay label="Ix" value={debugData.solved.rightHand.index?.curl} precision={1} />
                  <ValueDisplay label="Mi" value={debugData.solved.rightHand.middle?.curl} precision={1} />
                </div>
              )}
            </div>
          )}

          {!debugData?.solved && pipelineState === 'tracking' && (
            <div style={{ color: '#f87171', fontSize: '10px' }}>
              No tracking data - check camera and face visibility
            </div>
          )}
        </>
      )}
    </div>
  )
})
