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

  it('buildActionItemsPrompt explicitly instructs the model to return a JSON array', () => {
    const prompt = buildActionItemsPrompt()
    expect(prompt).toMatch(/JSON array/i)
    expect(prompt).toMatch(/text/)
    expect(prompt).toMatch(/owner/)
    expect(prompt).toMatch(/dueDate/)
    expect(prompt).toMatch(/no clear action items.*\[\]/i)
  })
})
