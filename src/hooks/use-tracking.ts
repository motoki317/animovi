/**
 * useTracking - React hook for managing the tracking pipeline.
 * Connects camera feed to tracking worker and provides results.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { HolisticSolverResult } from '../lib/solver/holistic-solver'

export interface UseTrackingOptions {
  /** Ref to the video element providing camera feed */
  videoRef: React.RefObject<HTMLVideoElement | null>
  /** Whether tracking is enabled (default: true) */
  enabled?: boolean
  /** Smoothing factor 0-1 (default: 0.5) */
  smoothing?: number
  /** Target FPS for frame capture (default: 30) */
  targetFps?: number
  /** Enable face tracking (default: true) */
  faceTracking?: boolean
  /** Enable pose tracking (default: true) */
  poseTracking?: boolean
  /** Enable hand tracking (default: true) */
  handTracking?: boolean
}

export interface UseTrackingResult {
  /** Current tracking data or null */
  trackingData: HolisticSolverResult | null
  /** Whether tracking is active and receiving data */
  isTracking: boolean
  /** Any error that occurred */
  error: Error | null
  /** Manually start tracking */
  start: () => void
  /** Manually stop tracking */
  stop: () => void
}

type WorkerMessageType = 'setup' | 'config' | 'frame'
type WorkerResponseType = 'ready' | 'result' | 'error'

interface WorkerMessage {
  type: WorkerMessageType
  payload?: unknown
}

interface WorkerResponse {
  type: WorkerResponseType
  payload?: HolisticSolverResult | { message: string }
}

export function useTracking(options: UseTrackingOptions): UseTrackingResult {
  const {
    videoRef,
    enabled = true,
    smoothing = 0.5,
    targetFps = 30,
    faceTracking = true,
    poseTracking = true,
    handTracking = true,
  } = options

  const [trackingData, setTrackingData] = useState<HolisticSolverResult | null>(
    null
  )
  const [isTracking, setIsTracking] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const workerRef = useRef<Worker | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const isRunningRef = useRef(false)
  const lastConfigRef = useRef({ smoothing, faceTracking, poseTracking, handTracking })

  // Create worker and set up message handling
  useEffect(() => {
    // Create the worker
    // Note: In production, this would be a proper worker file
    const worker = new Worker(
      new URL('../lib/worker/tracking.worker.ts', import.meta.url),
      { type: 'module' }
    )

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { type, payload } = event.data

      switch (type) {
        case 'ready':
          setIsTracking(true)
          break
        case 'result':
          setTrackingData(payload as HolisticSolverResult)
          break
        case 'error':
          setError(new Error((payload as { message: string }).message))
          break
      }
    }

    worker.onerror = (event: ErrorEvent) => {
      setError(new Error(event.message || 'Worker error'))
      setIsTracking(false)
    }

    workerRef.current = worker

    // Send setup message
    const setupMessage: WorkerMessage = {
      type: 'setup',
      payload: {
        smoothing,
        faceTracking,
        poseTracking,
        handTracking,
      },
    }
    worker.postMessage(setupMessage)

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }
      worker.terminate()
      workerRef.current = null
    }
  }, []) // Only run once on mount

  // Send config updates when options change
  useEffect(() => {
    const config = { smoothing, faceTracking, poseTracking, handTracking }
    const lastConfig = lastConfigRef.current

    if (
      workerRef.current &&
      (config.smoothing !== lastConfig.smoothing ||
        config.faceTracking !== lastConfig.faceTracking ||
        config.poseTracking !== lastConfig.poseTracking ||
        config.handTracking !== lastConfig.handTracking)
    ) {
      const configMessage: WorkerMessage = {
        type: 'config',
        payload: config,
      }
      workerRef.current.postMessage(configMessage)
      lastConfigRef.current = config
    }
  }, [smoothing, faceTracking, poseTracking, handTracking])

  // Frame capture loop
  const frameLoop = useCallback(() => {
    if (!isRunningRef.current || !workerRef.current || !videoRef.current) {
      return
    }

    const video = videoRef.current

    // Only send frame if video is ready
    if (video.readyState >= 2 && video.videoWidth > 0) {
      // In a real implementation, we'd capture the frame and send to worker
      // For now, we just signal that we're processing
      const frameMessage: WorkerMessage = {
        type: 'frame',
        payload: {
          timestamp: performance.now(),
          width: video.videoWidth,
          height: video.videoHeight,
        },
      }
      workerRef.current.postMessage(frameMessage)
    }

    rafIdRef.current = requestAnimationFrame(frameLoop)
  }, [videoRef])

  // Start/stop tracking based on enabled state
  useEffect(() => {
    if (enabled && videoRef.current) {
      isRunningRef.current = true
      rafIdRef.current = requestAnimationFrame(frameLoop)
    } else {
      isRunningRef.current = false
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }

    return () => {
      isRunningRef.current = false
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [enabled, frameLoop, videoRef])

  const start = useCallback(() => {
    if (!isRunningRef.current) {
      isRunningRef.current = true
      rafIdRef.current = requestAnimationFrame(frameLoop)
    }
  }, [frameLoop])

  const stop = useCallback(() => {
    isRunningRef.current = false
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
  }, [])

  return {
    trackingData,
    isTracking,
    error,
    start,
    stop,
  }
}
