'use client'

/**
 * PerformanceOverlay - Real-time performance profiling display.
 * Toggle with P key. Shows per-stage timing breakdown for tracking and rendering.
 */

import { useState, useEffect, memo } from 'react'
import { trackingProfiler, renderProfiler } from '../lib/perf/profiler-instances'
import type { StageTimings } from '../lib/perf/pipeline-profiler'

export interface RendererInfo {
  drawCalls: number
  triangles: number
  textures: number
}

interface PerformanceOverlayProps {
  visible: boolean
  rendererInfo?: RendererInfo | null
}

interface SnapshotData {
  trackingTimings: StageTimings
  renderTimings: StageTimings
  trackingFps: number
  renderFps: number
  trackingTotal: number
  renderTotal: number
}

const POLL_INTERVAL = 250 // ms

export const PerformanceOverlay = memo(function PerformanceOverlay({
  visible,
  rendererInfo,
}: PerformanceOverlayProps) {
  const [data, setData] = useState<SnapshotData | null>(null)

  useEffect(() => {
    if (!visible) return

    const interval = setInterval(() => {
      setData({
        trackingTimings: trackingProfiler.getTimings(),
        renderTimings: renderProfiler.getTimings(),
        trackingFps: trackingProfiler.getFps(),
        renderFps: renderProfiler.getFps(),
        trackingTotal: trackingProfiler.getTotalMs(),
        renderTotal: renderProfiler.getTotalMs(),
      })
    }, POLL_INTERVAL)

    // Immediate first read
    setData({
      trackingTimings: trackingProfiler.getTimings(),
      renderTimings: renderProfiler.getTimings(),
      trackingFps: trackingProfiler.getFps(),
      renderFps: renderProfiler.getFps(),
      trackingTotal: trackingProfiler.getTotalMs(),
      renderTotal: renderProfiler.getTotalMs(),
    })

    return () => clearInterval(interval)
  }, [visible])

  if (!visible) return null

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 10,
    right: 10,
    background: 'rgba(0, 0, 0, 0.85)',
    color: '#fff',
    fontFamily: 'ui-monospace, monospace',
    fontSize: '10px',
    padding: '8px 12px',
    borderRadius: '6px',
    minWidth: '220px',
    zIndex: 9999,
    pointerEvents: 'none',
    backdropFilter: 'blur(4px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    lineHeight: 1.5,
  }

  const sectionStyle: React.CSSProperties = {
    marginBottom: '6px',
    paddingBottom: '4px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  }

  const labelStyle: React.CSSProperties = {
    color: '#888',
    fontSize: '10px',
    marginBottom: '2px',
    fontWeight: 600,
  }

  return (
    <div style={containerStyle}>
      <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#facc15' }}>
        Performance
      </div>

      {/* Tracking section */}
      <div style={sectionStyle}>
        <div style={labelStyle}>
          Tracking{' '}
          <span style={{ color: '#4ade80' }}>
            {data?.trackingFps.toFixed(0) ?? '--'} fps
          </span>
          {data && (
            <span style={{ color: '#888', marginLeft: '8px' }}>
              {data.trackingTotal.toFixed(1)}ms
            </span>
          )}
        </div>
        {data && <StageList timings={data.trackingTimings} />}
      </div>

      {/* Rendering section */}
      <div style={sectionStyle}>
        <div style={labelStyle}>
          Rendering{' '}
          <span style={{ color: '#4ade80' }}>
            {data?.renderFps.toFixed(0) ?? '--'} fps
          </span>
          {data && (
            <span style={{ color: '#888', marginLeft: '8px' }}>
              {data.renderTotal.toFixed(1)}ms
            </span>
          )}
        </div>
        {data && <StageList timings={data.renderTimings} />}
      </div>

      {/* GPU info */}
      {rendererInfo && (
        <div>
          <div style={labelStyle}>GPU</div>
          <div>Draw calls: {rendererInfo.drawCalls}</div>
          <div>Triangles: {rendererInfo.triangles}</div>
          <div>Textures: {rendererInfo.textures}</div>
        </div>
      )}
    </div>
  )
})

function StageList({ timings }: { timings: StageTimings }) {
  const entries = Object.entries(timings)
  if (entries.length === 0) {
    return <div style={{ color: '#666' }}>No data</div>
  }

  return (
    <>
      {entries.map(([name, timing]) => (
        <div key={name} style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#aaa' }}>{name}</span>
          <span>
            <span style={{ color: '#fff' }}>{timing.avgMs.toFixed(1)}ms</span>
            <span style={{ color: '#666', marginLeft: '4px' }}>
              (max {timing.maxMs.toFixed(1)})
            </span>
          </span>
        </div>
      ))}
    </>
  )
}
