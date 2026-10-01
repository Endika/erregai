import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

// Every rule whose selector list names the notice box itself (not its children).
function noticeRules(): string[] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selector]) => selector.split(',').some((s) => /^\s*\.notice(\[|\s*$)/.test(s)))
    .map(([, , body]) => body)
}

describe('.notice', () => {
  it('is found in the stylesheet', () => {
    expect(noticeRules().length).toBeGreaterThan(0)
  })

  // A thicker start border is the side-tab stripe; the static detector misses
  // it written as a logical property, so this test is what keeps it out.
  it('carries its tone without a side stripe', () => {
    for (const body of noticeRules()) {
      expect(body).not.toMatch(/border-(inline-start|inline-end|left|right)(-width)?\s*:/)
    }
  })

  it('keeps the tone in its background, border and title', () => {
    const all = noticeRules().join('\n')
    expect(all).toMatch(/background:\s*var\(--notice-bg\)/)
    expect(all).toMatch(/border:\s*1px solid/)
    expect(css).toMatch(/\.notice__title\s*\{[^}]*color:\s*var\(--notice-fg\)/)
  })
})
