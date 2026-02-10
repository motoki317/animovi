/**
 * useVRMTracking - Integrated hook for VRM motion tracking.
 *
 * Runs MediaPipe inference in a Web Worker (off main thread) by default.
 * Falls back to main-thread processing if the worker fails to initialize.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { VRM } from '@pixiv/three-vrm'
import { MediaPipeTracker, type TrackerResult } from '../lib/mediapipe/tracker'
import { TrackingBridge } from '../lib/vrm/tracking-bridge'
import { solveHolistic, type HolisticResult } from '../lib/solver/holistic-solver'
import { isVideoReady, waitForVideoReady } from '../lib/capture/video-readiness'
import { useTrackingStore, type PipelineState } from '../stores/tracking-store'
import { trackingProfiler } from '../lib/perf/profiler-instances'
import type { WorkerOutMessage } from '../lib/worker/protocol'

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

  // Main-thread fallback tracker (only used if worker fails)
  const trackerRef = useRef<MediaPipeTracker | null>(null)
  const bridgeRef = useRef<TrackingBridge | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const isRunningRef = useRef(false)
  const lastFrameTimeRef = useRef(0)

  // Worker mode refs
  const workerRef = useRef<Worker | null>(null)
  const workerBusyRef = useRef(false)
  const useWorkerRef = useRef(false)

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
    mediaPipeResult: TrackerResult | null,
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

  // Simplified debug emit for worker mode (no raw landmarks available)
  const emitWorkerDebugData = useCallback((
    pipelineState: PipelineState,
    solved: HolisticResult | null,
    detection: { hasFace: boolean; hasPose: boolean; hasLeftHand: boolean; hasRightHand: boolean; faceLandmarkCount: number; poseLandmarkCount: number } | null,
    elapsed: number,
    timestamp: number,
    errorMsg: string | null
  ) => {
    const { debugEnabled, setDebugData } = useTrackingStore.getState()
    if (!debugEnabled) return

    setDebugData({
      pipelineState,
      detection: detection ?? {
        hasFace: false, hasPose: false, hasLeftHand: false, hasRightHand: false,
        faceLandmarkCount: 0, poseLandmarkCount: 0,
      },
      rawPose: undefined,
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

  // Initialize MediaPipe (worker mode with main-thread fallback)
  useEffect(() => {
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

    async function initWorker(): Promise<boolean> {
      try {
        const worker = new Worker(
          new URL('../lib/worker/tracking.worker.ts', import.meta.url),
          { type: 'module' }
        )

        return await new Promise<boolean>((resolve) => {
          const timeout = setTimeout(() => {
            worker.terminate()
            resolve(false)
          }, 15000)

          worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
            if (e.data.type === 'ready') {
              clearTimeout(timeout)
              workerRef.current = worker
              console.log(`[perf] MediaPipe worker mode: ${e.data.mode}`)
              resolve(true)
            } else if (e.data.type === 'error') {
              clearTimeout(timeout)
              console.warn('[perf] Worker init failed, falling back to main thread:', e.data.message)
              worker.terminate()
              resolve(false)
            }
          }

          worker.onerror = () => {
            clearTimeout(timeout)
            worker.terminate()
            resolve(false)
          }

          worker.postMessage({
            type: 'init',
            needsPose: poseTracking,
            needsHands: handTracking,
          })
        })
      } catch {
        return false
      }
    }

    async function initDirect(): Promise<void> {
      const tracker = new MediaPipeTracker({
        needsPose: poseTracking,
        needsHands: handTracking,
      })
      await tracker.initialize()

      if (cancelled) {
        await tracker.dispose()
        return
      }

      trackerRef.current = tracker
      console.log(`[perf] MediaPipe main-thread mode: ${tracker.mode}`)
    }

    async function init() {
      setIsInitializing(true)
      setIsWaitingForVideo(false)
      setError(null)
      emitDebugData('initializing', null, null, 0, Date.now(), 'Initializing MediaPipe...')

      try {
        // Try worker mode first, fall back to main thread
        const workerOk = await initWorker()
        if (cancelled) return

        if (workerOk) {
          useWorkerRef.current = true
        } else {
          useWorkerRef.current = false
          await initDirect()
          if (cancelled) return
        }

        emitDebugData('initializing', null, null, 0, Date.now(),
          `MediaPipe ready (${useWorkerRef.current ? 'worker' : 'main-thread'}), creating bridge...`)

        // Create bridge
        bridgeRef.current = new TrackingBridge(vrm!, {
          smoothing: smoothingRef.current,
          faceTracking: faceTrackingRef.current,
          poseTracking: poseTrackingRef.current,
          handTracking: handTrackingRef.current,
        })

        setIsInitializing(false)

        // Wait for video to be ready
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

        // Wire up worker message handler for receiving results
        if (useWorkerRef.current && workerRef.current) {
          const bridge = bridgeRef.current!
          workerRef.current.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
            if (e.data.type === 'result') {
              trackingProfiler.end('mediapipe')
              trackingProfiler.begin('bridge')
              bridge.update(e.data.data)
              trackingProfiler.end('bridge')
              emitWorkerDebugData('tracking', e.data.data, e.data.detection, 0, Date.now(), null)
              workerBusyRef.current = false
            } else if (e.data.type === 'error') {
              console.warn('Worker frame error:', e.data.message)
              workerBusyRef.current = false
            }
          }
        }

        setIsWaitingForVideo(false)
        setIsTracking(true)
        isRunningRef.current = true
        emitDebugData('tracking', null, null, 0, Date.now(), 'Starting tracking loop...')

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
  // poseTracking/handTracking trigger re-init to switch between FaceLandmarker and HolisticLandmarker
  }, [enabled, vrm, stream, poseTracking, handTracking, emitDebugData, emitWorkerDebugData])

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
      lastFrameTimeRef.current = timestamp - (elapsed % frameInterval)

      const video = videoRef.current
      const bridge = bridgeRef.current

      if (!video || !bridge) {
        rafIdRef.current = requestAnimationFrame(loop)
        return
      }

      if (video.readyState < 2 || video.videoWidth === 0) {
        rafIdRef.current = requestAnimationFrame(loop)
        return
      }

      // === Worker mode: capture bitmap, transfer to worker ===
      if (useWorkerRef.current && workerRef.current) {
        // Backpressure: skip frame if worker is still processing
        if (workerBusyRef.current) {
          rafIdRef.current = requestAnimationFrame(loop)
          return
        }

        trackingProfiler.markFrame()
        trackingProfiler.begin('mediapipe')
        workerBusyRef.current = true

        createImageBitmap(video).then((bitmap) => {
          if (workerRef.current && isRunningRef.current) {
            workerRef.current.postMessage(
              { type: 'frame', bitmap, timestamp },
              [bitmap] // Transfer ownership (zero-copy)
            )
          } else {
            bitmap.close()
            workerBusyRef.current = false
          }
        }).catch(() => {
          workerBusyRef.current = false
        })

        rafIdRef.current = requestAnimationFrame(loop)
        return
      }

      // === Main-thread fallback mode ===
      const tracker = trackerRef.current
      if (!tracker) {
        rafIdRef.current = requestAnimationFrame(loop)
        return
      }

      try {
        trackingProfiler.markFrame()

        trackingProfiler.begin('mediapipe')
        const mediaPipeResult = tracker.detectLandmarks(video, timestamp)
        trackingProfiler.end('mediapipe')

        if (mediaPipeResult) {
          trackingProfiler.begin('solver')
          const result = solveHolistic({
            face: mediaPipeResult.faceLandmarks?.[0] ?? [],
            pose: mediaPipeResult.poseLandmarks?.[0] ?? [],
            leftHand: mediaPipeResult.leftHandLandmarks?.[0] ?? [],
            rightHand: mediaPipeResult.rightHandLandmarks?.[0] ?? [],
          })
          trackingProfiler.end('solver')

          trackingProfiler.begin('bridge')
          bridge.update(result)
          trackingProfiler.end('bridge')

          emitDebugData('tracking', mediaPipeResult, result, elapsed, timestamp, null)
        } else {
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

    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
      useWorkerRef.current = false
      workerBusyRef.current = false
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
    if (!isRunningRef.current) {
      const ready = useWorkerRef.current
        ? workerRef.current !== null
        : trackerRef.current?.isReady()
      if (ready) {
        isRunningRef.current = true
        setIsTracking(true)
        startTrackingLoop()
      }
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
