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

export interface Vector3 {
  x: number
  y: number
  z: number
}

export class KalmanFilter3D {
  private readonly filterX: KalmanFilter
  private readonly filterY: KalmanFilter
  private readonly filterZ: KalmanFilter

  constructor(options: KalmanFilterOptions = {}) {
    this.filterX = new KalmanFilter(options)
    this.filterY = new KalmanFilter(options)
    this.filterZ = new KalmanFilter(options)
  }

  update(value: Vector3): Vector3 {
    return {
      x: this.filterX.update(value.x),
      y: this.filterY.update(value.y),
      z: this.filterZ.update(value.z),
    }
  }
}
