import { useState, useCallback, useEffect, useRef } from 'react'
import type { VRM } from '@pixiv/three-vrm'
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { saveVRM, loadVRM as loadVRMFromDB, updateLastUsed } from '../lib/vrm/vrm-storage'
import { ensureEyelidExpressions } from '../lib/vrm/ensure-eye-expressions'

export interface UseVRMLoaderResult {
  /** Disposed when a new VRM replaces it or when the hook unmounts. */
  vrm: VRM | null
  loading: boolean
  error: Error | null
  /** 0 to 100. */
  progress: number
  /** Also saves the file to IndexedDB after the VRM loads. A failed save only logs a warning. */
  loadFromFile: (file: File) => Promise<void>
  loadFromStorage: (id: number) => Promise<void>
  /** IndexedDB ID of the VRM from the last successful file save or storage load. */
  lastSavedId: number | null
}

export function useVRMLoader(): UseVRMLoaderResult {
  const [vrm, setVrm] = useState<VRM | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [progress, setProgress] = useState(0)
  const [lastSavedId, setLastSavedId] = useState<number | null>(null)
  const loaderRef = useRef<GLTFLoader | null>(null)

  // The caller's child AvatarScene removes vrm.scene in its effect cleanup, and
  // child cleanups run first. Disposing earlier, as in a setVrm updater, leaves
  // a gap in which a frame uploads the disposed resources again and leaks them.
  // deepDispose also frees the textures in MToon uniforms, which a walk over
  // Object.values(material) does not reach.
  useEffect(() => {
    if (!vrm) return
    return () => VRMUtils.deepDispose(vrm.scene)
  }, [vrm])

  const getLoader = useCallback(() => {
    if (!loaderRef.current) {
      loaderRef.current = new GLTFLoader()
      loaderRef.current.register((parser) => new VRMLoaderPlugin(parser))
    }
    return loaderRef.current
  }, [])

  // loadVRM settles loading and error itself. This covers the reads before it.
  const failBeforeLoad = useCallback((cause: unknown): Error => {
    const errorObj = cause instanceof Error ? cause : new Error(String(cause))
    setError(errorObj)
    setLoading(false)
    return errorObj
  }, [])

  const loadVRM = useCallback(
    (url: string, objectUrlToRevoke?: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        const loader = getLoader()

        loader.load(
          url,
          (gltf) => {
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

            // Fill in blink expressions for MMD-imported VRMs that ship eyelid
            // morphs but never bind them to the preset expressions.
            ensureEyelidExpressions(loadedVrm)

            setVrm(loadedVrm)

            setProgress(100)
            setLoading(false)
            setError(null)
            resolve()
          },
          (progressEvent) => {
            if (progressEvent.total > 0) {
              const percent = Math.round(
                (progressEvent.loaded / progressEvent.total) * 100
              )
              setProgress(percent)
            }
          },
          (loadError) => {
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
    [getLoader]
  )

  const loadFromFile = useCallback(
    async (file: File): Promise<void> => {
      setLoading(true)
      setError(null)
      setProgress(0)

      const arrayBuffer = await file.arrayBuffer().catch((cause) => {
        throw failBeforeLoad(cause)
      })
      const objectUrl = URL.createObjectURL(new Blob([arrayBuffer]))
      await loadVRM(objectUrl, objectUrl)

      // page.tsx replaces this empty thumbnail with a canvas capture.
      const placeholderThumb = new Blob([], { type: 'image/jpeg' })
      saveVRM(arrayBuffer, placeholderThumb, file.name, file.size)
        .then((id) => setLastSavedId(id))
        .catch(console.warn)
    },
    [loadVRM, failBeforeLoad]
  )

  const loadFromStorage = useCallback(
    async (id: number): Promise<void> => {
      setLoading(true)
      setError(null)
      setProgress(0)

      const stored = await loadVRMFromDB(id).catch((cause) => {
        throw failBeforeLoad(cause)
      })
      if (!stored) {
        throw failBeforeLoad(new Error('VRM not found in storage'))
      }

      const objectUrl = URL.createObjectURL(new Blob([stored.data]))
      await loadVRM(objectUrl, objectUrl)

      updateLastUsed(id).catch(console.warn)
      setLastSavedId(id)
    },
    [loadVRM, failBeforeLoad]
  )

  return {
    vrm,
    loading,
    error,
    progress,
    loadFromFile,
    loadFromStorage,
    lastSavedId,
  }
}
