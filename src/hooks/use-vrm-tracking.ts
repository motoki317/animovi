/**
 * useVRMTracking - Integrated hook for VRM motion tracking
 * Combines MediaPipe detection, solving, and VRM animation in one hook.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { VRM } from '@pixiv/three-vrm'
import { MediaPipeTracker } from '../lib/mediapipe/tracker'
import { TrackingBridge } from '../lib/vrm/tracking-bridge'
import { solveHolistic, type HolisticResult } from '../lib/solver/holistic-solver'
import { isVideoReady, waitForVideoReady } from '../lib/capture/video-readiness'
import { useTrackingStore, type PipelineState } from '../stores/tracking-store'
import { trackingProfiler } from '../lib/perf/profiler-instances'

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
  /** Whether tracking is currently active (processing frames) */
  isTracking: boolean
  /** Whether MediaPipe is initializing */
  isInitializing: boolean
  /** Whether waiting for video element to become ready */
  isWaitingForVideo: boolean
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
  const [isWaitingForVideo, setIsWaitingForVideo] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const trackerRef = useRef<MediaPipeTracker | null>(null)
  const bridgeRef = useRef<TrackingBridge | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const isRunningRef = useRef(false)
  const lastFrameTimeRef = useRef(0)

  // Refs for latest settings values — avoids stale closures in async init()
  // when Zustand persist hydrates after the initial render but before bridge creation
  const smoothingRef = useRef(smoothing)
  const faceTrackingRef = useRef(faceTracking)
  const poseTrackingRef = useRef(poseTracking)
  const handTrackingRef = useRef(handTracking)
  smoothingRef.current = smoothing
  faceTrackingRef.current = faceTracking
  poseTrackingRef.current = poseTracking
  handTrackingRef.current = handTracking

  // Helper to emit debug data - reads debugEnabled fresh from store to avoid stale closure
  const emitDebugData = useCallback((
    pipelineState: PipelineState,
    mediaPipeResult: ReturnType<MediaPipeTracker['detectLandmarks']> | null,
    solved: HolisticResult | null,
    elapsed: number,
    timestamp: number,
    errorMsg: string | null
  ) => {
    // Read fresh from store to avoid stale closure issues
    const { debugEnabled, setDebugData } = useTrackingStore.getState()
    if (!debugEnabled) return

    // Extract raw pose landmarks for debugging IK
    const poseLandmarks = mediaPipeResult?.poseLandmarks?.[0]
    const rawPose = poseLandmarks ? {
      leftShoulder: poseLandmarks[11] ? { x: poseLandmarks[11].x, y: poseLandmarks[11].y, z: poseLandmarks[11].z } : undefined,
      rightShoulder: poseLandmarks[12] ? { x: poseLandmarks[12].x, y: poseLandmarks[12].y, z: poseLandmarks[12].z } : undefined,
      leftWrist: poseLandmarks[15] ? { x: poseLandmarks[15].x, y: poseLandmarks[15].y, z: poseLandmarks[15].z } : undefined,
      rightWrist: poseLandmarks[16] ? { x: poseLandmarks[16].x, y: poseLandmarks[16].y, z: poseLandmarks[16].z } : undefined,
    } : undefined

    setDebugData({
      pipelineState,
      detection: {
        hasFace: !!(mediaPipeResult?.faceLandmarks?.[0]?.length),
        hasPose: !!(mediaPipeResult?.poseLandmarks?.[0]?.length),
        hasLeftHand: !!(mediaPipeResult?.leftHandLandmarks?.[0]?.length),
        hasRightHand: !!(mediaPipeResult?.rightHandLandmarks?.[0]?.length),
        faceLandmarkCount: mediaPipeResult?.faceLandmarks?.[0]?.length ?? 0,
        poseLandmarkCount: mediaPipeResult?.poseLandmarks?.[0]?.length ?? 0,
      },
      rawPose,
      solved,
      performance: {
        fps: elapsed > 0 ? 1000 / elapsed : 0,
        frameTimeMs: elapsed,
      },
      lastUpdateTime: timestamp,
      error: errorMsg,
    })
  }, [])

  // Frame interval based on target FPS
  const frameInterval = 1000 / targetFps

  // Initialize MediaPipe tracker
  // This effect waits for video to be ready before starting tracking,
  // solving the race condition where tracking could start before video has data.
  useEffect(() => {
    // Emit diagnostic info about why tracking might not start
    if (!enabled) {
      emitDebugData('idle', null, null, 0, Date.now(), 'Tracking disabled')
      return
    }
    if (!vrm) {
      emitDebugData('idle', null, null, 0, Date.now(), 'No VRM loaded')
      return
    }
    if (!videoRef.current) {
      emitDebugData('idle', null, null, 0, Date.now(), 'No video element')
      return
    }

    const video = videoRef.current
    let cancelled = false

    async function init() {
      setIsInitializing(true)
      setIsWaitingForVideo(false)
      setError(null)
      emitDebugData('initializing', null, null, 0, Date.now(), 'Initializing MediaPipe...')

      try {
        // Create tracker (can initialize while waiting for video)
        const tracker = new MediaPipeTracker()
        await tracker.initialize()

        if (cancelled) {
          await tracker.dispose()
          return
        }

        trackerRef.current = tracker
        emitDebugData('initializing', null, null, 0, Date.now(), 'MediaPipe ready, creating bridge...')

        // Create bridge (vrm is guaranteed non-null here due to guard at start of effect)
        // Read from refs to get post-hydration values (Zustand persist may have
        // updated the store between initial render and this point in async init)
        bridgeRef.current = new TrackingBridge(vrm!, {
          smoothing: smoothingRef.current,
          faceTracking: faceTrackingRef.current,
          poseTracking: poseTrackingRef.current,
          handTracking: handTrackingRef.current,
        })

        setIsInitializing(false)

        // Wait for video to be ready before starting tracking loop
        if (!isVideoReady(video)) {
          setIsWaitingForVideo(true)
          emitDebugData('waiting-video', null, null, 0, Date.now(),
            `Video not ready: readyState=${video.readyState}, dimensions=${video.videoWidth}x${video.videoHeight}`)
          try {
            await waitForVideoReady(video, { timeout: 30000 })
          } catch (waitErr) {
            if (!cancelled) {
              const errMsg = waitErr instanceof Error ? waitErr.message : String(waitErr)
              setError(waitErr instanceof Error ? waitErr : new Error(String(waitErr)))
              setIsWaitingForVideo(false)
              emitDebugData('error', null, null, 0, Date.now(), `Video wait failed: ${errMsg}`)
            }
            return
          }
        }

        if (cancelled) return

        setIsWaitingForVideo(false)
        setIsTracking(true)
        isRunningRef.current = true
        emitDebugData('tracking', null, null, 0, Date.now(), 'Starting tracking loop...')

        // Start tracking loop
        startTrackingLoop()
      } catch (err) {
        if (!cancelled) {
          const errMsg = err instanceof Error ? err.message : String(err)
          setError(err instanceof Error ? err : new Error(String(err)))
          setIsInitializing(false)
          setIsWaitingForVideo(false)
          emitDebugData('error', null, null, 0, Date.now(), `Init failed: ${errMsg}`)
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
  // emitDebugData has stable reference (empty deps) so won't cause re-runs
  }, [enabled, vrm, stream, emitDebugData])

  // Update bridge options when settings change
  useEffect(() => {
    if (bridgeRef.current) {
      bridgeRef.current.setSmoothing(smoothing)
    }
  }, [smoothing])

  // Update tracking feature toggles when settings change
  useEffect(() => {
    if (bridgeRef.current) {
      bridgeRef.current.setOptions({
        faceTracking,
        poseTracking,
        handTracking,
      })
    }
  }, [faceTracking, poseTracking, handTracking])

  const startTrackingLoop = useCallback(() => {
    function loop(timestamp: number) {
      if (!isRunningRef.current) return

      // Throttle to target FPS
      const elapsed = timestamp - lastFrameTimeRef.current
      if (elapsed < frameInterval) {
        rafIdRef.current = requestAnimationFrame(loop)
        return
      }
      // Carry forward remainder to prevent drift and frame skipping
      lastFrameTimeRef.current = timestamp - (elapsed % frameInterval)

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
        trackingProfiler.markFrame()

        // Detect landmarks using MediaPipe
        trackingProfiler.begin('mediapipe')
        const mediaPipeResult = tracker.detectLandmarks(video, timestamp)
        trackingProfiler.end('mediapipe')

        if (mediaPipeResult) {
          // Convert MediaPipe result to our format and solve
          trackingProfiler.begin('solver')
          const result = solveHolistic({
            face: mediaPipeResult.faceLandmarks?.[0] ?? [],
            pose: mediaPipeResult.poseLandmarks?.[0] ?? [],
            leftHand: mediaPipeResult.leftHandLandmarks?.[0] ?? [],
            rightHand: mediaPipeResult.rightHandLandmarks?.[0] ?? [],
          })
          trackingProfiler.end('solver')

          // Apply to VRM
          trackingProfiler.begin('bridge')
          bridge.update(result)
          trackingProfiler.end('bridge')

          // Emit debug data
          emitDebugData('tracking', mediaPipeResult, result, elapsed, timestamp, null)
        } else {
          // No detection result
          emitDebugData('tracking', null, null, elapsed, timestamp, null)
        }
      } catch (err) {
        console.warn('Tracking frame error:', err)
        emitDebugData('error', null, null, elapsed, timestamp, err instanceof Error ? err.message : String(err))
      }

      rafIdRef.current = requestAnimationFrame(loop)
    }

    rafIdRef.current = requestAnimationFrame(loop)
  }, [frameInterval, videoRef, emitDebugData])

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
    setIsWaitingForVideo(false)
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
    isWaitingForVideo,
    error,
    start,
    stop,
  }
}
