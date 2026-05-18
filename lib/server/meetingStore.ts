import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type {
  CreateMeetingInput,
  Meeting,
  MeetingStatus,
} from '@/lib/schemas/meeting.schema'

const SEED_PATH = path.resolve(process.cwd(), 'data/meetings.seed.json')

const store: Map<string, Meeting> = new Map()
// Promise-based seed gate. A boolean flag would race under concurrent
// first-requests (set true before the await completes → second caller
// returns to an empty store while the first is still loading). Caching
// the in-flight promise lets all callers await the same single read.
let seedingPromise: Promise<void> | null = null

export interface ListOptions {
  search?: string
  status?: MeetingStatus | 'all'
  cursor?: string
  limit?: number
}

export interface ListResult {
  items: Meeting[]
  nextCursor: string | null
}

const DEFAULT_LIMIT = 20

export async function seedFromFile(): Promise<void> {
  if (seedingPromise) return seedingPromise
  seedingPromise = (async () => {
    try {
      const raw = await readFile(SEED_PATH, 'utf-8')
      const meetings = JSON.parse(raw) as Meeting[]
      for (const m of meetings) {
        store.set(m.id, m)
      }
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
        // Seed file is optional. Empty store is the legal cold-start state.
        return
      }
      throw err
    }
  })()
  return seedingPromise
}

/**
 * Route-level seed gate. Tests start with an empty store — only the
 * `seedFromFile` unit test exercises the loader directly. Production
 * route handlers call `ensureSeeded()` to pick up dev fixtures.
 */
export async function ensureSeeded(): Promise<void> {
  if (process.env.JEST_WORKER_ID !== undefined) return
  await seedFromFile()
}

export function get(id: string): Meeting | undefined {
  return store.get(id)
}

export function create(input: CreateMeetingInput): Meeting {
  const now = new Date().toISOString()
  const meeting: Meeting = {
    id: `mtg_${cryptoRandomId()}`,
    title: input.title,
    participants: [...input.participants],
    date: input.date,
    durationSeconds: 0,
    status: 'draft',
    transcript: null,
    createdAt: now,
    updatedAt: now,
  }
  store.set(meeting.id, meeting)
  return meeting
}

export function update(id: string, patch: Partial<Meeting>): Meeting {
  const existing = store.get(id)
  if (!existing) {
    throw new Error(`Meeting not found: ${id}`)
  }

  const merged: Meeting = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  }

  // Recompute status only when the patch touched the transcript. Other
  // status transitions (e.g. 'summarized') are driven by external systems
  // (the Claude route) that explicitly set status in their own patch.
  if ('transcript' in patch) {
    merged.status = merged.transcript === null ? 'draft' : 'recorded'
  }

  store.set(merged.id, merged)
  return merged
}

export function remove(id: string): void {
  if (!store.has(id)) {
    throw new Error(`Meeting not found: ${id}`)
  }
  store.delete(id)
}

export function list(opts: ListOptions): ListResult {
  const { search, status, cursor, limit = DEFAULT_LIMIT } = opts
  const effectiveLimit = clampLimit(limit)

  let all = Array.from(store.values())

  if (search && search.trim().length > 0) {
    const needle = search.trim().toLowerCase()
    all = all.filter((m) => {
      if (m.title.toLowerCase().includes(needle)) return true
      return m.participants.some((p) => p.toLowerCase().includes(needle))
    })
  }

  if (status && status !== 'all') {
    all = all.filter((m) => m.status === status)
  }

  all.sort((a, b) => {
    const at = new Date(a.createdAt).getTime()
    const bt = new Date(b.createdAt).getTime()
    if (bt !== at) return bt - at
    // Stable secondary sort so equal timestamps still cursor-paginate cleanly.
    return a.id < b.id ? 1 : -1
  })

  let startIndex = 0
  if (cursor) {
    const afterId = decodeCursor(cursor)
    const idx = all.findIndex((m) => m.id === afterId)
    startIndex = idx >= 0 ? idx + 1 : 0
  }

  const slice = all.slice(startIndex, startIndex + effectiveLimit)
  const reachedEnd = startIndex + slice.length >= all.length
  const last = slice[slice.length - 1]

  return {
    items: slice,
    nextCursor: reachedEnd || !last ? null : encodeCursor(last.id),
  }
}

// Test-only utility. Re-imports clear the module-level Map and seed flag so
// each test starts from a known-empty state.
export function __resetMeetingStoreForTests(): void {
  store.clear()
  seedingPromise = null
}

// Internals --------------------------------------------------------------

function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2, 12)
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit < 1) return 1
  if (limit > 100) return 100
  return Math.floor(limit)
}

function encodeCursor(id: string): string {
  return Buffer.from(id, 'utf-8').toString('base64url')
}

function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64url').toString('utf-8')
}
