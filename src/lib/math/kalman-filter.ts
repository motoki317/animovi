/**
 * Kalman Filter for smoothing motion tracking data.
 * Uses simplified 1D Kalman filter (exponential smoothing).
 */
export interface KalmanFilterOptions {
  responsiveness?: number
}

export class KalmanFilter {
  private estimate: number | null = null
  private readonly responsiveness: number

  constructor(options: KalmanFilterOptions = {}) {
    this.responsiveness = options.responsiveness ?? 0.5
  }

  update(value: number): number {
    if (this.estimate === null) {
      this.estimate = value
      return value
    }

    this.estimate = this.estimate + this.responsiveness * (value - this.estimate)
    return this.estimate
  }
}
