import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
import { PWARegister } from '../components/pwa-register'
import './globals.css'

export const metadata: Metadata = {
  title: 'VRM-Tuber',
  description: 'A lightweight, web-based VTubing application',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'VRM-Tuber',
  },
}

export const viewport: Viewport = {
  themeColor: '#1a1a2e',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PWARegister />
        {children}
      </body>
    </html>
  )
}
