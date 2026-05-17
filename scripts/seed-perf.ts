/**
 * Writes a 200-meeting fixture to `data/meetings.seed.json` for SC-005
 * measurement (dashboard interactive in under 1 s for up to 200 meetings).
 *
 * Usage:
 *   pnpm exec ts-node scripts/seed-perf.ts
 *   pnpm dev
 *   # open http://localhost:3000 and measure time-to-interactive
 *
 * Restores the original three-meeting demo fixture by re-running
 * `git checkout -- data/meetings.seed.json`.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const TARGET_COUNT = 200
const OUT_PATH = path.resolve(process.cwd(), 'data', 'meetings.seed.json')

const sampleTitles = [
  'Standup',
  'Product review',
  'Roadmap sync',
  'Design critique',
  'Engineering all-hands',
  'Q3 planning',
  'Bug triage',
  'Customer call',
  '1:1',
  'Retro',
]
const sampleParticipants = [
  'alice@example.com',
  'bob@example.com',
  'carol@example.com',
  'dan@example.com',
  'erin@example.com',
]
const sampleStatuses = ['draft', 'recorded', 'summarized'] as const

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length]
}

const baseTime = new Date('2026-05-01T09:00:00.000Z').getTime()
const meetings = Array.from({ length: TARGET_COUNT }, (_, i) => {
  const status = pick(sampleStatuses, i)
  const createdAt = new Date(baseTime + i * 60 * 60 * 1000).toISOString()
  const participantCount = (i % 4) + 1
  const participants = Array.from({ length: participantCount }, (_, j) =>
    pick(sampleParticipants, i + j),
  )
  return {
    id: `mtg_perf_${i.toString().padStart(4, '0')}`,
    title: `${pick(sampleTitles, i)} #${i + 1}`,
    participants,
    date: createdAt,
    durationSeconds: status === 'draft' ? 0 : 600 + (i % 1800),
    status,
    transcript:
      status === 'draft'
        ? null
        : `Alice: This is a synthetic transcript for meeting ${i + 1}.\n\nBob: Used to measure dashboard render performance.`,
    createdAt,
    updatedAt: createdAt,
  }
})

mkdirSync(path.dirname(OUT_PATH), { recursive: true })
writeFileSync(OUT_PATH, JSON.stringify(meetings, null, 2) + '\n', 'utf-8')

// eslint-disable-next-line no-console
console.log(
  `Wrote ${meetings.length} meetings to ${path.relative(process.cwd(), OUT_PATH)}`,
)
