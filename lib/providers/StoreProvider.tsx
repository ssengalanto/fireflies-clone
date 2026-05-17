'use client'

import type { ReactNode } from 'react'

/**
 * Pass-through hydration boundary for Zustand. Currently a no-op wrapper —
 * Zustand v4's `persist` middleware reads from `localStorage` synchronously
 * after mount, which is good enough for v1. If we ever introduce server-side
 * store hydration (e.g. signed-out preferences delivered via cookies), this
 * is the seam to hook into.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}
