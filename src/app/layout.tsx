import type { ReactNode } from 'react'
import './globals.css'

export const metadata = {
  title: 'VRM-Tuber',
  description: 'A lightweight, web-based VTubing application',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
