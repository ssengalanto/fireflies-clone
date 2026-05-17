import type { Metadata } from 'next'
import { Albert_Sans, JetBrains_Mono } from 'next/font/google'
import type { ReactNode } from 'react'

import { SWRProvider } from '@/lib/providers/SWRProvider'
import { StoreProvider } from '@/lib/providers/StoreProvider'

import './globals.css'

// Albert Sans — refined geometric sans, Söhne-adjacent, the closest free
// match to the Linear / Raycast / Vercel aesthetic. The single typeface for
// everything textual in the app.
const albertSans = Albert_Sans({
  subsets: ['latin'],
  variable: '--font-mona',
  display: 'swap',
})

// JetBrains Mono — tabular numerals for timestamps, durations, counts.
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500'],
})

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME ?? 'Fireflies Clone',
  description: 'Capture meetings, transcripts, and AI summaries.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${albertSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <SWRProvider>
          <StoreProvider>{children}</StoreProvider>
        </SWRProvider>
      </body>
    </html>
  )
}
