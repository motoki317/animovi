/**
 * useVRMLoader - React hook for loading VRM models.
 */

import { useState } from 'react'
import type { VRM } from '@pixiv/three-vrm'

export interface UseVRMLoaderResult {
  vrm: VRM | null
  loading: boolean
  error: Error | null
  loadFromUrl: (url: string) => Promise<void>
  loadFromFile: (file: File) => Promise<void>
}

export function useVRMLoader(): UseVRMLoaderResult {
  const [vrm, setVrm] = useState<VRM | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const loadFromUrl = async (url: string): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      // TODO: Implement actual VRM loading
      throw new Error('Not implemented')
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Unknown error'))
      throw e
    } finally {
      setLoading(false)
    }
  }

  const loadFromFile = async (file: File): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      // TODO: Implement actual VRM loading from file
      throw new Error('Not implemented')
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Unknown error'))
      throw e
    } finally {
      setLoading(false)
    }
  }

  return {
    vrm,
    loading,
    error,
    loadFromUrl,
    loadFromFile,
  }
}
