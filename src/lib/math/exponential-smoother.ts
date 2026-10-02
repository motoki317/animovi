export interface ExponentialSmootherOptions {
  responsiveness?: number
}

export class ExponentialSmoother {
  private estimate: number | null = null
  /** The fraction of the gap to each new sample that the estimate closes, from 0 to 1. */
  responsiveness: number

  constructor(options: ExponentialSmootherOptions = {}) {
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
