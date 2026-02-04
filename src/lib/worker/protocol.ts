/**
 * Worker Message Protocol - Defines message types for main thread <-> worker communication.
 */

export interface WorkerConfig {
  smoothing?: number
}

export type WorkerMessage =
  | { type: 'setup'; config: WorkerConfig }
  | { type: 'frame'; imageData: ImageData }
  | { type: 'config'; config: Partial<WorkerConfig> }

export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'result'; data: unknown }
  | { type: 'error'; message: string }

export function createSetupMessage(config: WorkerConfig): WorkerMessage {
  return { type: 'setup', config }
}

export function createFrameMessage(imageData: ImageData): WorkerMessage {
  return { type: 'frame', imageData }
}

export function createConfigMessage(config: Partial<WorkerConfig>): WorkerMessage {
  return { type: 'config', config }
}

export function parseWorkerResponse(data: unknown): WorkerResponse {
  const obj = data as { type: string; data?: unknown; message?: string }

  if (obj.type === 'ready') {
    return { type: 'ready' }
  }
  if (obj.type === 'result') {
    return { type: 'result', data: obj.data }
  }
  if (obj.type === 'error') {
    return { type: 'error', message: obj.message ?? 'Unknown error' }
  }

  throw new Error(`Invalid response type: ${obj.type}`)
}
