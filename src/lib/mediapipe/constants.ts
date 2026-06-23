/**
 * Shared MediaPipe configuration constants.
 * Pinned version and model URLs used by both main-thread tracker and Web Worker.
 */

// Must match the installed @mediapipe/tasks-vision package: the JS glue loads a
// matching WASM runtime from this CDN path, and a version skew between them is
// unsupported.
export const MEDIAPIPE_VERSION = '0.10.35'

export const WASM_BASE_PATH =
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`

export const HOLISTIC_MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/1/holistic_landmarker.task'

export const FACE_MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
