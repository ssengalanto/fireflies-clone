import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')

function walk(dir: string, results: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue
    const full = path.join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      walk(full, results)
    } else if (/\.(ts|tsx)$/.test(name)) {
      results.push(full)
    }
  }
  return results
}

describe('api-key isolation', () => {
  it('only app/api/claude/route.ts may import @anthropic-ai/sdk', () => {
    const sourceDirs = ['app', 'components', 'lib'].map((d) =>
      path.join(REPO_ROOT, d),
    )
    const matches: string[] = []
    for (const dir of sourceDirs) {
      for (const file of walk(dir)) {
        const content = readFileSync(file, 'utf-8')
        if (content.includes('@anthropic-ai/sdk')) {
          matches.push(path.relative(REPO_ROOT, file))
        }
      }
    }

    expect(matches.length).toBeLessThanOrEqual(1)
    if (matches.length === 1) {
      expect(matches[0]).toBe(path.join('app', 'api', 'claude', 'route.ts'))
    }
  })

  it('no NEXT_PUBLIC_* env var in .env.example contains ANTHROPIC', () => {
    const envExample = readFileSync(path.join(REPO_ROOT, '.env.example'), 'utf-8')
    const violations = envExample
      .split('\n')
      .filter((line) => /^NEXT_PUBLIC_[^=]*ANTHROPIC/i.test(line))
    expect(violations).toEqual([])
  })

  it('app/api/claude/route.ts (if present) reads ANTHROPIC_API_KEY directly via process.env', () => {
    const routePath = path.join(REPO_ROOT, 'app', 'api', 'claude', 'route.ts')
    let content: string
    try {
      content = readFileSync(routePath, 'utf-8')
    } catch {
      // Route doesn't exist yet (pre-T076). Pass — the other two tests are
      // the real gate until the route lands.
      return
    }
    expect(content).toMatch(/process\.env\.ANTHROPIC_API_KEY/)
  })
})
