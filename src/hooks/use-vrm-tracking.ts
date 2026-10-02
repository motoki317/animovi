/**
 * Runs MediaPipe and the solver in a Web Worker, and applies the result to the
 * VRM on the main thread. If the worker fails, MediaPipe and the solver run on
 * the main thread.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { VRM } from '@pixiv/three-vrm'
import { MediaPipeTracker, type TrackerResult } from '../lib/mediapipe/tracker'
import { TrackingBridge } from '../lib/vrm/tracking-bridge'
import { solveHolistic, type HolisticResult } from '../lib/solver/holistic-solver'
import { isVideoReady, waitForVideoReady } from '../lib/capture/video-readiness'
import { useTrackingStore, type PipelineState } from '../stores/tracking-store'
import { trackingProfiler } from '../lib/perf/profiler-instances'
import type { WorkerOutMessage, RawLandmarks } from '../lib/worker/protocol'

export interface UseVRMTrackingOptions {
  vrm: VRM | null
  videoRef: React.RefObject<HTMLVideoElement | null>
  /** Only a dependency: a new stream restarts tracking. */
  stream?: MediaStream | null
  /** Default: true. */
  enabled?: boolean
  /** 0 to 1. Default: 0.5. */
  smoothing?: number
  /** Default: 30. */
  targetFps?: number
  /** Default: true. */
  faceTracking?: boolean
  /** Default: true. A change restarts MediaPipe. */
  poseTracking?: boolean
  /** Default: true. A change restarts MediaPipe. */
  handTracking?: boolean
}

export interface UseVRMTrackingResult {
  isTracking: boolean
  isInitializing: boolean
  isWaitingForVideo: boolean
  error: Error | null
  /** Restarts the frame loop after stop(). Does nothing before init finishes. */
  start: () => void
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

  const workerRef = useRef<Worker | null>(null)
  const workerBusyRef = useRef(false)
  const useWorkerRef = useRef(false)

  // init() creates the bridge after an await, and the settings effects below
  // skip while bridgeRef is null. A change during init reaches the bridge only
  // through these refs. The frame loop also reads its interval from a ref, so
  // a new targetFps applies without a restart.
  const smoothingRef = useRef(smoothing)
  const faceTrackingRef = useRef(faceTracking)
  const poseTrackingRef = useRef(poseTracking)
  const handTrackingRef = useRef(handTracking)
  const frameIntervalRef = useRef(1000 / targetFps)
  smoothingRef.current = smoothing
  faceTrackingRef.current = faceTracking
  poseTrackingRef.current = poseTracking
  handTrackingRef.current = handTracking
  frameIntervalRef.current = 1000 / targetFps

  // Reads the debug toggles from the store at call time, so the callback stays stable.
  const emitDebugData = useCallback((
    pipelineState: PipelineState,
    mediaPipeResult: TrackerResult | null,
    solved: HolisticResult | null,
    elapsed: number,
    timestamp: number,
    errorMsg: string | null
  ) => {
    const { debugEnabled, stickFigureEnabled, setDebugData } = useTrackingStore.getState()
    if (!debugEnabled && !stickFigureEnabled) return

    const poseLandmarks = mediaPipeResult?.poseLandmarks?.[0]
    const rawPose = poseLandmarks ? {
      leftShoulder: poseLandmarks[11] ? { x: poseLandmarks[11].x, y: poseLandmarks[11].y, z: poseLandmarks[11].z } : undefined,
      rightShoulder: poseLandmarks[12] ? { x: poseLandmarks[12].x, y: poseLandmarks[12].y, z: poseLandmarks[12].z } : undefined,
      leftWrist: poseLandmarks[15] ? { x: poseLandmarks[15].x, y: poseLandmarks[15].y, z: poseLandmarks[15].z } : undefined,
      rightWrist: poseLandmarks[16] ? { x: poseLandmarks[16].x, y: poseLandmarks[16].y, z: poseLandmarks[16].z } : undefined,
    } : undefined

    // Only the stick-figure overlay uses the full landmark sets and the applied rotations.
    let rawLandmarks: RawLandmarks | undefined
    if (stickFigureEnabled && mediaPipeResult) {
      rawLandmarks = {}
      if (mediaPipeResult.poseLandmarks?.[0]?.length) rawLandmarks.pose = mediaPipeResult.poseLandmarks[0]
      if (mediaPipeResult.leftHandLandmarks?.[0]?.length) rawLandmarks.leftHand = mediaPipeResult.leftHandLandmarks[0]
      if (mediaPipeResult.rightHandLandmarks?.[0]?.length) rawLandmarks.rightHand = mediaPipeResult.rightHandLandmarks[0]
      if (mediaPipeResult.faceLandmarks?.[0]?.length) rawLandmarks.face = mediaPipeResult.faceLandmarks[0]
    }
    const appliedRotations = stickFigureEnabled
      ? bridgeRef.current?.getAppliedRotations()
      : undefined

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
      rawLandmarks,
      appliedRotations,
      solved,
      performance: {
        fps: elapsed > 0 ? 1000 / elapsed : 0,
        frameTimeMs: elapsed,
      },
      lastUpdateTime: timestamp,
      error: errorMsg,
    })
  }, [])

  // Worker mode has no MediaPipe result on the main thread. The worker sends
  // the detection summary and the raw landmarks with every result.
  const emitWorkerDebugData = useCallback((
    pipelineState: PipelineState,
    solved: HolisticResult | null,
    detection: { hasFace: boolean; hasPose: boolean; hasLeftHand: boolean; hasRightHand: boolean; faceLandmarkCount: number; poseLandmarkCount: number } | null,
    elapsed: number,
    timestamp: number,
    errorMsg: string | null,
    rawLandmarks?: RawLandmarks,
  ) => {
    const { debugEnabled, stickFigureEnabled, setDebugData } = useTrackingStore.getState()
    if (!debugEnabled && !stickFigureEnabled) return

    const appliedRotations = stickFigureEnabled
      ? bridgeRef.current?.getAppliedRotations()
      : undefined

    setDebugData({
      pipelineState,
      detection: detection ?? {
        hasFace: false, hasPose: false, hasLeftHand: false, hasRightHand: false,
        faceLandmarkCount: 0, poseLandmarkCount: 0,
      },
      rawPose: undefined,
      rawLandmarks: stickFigureEnabled ? rawLandmarks : undefined,
      appliedRotations,
      solved,
      performance: {
        fps: elapsed > 0 ? 1000 / elapsed : 0,
        frameTimeMs: elapsed,
      },
      lastUpdateTime: timestamp,
      error: errorMsg,
    })
  }, [])

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

    async function initWorker(): Promise<Worker | null> {
      try {
        const worker = new Worker(
          new URL('../lib/worker/tracking.worker.ts', import.meta.url),
          { type: 'module' }
        )

        return await new Promise<Worker | null>((resolve) => {
          const timeout = setTimeout(() => {
            worker.terminate()
            resolve(null)
          }, 15000)

          worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
            if (e.data.type === 'ready') {
              clearTimeout(timeout)
              console.log(`[perf] MediaPipe worker mode: ${e.data.mode}`)
              resolve(worker)
            } else if (e.data.type === 'error') {
              clearTimeout(timeout)
              console.warn('[perf] Worker init failed, falling back to main thread:', e.data.message)
              worker.terminate()
              resolve(null)
            }
          }

          worker.onerror = () => {
            clearTimeout(timeout)
            worker.terminate()
            resolve(null)
          }

          worker.postMessage({
            type: 'init',
            needsPose: poseTracking,
            needsHands: handTracking,
          })
        })
      } catch {
        return null
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

    // The frame loop runs the main-thread path once workerRef and useWorkerRef are
    // clear, and skips frames until initDirect() sets the tracker.
    async function fallBackToMainThread(worker: Worker): Promise<void> {
      worker.terminate()
      if (cancelled) return
      console.warn('[perf] Worker failed, falling back to main thread')
      workerRef.current = null
      useWorkerRef.current = false
      workerBusyRef.current = false
      try {
        await initDirect()
      } catch (err) {
        if (cancelled) return
        isRunningRef.current = false
        setIsTracking(false)
        setError(err instanceof Error ? err : new Error(String(err)))
        emitDebugData('error', null, null, 0, Date.now(), `Main-thread fallback failed: ${String(err)}`)
      }
    }

    async function init() {
      setIsInitializing(true)
      setIsWaitingForVideo(false)
      setError(null)
      emitDebugData('initializing', null, null, 0, Date.now(), 'Initializing MediaPipe...')

      try {
        const worker = await initWorker()
        if (cancelled) {
          worker?.terminate()
          return
        }

        if (worker) {
          workerRef.current = worker
          useWorkerRef.current = true
          // Replace the onerror handler from initWorker(). That handler terminates the worker
          // but leaves workerRef and useWorkerRef set, so the frame loop would wait forever.
          worker.onerror = () => {
            void fallBackToMainThread(worker)
          }
        } else {
          useWorkerRef.current = false
          await initDirect()
          if (cancelled) return
        }

        emitDebugData('initializing', null, null, 0, Date.now(),
          `MediaPipe ready (${useWorkerRef.current ? 'worker' : 'main-thread'}), creating bridge...`)

        bridgeRef.current = new TrackingBridge(vrm!, {
          smoothing: smoothingRef.current,
          faceTracking: faceTrackingRef.current,
          poseTracking: poseTrackingRef.current,
          handTracking: handTrackingRef.current,
        })

        setIsInitializing(false)

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

        if (useWorkerRef.current && workerRef.current) {
          const bridge = bridgeRef.current!
          // Measure the rate between results. The frame loop skips frames while the
          // worker is busy, so its interval overstates the rate.
          let lastResultTime: number | null = null
          workerRef.current.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
            if (e.data.type === 'result') {
              trackingProfiler.end('mediapipe')
              trackingProfiler.begin('bridge')
              bridge.update(e.data.data)
              trackingProfiler.end('bridge')
              const now = performance.now()
              const sinceLastResult = lastResultTime === null ? 0 : now - lastResultTime
              lastResultTime = now
              emitWorkerDebugData(
                'tracking',
                e.data.data,
                e.data.detection,
                sinceLastResult,
                Date.now(),
                null,
                e.data.rawLandmarks,
              )
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
  // poseTracking and handTracking choose between FaceLandmarker and HolisticLandmarker, so a change re-inits.
  }, [enabled, vrm, stream, poseTracking, handTracking, emitDebugData, emitWorkerDebugData])

  useEffect(() => {
    if (bridgeRef.current) {
      bridgeRef.current.setSmoothing(smoothing)
    }
  }, [smoothing])

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

      const frameInterval = frameIntervalRef.current
      const elapsed = timestamp - lastFrameTimeRef.current
      if (elapsed < frameInterval) {
        rafIdRef.current = requestAnimationFrame(loop)
        return
      }
      // Carry the remainder forward so that the average rate matches the target.
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

      if (useWorkerRef.current && workerRef.current) {
        // One frame in flight at a time.
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
              [bitmap]
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
            poseWorld: mediaPipeResult.poseWorldLandmarks?.[0] ?? [],
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
  }, [videoRef, emitDebugData])

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
