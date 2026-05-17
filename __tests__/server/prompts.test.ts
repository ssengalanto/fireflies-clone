import {
  MODEL,
  buildActionItemsPrompt,
  buildSummaryPrompt,
} from '@/lib/server/prompts'

describe('lib/server/prompts', () => {
  it('pins the model constant to claude-opus-4-7', () => {
    expect(MODEL).toBe('claude-opus-4-7')
  })

  it('buildSummaryPrompt references summary and transcript', () => {
    const prompt = buildSummaryPrompt()
    expect(prompt.length).toBeGreaterThan(30)
    expect(prompt).toMatch(/summary/i)
    expect(prompt).toMatch(/transcript/i)
  })

  it('buildActionItemsPrompt is a non-empty string (stub for US3)', () => {
    // T089 (US3) fills in the real content; T075 only requires a callable
    // export so the route handler can import it.
    expect(typeof buildActionItemsPrompt()).toBe('string')
  })
})
