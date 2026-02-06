/**
 * Shared PipelineProfiler instances for tracking and rendering loops.
 * These are module-level singletons that can be imported by both the
 * hot loops (for recording) and the overlay component (for display).
 */

import { PipelineProfiler } from './pipeline-profiler'

/** Profiler for the tracking loop (MediaPipe + solver + bridge) */
export const trackingProfiler = new PipelineProfiler(60)

/** Profiler for the rendering loop (controls + VRM update + Three.js render) */
export const renderProfiler = new PipelineProfiler(60)
