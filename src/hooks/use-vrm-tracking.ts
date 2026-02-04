/**
 * useVRMTracking - Integrated hook for VRM motion tracking
 * Combines MediaPipe detection, solving, and VRM animation in one hook.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { VRM } from '@pixiv/three-vrm'
import { MediaPipeTracker } from '../lib/mediapipe/tracker'
import { TrackingBridge } from '../lib/vrm/tracking-bridge'
import { solveHolistic, type HolisticResult } from '../lib/solver/holistic-solver'

export interface UseVRMTrackingOptions {
  /** The VRM model to animate */
  vrm: VRM | null
  /** Ref to the video element providing camera feed */
  videoRef: React.RefObject<HTMLVideoElement | null>
  /** The camera MediaStream (used to trigger re-initialization when stream becomes available) */
  stream?: MediaStream | null
  /** Whether tracking is enabled (default: true) */
  enabled?: boolean
  /** Smoothing factor 0-1 (default: 0.5) */
  smoothing?: number
  /** Target FPS for tracking (default: 30) */
  targetFps?: number
  /** Enable face tracking (default: true) */
  faceTracking?: boolean
  /** Enable pose tracking (default: true) */
  poseTracking?: boolean
  /** Enable hand tracking (default: true) */
  handTracking?: boolean
}

export interface UseVRMTrackingResult {
  /** Whether tracking is currently active */
  isTracking: boolean
  /** Whether MediaPipe is initializing */
  isInitializing: boolean
  /** Any error that occurred */
  error: Error | null
  /** Manually start tracking */
  start: () => void
  /** Manually stop tracking */
  stop: () => void
}

export function useVRMTracking(options: UseVRMTrackingOptions): UseVRMTrackingResult {
  const {
    vrm,
    videoRef,
    stream,
    enabled = true,
    smoothing = 0.5,
    targetFps = 30,
    faceTracking = true,
    poseTracking = true,
    handTracking = true,
  } = options

  const [isTracking, setIsTracking] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const trackerRef = useRef<MediaPipeTracker | null>(null)
  const bridgeRef = useRef<TrackingBridge | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const isRunningRef = useRef(false)
  const lastFrameTimeRef = useRef(0)

  // Frame interval based on target FPS
  const frameInterval = 1000 / targetFps

  // Initialize MediaPipe tracker
  // Note: We check videoRef.current directly in the effect body, and the effect
  // re-runs when enabled or vrm change. For video availability, we rely on the
  // parent component to trigger a re-render when the video becomes available.
  useEffect(() => {
    if (!enabled || !vrm || !videoRef.current) {
      return
    }

    let cancelled = false

    async function init() {
      setIsInitializing(true)
      setError(null)

      try {
        // Create tracker
        const tracker = new MediaPipeTracker()
        await tracker.initialize()

        if (cancelled) {
          await tracker.dispose()
          return
        }

        trackerRef.current = tracker

        // Create bridge (vrm is guaranteed non-null here due to guard at start of effect)
        bridgeRef.current = new TrackingBridge(vrm!, {
          smoothing,
          faceTracking,
          poseTracking,
          handTracking,
        })

        setIsInitializing(false)
        setIsTracking(true)
        isRunningRef.current = true

        // Start tracking loop
        startTrackingLoop()
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
          setIsInitializing(false)
        }
      }
    }

    init()

    return () => {
      cancelled = true
      cleanup()
    }
  // Note: stream is used as a trigger to re-run when camera becomes available
  // videoRef.current is checked in effect body
  }, [enabled, vrm, stream])

  // Update bridge options when settings change
  useEffect(() => {
    if (bridgeRef.current) {
      bridgeRef.current.setSmoothing(smoothing)
    }
  }, [smoothing])

  const startTrackingLoop = useCallback(() => {
    function loop(timestamp: number) {
      if (!isRunningRef.current) return

      // Throttle to target FPS
      const elapsed = timestamp - lastFrameTimeRef.current
      if (elapsed < frameInterval) {
        rafIdRef.current = requestAnimationFrame(loop)
        return
      }
      lastFrameTimeRef.current = timestamp

      const video = videoRef.current
      const tracker = trackerRef.current
      const bridge = bridgeRef.current

      if (!video || !tracker || !bridge) {
        rafIdRef.current = requestAnimationFrame(loop)
        return
      }

      // Check if video is ready
      if (video.readyState < 2 || video.videoWidth === 0) {
        rafIdRef.current = requestAnimationFrame(loop)
        return
      }

      try {
        // Detect landmarks using MediaPipe
        const mediaPipeResult = tracker.detectLandmarks(video, timestamp)

        if (mediaPipeResult) {
          // Convert MediaPipe result to our format and solve
          const result = solveHolistic({
            face: mediaPipeResult.faceLandmarks?.[0] ?? [],
            pose: mediaPipeResult.poseLandmarks?.[0] ?? [],
            leftHand: mediaPipeResult.leftHandLandmarks?.[0] ?? [],
            rightHand: mediaPipeResult.rightHandLandmarks?.[0] ?? [],
          })

          // Apply to VRM
          bridge.update(result)
        }
      } catch (err) {
        console.warn('Tracking frame error:', err)
      }

      rafIdRef.current = requestAnimationFrame(loop)
    }

    rafIdRef.current = requestAnimationFrame(loop)
  }, [frameInterval, videoRef])

  const cleanup = useCallback(() => {
    isRunningRef.current = false

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }

    if (bridgeRef.current) {
      bridgeRef.current.dispose()
      bridgeRef.current = null
    }

    if (trackerRef.current) {
      trackerRef.current.dispose()
      trackerRef.current = null
    }

    setIsTracking(false)
  }, [])

  const start = useCallback(() => {
    if (!isRunningRef.current && trackerRef.current?.isReady()) {
      isRunningRef.current = true
      setIsTracking(true)
      startTrackingLoop()
    }
  }, [startTrackingLoop])

  const stop = useCallback(() => {
    isRunningRef.current = false
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    setIsTracking(false)
  }, [])

  return {
    isTracking,
    isInitializing,
    error,
    start,
    stop,
  }
}
