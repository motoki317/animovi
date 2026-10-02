/** Module singletons, so the hot loops record and PerformanceOverlay reads the same data. */

import { PipelineProfiler } from './pipeline-profiler'

/**
 * Stages: mediapipe, solver, bridge. In worker mode, mediapipe times the round
 * trip from createImageBitmap() to the result message, solving included. The
 * solver stage then has no samples.
 */
export const trackingProfiler = new PipelineProfiler(60)

/** Stages: controls, vrm_update, render. */
export const renderProfiler = new PipelineProfiler(60)
