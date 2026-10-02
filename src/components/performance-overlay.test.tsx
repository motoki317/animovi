import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { PipelineProfiler } from '../lib/perf/pipeline-profiler'
import { PerformanceOverlay } from './performance-overlay'

vi.mock('../lib/perf/profiler-instances', () => ({
  trackingProfiler: new PipelineProfiler(5),
  renderProfiler: new PipelineProfiler(5),
}))

describe('PerformanceOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should not render when not visible', () => {
    const { container } = render(<PerformanceOverlay visible={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('should render header when visible', () => {
    render(<PerformanceOverlay visible={true} />)
    expect(screen.getByText('Performance')).toBeTruthy()
  })

  it('should show tracking and rendering sections', () => {
    render(<PerformanceOverlay visible={true} />)
    expect(screen.getByText('Tracking')).toBeTruthy()
    expect(screen.getByText('Rendering')).toBeTruthy()
  })

  it('should update display periodically', async () => {
    const { trackingProfiler } = await import('../lib/perf/profiler-instances')

    let mockTime = 0
    vi.spyOn(performance, 'now').mockImplementation(() => mockTime)

    trackingProfiler.begin('mediapipe')
    mockTime = 5
    trackingProfiler.end('mediapipe')

    render(<PerformanceOverlay visible={true} />)

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(screen.getByText(/mediapipe/)).toBeTruthy()
  })

  it('should show GPU info section', () => {
    render(
      <PerformanceOverlay
        visible={true}
        rendererInfo={{ drawCalls: 5, triangles: 1000, textures: 3 }}
      />
    )
    expect(screen.getByText('GPU')).toBeTruthy()
    expect(screen.getByText(/Draw calls: 5/)).toBeTruthy()
  })
})
