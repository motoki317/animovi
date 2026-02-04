'use client'

/**
 * CameraProvider - Provides camera stream access to child components.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

interface CameraContextValue {
  stream: MediaStream | null
  error: Error | null
  isLoading: boolean
  switchCamera: (deviceId: string) => Promise<void>
  devices: MediaDeviceInfo[]
}

const CameraContext = createContext<CameraContextValue | null>(null)

export function useCamera(): CameraContextValue {
  const context = useContext(CameraContext)
  if (!context) {
    throw new Error('useCamera must be used within a CameraProvider')
  }
  return context
}

interface CameraProviderProps {
  children: ReactNode
}

export function CameraProvider({ children }: CameraProviderProps) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])

  useEffect(() => {
    let mounted = true

    async function initCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        })
        if (mounted) {
          setStream(mediaStream)
          setIsLoading(false)
        }

        // Get available devices
        const allDevices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = allDevices.filter((d) => d.kind === 'videoinput')
        if (mounted) {
          setDevices(videoDevices)
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e : new Error('Camera access denied'))
          setIsLoading(false)
        }
      }
    }

    initCamera()

    return () => {
      mounted = false
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const switchCamera = async (deviceId: string) => {
    try {
      // Stop current stream
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false,
      })
      setStream(newStream)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to switch camera'))
    }
  }

  return (
    <CameraContext.Provider value={{ stream, error, isLoading, switchCamera, devices }}>
      {children}
    </CameraContext.Provider>
  )
}
