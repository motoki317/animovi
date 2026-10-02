/**
 * Runs MediaPipe detection and solveHolistic() off the main thread, where
 * inference spikes of about 40 ms blocked the page (b12cc41). protocol.ts
 * defines the messages.
 */

import {
  FilesetResolver,
  FaceLandmarker,
  HolisticLandmarker,
} from '@mediapipe/tasks-vision'
import { solveHolistic } from '../solver/holistic-solver'
import { WASM_BASE_PATH, HOLISTIC_MODEL_PATH, FACE_MODEL_PATH } from '../mediapipe/constants'
import type {
  WorkerInMessage,
  WorkerOutMessage,
  WorkerDetectionInfo,
  RawLandmarks,
} from './protocol'

let holisticLandmarker: HolisticLandmarker | null = null
let faceLandmarker: FaceLandmarker | null = null

function post(msg: WorkerOutMessage) {
  self.postMessage(msg)
}

async function handleInit(needsPose: boolean, needsHands: boolean) {
  holisticLandmarker?.close()
  holisticLandmarker = null
  faceLandmarker?.close()
  faceLandmarker = null

  try {
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE_PATH)

    if (needsPose || needsHands) {
      holisticLandmarker = await HolisticLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: HOLISTIC_MODEL_PATH,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
      })
      post({ type: 'ready', mode: 'holistic' })
    } else {
      faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: FACE_MODEL_PATH,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      })
      post({ type: 'ready', mode: 'face' })
    }
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}

function handleFrame(bitmap: ImageBitmap, timestamp: number) {
  try {
    let faceLandmarks: { x: number; y: number; z: number }[][] = []
    let poseLandmarks: { x: number; y: number; z: number; visibility?: number }[][] = []
    // Meters, with the origin between the hips. The solver reads them for spine yaw.
    let poseWorldLandmarks: { x: number; y: number; z: number; visibility?: number }[][] = []
    let leftHandLandmarks: { x: number; y: number; z: number }[][] = []
    let rightHandLandmarks: { x: number; y: number; z: number }[][] = []

    if (holisticLandmarker) {
      const result = holisticLandmarker.detectForVideo(bitmap, timestamp)
      faceLandmarks = result.faceLandmarks
      poseLandmarks = result.poseLandmarks
      poseWorldLandmarks = result.poseWorldLandmarks ?? []
      leftHandLandmarks = result.leftHandLandmarks
      rightHandLandmarks = result.rightHandLandmarks
    } else if (faceLandmarker) {
      const result = faceLandmarker.detectForVideo(bitmap, timestamp)
      faceLandmarks = result.faceLandmarks
    }

    bitmap.close()

    const solved = solveHolistic({
      face: faceLandmarks[0] ?? [],
      pose: poseLandmarks[0] ?? [],
      poseWorld: poseWorldLandmarks[0] ?? [],
      leftHand: leftHandLandmarks[0] ?? [],
      rightHand: rightHandLandmarks[0] ?? [],
    })

    const detection: WorkerDetectionInfo = {
      hasFace: (faceLandmarks[0]?.length ?? 0) > 0,
      hasPose: (poseLandmarks[0]?.length ?? 0) > 0,
      hasLeftHand: (leftHandLandmarks[0]?.length ?? 0) > 0,
      hasRightHand: (rightHandLandmarks[0]?.length ?? 0) > 0,
      faceLandmarkCount: faceLandmarks[0]?.length ?? 0,
      poseLandmarkCount: poseLandmarks[0]?.length ?? 0,
    }

    // Sent on every frame. A gate on the debug toggle raced with the
    // main-thread effect that enabled it and left the stick-figure overlay
    // without data.
    const rawLandmarks: RawLandmarks = {}
    if (poseLandmarks[0]?.length) rawLandmarks.pose = poseLandmarks[0]
    if (leftHandLandmarks[0]?.length) rawLandmarks.leftHand = leftHandLandmarks[0]
    if (rightHandLandmarks[0]?.length) rawLandmarks.rightHand = rightHandLandmarks[0]
    if (faceLandmarks[0]?.length) rawLandmarks.face = faceLandmarks[0]

    const message: WorkerOutMessage = {
      type: 'result',
      data: solved,
      detection,
      rawLandmarks,
    }

    post(message)
  } catch (err) {
    bitmap.close()
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}

// Exported for unit testing
export { handleInit, handleFrame }

if (typeof self !== 'undefined' && 'postMessage' in self) {
  self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
    const msg = event.data
    if (msg.type === 'init') {
      handleInit(msg.needsPose, msg.needsHands)
    } else if (msg.type === 'frame') {
      handleFrame(msg.bitmap, msg.timestamp)
    }
  }
}
