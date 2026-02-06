import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { installGlobalErrorHandler, type ErrorHandler } from './global-handler'

describe('installGlobalErrorHandler', () => {
  let cleanup: () => void
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup?.()
    consoleSpy.mockRestore()
  })

  it('should catch unhandled errors', () => {
    const handler = vi.fn<ErrorHandler>()
    cleanup = installGlobalErrorHandler(handler)

    const error = new Error('test error')
    const event = new ErrorEvent('error', { message: 'test error', error })
    window.dispatchEvent(event)

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith({
      type: 'unhandled_error',
      message: 'test error',
      error,
    })
    expect(consoleSpy).toHaveBeenCalled()
  })

  it('should catch unhandled promise rejections', () => {
    const handler = vi.fn<ErrorHandler>()
    cleanup = installGlobalErrorHandler(handler)

    const error = new Error('rejected')
    const event = new PromiseRejectionEvent('unhandledrejection', {
      promise: Promise.resolve(),
      reason: error,
    })
    window.dispatchEvent(event)

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith({
      type: 'unhandled_rejection',
      message: 'rejected',
      error,
    })
  })

  it('should handle non-Error rejection reasons', () => {
    const handler = vi.fn<ErrorHandler>()
    cleanup = installGlobalErrorHandler(handler)

    const event = new PromiseRejectionEvent('unhandledrejection', {
      promise: Promise.resolve(),
      reason: 'string rejection',
    })
    window.dispatchEvent(event)

    expect(handler).toHaveBeenCalledWith({
      type: 'unhandled_rejection',
      message: 'string rejection',
      error: undefined,
    })
  })

  it('should clean up listeners on uninstall', () => {
    const handler = vi.fn<ErrorHandler>()
    cleanup = installGlobalErrorHandler(handler)
    cleanup()

    const event = new ErrorEvent('error', { message: 'after cleanup' })
    window.dispatchEvent(event)

    expect(handler).not.toHaveBeenCalled()
  })

  it('should work without custom handler (logs only)', () => {
    cleanup = installGlobalErrorHandler()

    const event = new ErrorEvent('error', { message: 'log only' })
    window.dispatchEvent(event)

    expect(consoleSpy).toHaveBeenCalled()
  })

  it('should not install twice', () => {
    const handler1 = vi.fn<ErrorHandler>()
    const handler2 = vi.fn<ErrorHandler>()
    cleanup = installGlobalErrorHandler(handler1)
    const cleanup2 = installGlobalErrorHandler(handler2)

    const event = new ErrorEvent('error', { message: 'test' })
    window.dispatchEvent(event)

    expect(handler1).toHaveBeenCalledOnce()
    // cleanup2 should be a no-op
    expect(cleanup2).toBeTypeOf('function')
    cleanup2()
    // Original handler should still work
    window.dispatchEvent(event)
    expect(handler1).toHaveBeenCalledTimes(2)
  })
})
