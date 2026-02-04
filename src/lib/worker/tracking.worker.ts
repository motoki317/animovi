/**
 * Tracking Worker - Handles MediaPipe tracking in a Web Worker context.
 */

import type { WorkerMessage, WorkerResponse, WorkerConfig } from './protocol'
import { solveHolistic, type HolisticResult } from '../solver/holistic-solver'

export interface TrackerResult {
  faceLandmarks: Array<{ x: number; y: number; z: number }>[]
  poseLandmarks: Array<{ x: number; y: number; z: number; visibility?: number }>[]
  leftHandLandmarks: Array<{ x: number; y: number; z: number }>[]
  rightHandLandmarks: Array<{ x: number; y: number; z: number }>[]
}

export interface Tracker {
  detect: (imageData: ImageData) => Promise<TrackerResult>
}

let config: WorkerConfig = {}
let tracker: Tracker | null = null

// For testing purposes
export function setTracker(t: Tracker): void {
  tracker = t
}

export async function handleMessage(
  message: WorkerMessage,
  postMessage: (response: WorkerResponse) => void
): Promise<void> {
  switch (message.type) {
    case 'setup':
      config = message.config
      postMessage({ type: 'ready' })
      break
    case 'config':
      config = { ...config, ...message.config }
      break
    case 'frame':
      if (tracker) {
        const result = await tracker.detect(message.imageData)
        const solved = solveHolistic({
          face: result.faceLandmarks[0] ?? [],
          pose: result.poseLandmarks[0] ?? [],
          leftHand: result.leftHandLandmarks[0] ?? [],
          rightHand: result.rightHandLandmarks[0] ?? [],
        })
        postMessage({ type: 'result', data: solved })
      }
      break
    default:
      postMessage({ type: 'error', message: `Unknown message type: ${(message as { type: string }).type}` })
  }
}

// Worker context setup (only runs in actual worker)
if (typeof self !== 'undefined' && 'postMessage' in self) {
  self.onmessage = (event: MessageEvent<WorkerMessage>) => {
    handleMessage(event.data, self.postMessage.bind(self))
  }
}
