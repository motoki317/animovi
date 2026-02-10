/**
 * Tracking Worker - Runs MediaPipe inference + solving off the main thread.
 *
 * Accepts ImageBitmap frames via postMessage (transferred, zero-copy),
 * runs detection and solving, and posts back the solved HolisticResult.
 */

import {
  FilesetResolver,
  FaceLandmarker,
  HolisticLandmarker,
} from '@mediapipe/tasks-vision'
import { solveHolistic } from '../solver/holistic-solver'
import type { WorkerInMessage, WorkerOutMessage, WorkerDetectionInfo } from './protocol'

const MEDIAPIPE_VERSION = '0.10.32'
const WASM_BASE_PATH = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`

let holisticLandmarker: HolisticLandmarker | null = null
let faceLandmarker: FaceLandmarker | null = null

function post(msg: WorkerOutMessage) {
  self.postMessage(msg)
}

async function handleInit(needsPose: boolean, needsHands: boolean) {
  // Clean up previous instances on re-init
  holisticLandmarker?.close()
  holisticLandmarker = null
  faceLandmarker?.close()
  faceLandmarker = null

  try {
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE_PATH)

    if (needsPose || needsHands) {
      holisticLandmarker = await HolisticLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/1/holistic_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
      })
      post({ type: 'ready', mode: 'holistic' })
    } else {
      faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
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
    let poseLandmarks: { x: number; y: number; z: number }[][] = []
    let leftHandLandmarks: { x: number; y: number; z: number }[][] = []
    let rightHandLandmarks: { x: number; y: number; z: number }[][] = []

    if (holisticLandmarker) {
      const result = holisticLandmarker.detectForVideo(bitmap, timestamp)
      faceLandmarks = result.faceLandmarks
      poseLandmarks = result.poseLandmarks
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

    post({ type: 'result', data: solved, detection })
  } catch (err) {
    bitmap.close()
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}

// Exported for unit testing
export { handleInit, handleFrame }

// Worker context setup
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
