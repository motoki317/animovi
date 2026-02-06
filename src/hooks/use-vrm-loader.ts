/**
 * useVRMLoader - React hook for loading VRM models.
 * Uses Three.js GLTFLoader with @pixiv/three-vrm VRMLoaderPlugin.
 */

import { useState, useCallback, useRef } from 'react'
import type { VRM } from '@pixiv/three-vrm'
import { VRMLoaderPlugin } from '@pixiv/three-vrm'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

export interface UseVRMLoaderResult {
  vrm: VRM | null
  loading: boolean
  error: Error | null
  progress: number
  loadFromUrl: (url: string) => Promise<void>
  loadFromFile: (file: File) => Promise<void>
}

export function useVRMLoader(): UseVRMLoaderResult {
  const [vrm, setVrm] = useState<VRM | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [progress, setProgress] = useState(0)
  const loaderRef = useRef<GLTFLoader | null>(null)

  // Get or create the loader (singleton per hook instance)
  const getLoader = useCallback(() => {
    if (!loaderRef.current) {
      loaderRef.current = new GLTFLoader()
      loaderRef.current.register((parser) => new VRMLoaderPlugin(parser))
    }
    return loaderRef.current
  }, [])

  // Dispose previous VRM if exists
  const disposePreviousVRM = useCallback((previousVrm: VRM | null) => {
    if (previousVrm) {
      // VRM doesn't have a direct dispose method — traverse and dispose all GPU resources
      previousVrm.scene.traverse((obj) => {
        if ('geometry' in obj && obj.geometry) {
          (obj.geometry as { dispose?: () => void }).dispose?.()
        }
        if ('material' in obj && obj.material) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
          for (const mat of materials) {
            // Dispose textures attached to the material
            if (mat && typeof mat === 'object') {
              for (const value of Object.values(mat as Record<string, unknown>)) {
                if (value && typeof value === 'object' && 'isTexture' in value) {
                  (value as unknown as { dispose: () => void }).dispose()
                }
              }
              (mat as { dispose?: () => void }).dispose?.()
            }
          }
        }
      })
    }
  }, [])

  // Core loading logic shared by both loadFromUrl and loadFromFile
  const loadVRM = useCallback(
    (url: string, objectUrlToRevoke?: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        const loader = getLoader()

        loader.load(
          url,
          // onLoad
          (gltf) => {
            // Revoke object URL if it was created for a File
            if (objectUrlToRevoke) {
              URL.revokeObjectURL(objectUrlToRevoke)
            }

            const loadedVrm = gltf.userData.vrm as VRM | undefined

            if (!loadedVrm) {
              const noVrmError = new Error(
                'File does not contain VRM data. Please provide a valid VRM file.'
              )
              setError(noVrmError)
              setLoading(false)
              reject(noVrmError)
              return
            }

            // Dispose previous VRM before setting new one
            setVrm((prev) => {
              disposePreviousVRM(prev)
              return loadedVrm
            })

            setProgress(100)
            setLoading(false)
            setError(null)
            resolve()
          },
          // onProgress
          (progressEvent) => {
            if (progressEvent.total > 0) {
              const percent = Math.round(
                (progressEvent.loaded / progressEvent.total) * 100
              )
              setProgress(percent)
            }
          },
          // onError
          (loadError) => {
            // Revoke object URL even on error
            if (objectUrlToRevoke) {
              URL.revokeObjectURL(objectUrlToRevoke)
            }

            const errorObj =
              loadError instanceof Error
                ? loadError
                : new Error('Failed to load VRM file')
            setError(errorObj)
            setLoading(false)
            reject(errorObj)
          }
        )
      })
    },
    [getLoader, disposePreviousVRM]
  )

  const loadFromUrl = useCallback(
    async (url: string): Promise<void> => {
      setLoading(true)
      setError(null)
      setProgress(0)
      return loadVRM(url)
    },
    [loadVRM]
  )

  const loadFromFile = useCallback(
    async (file: File): Promise<void> => {
      setLoading(true)
      setError(null)
      setProgress(0)

      const objectUrl = URL.createObjectURL(file)
      return loadVRM(objectUrl, objectUrl)
    },
    [loadVRM]
  )

  return {
    vrm,
    loading,
    error,
    progress,
    loadFromUrl,
    loadFromFile,
  }
}
