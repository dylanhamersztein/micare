import { describe, expect, it } from 'vitest'

import { formatStaleAlertText } from '../../src/stale-alert'
import type { StalePractitioner } from '../../src/stale-alert'

const ROW: StalePractitioner = {
  id: 'id-1',
  short_id: 'abc123',
  full_name: 'Jane Optician',
  last_verified_at: new Date('2026-05-01T00:00:00.000Z'),
}

describe('formatStaleAlertText', () => {
  it('lists each practitioner with short_id, name and last-verified date', () => {
    const text = formatStaleAlertText([ROW], 14)
    expect(text).toContain('abc123')
    expect(text).toContain('Jane Optician')
    expect(text).toContain('2026-05-01')
    expect(text).toContain('14')
  })

  it('renders "never" for a null last_verified_at', () => {
    const text = formatStaleAlertText([{ ...ROW, last_verified_at: null }], 14)
    expect(text).toContain('never')
  })
})
