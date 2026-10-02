// The npm package supplies the JS API, and WASM_BASE_PATH supplies the WASM
// loader and binary that the API calls into. Both must come from one release,
// so constants.test.ts checks this value against the installed package.
export const MEDIAPIPE_VERSION = '0.10.35'

export const WASM_BASE_PATH =
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`

export const HOLISTIC_MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/1/holistic_landmarker.task'

export const FACE_MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
