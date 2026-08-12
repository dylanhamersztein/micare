import { describe, expect, it } from 'vitest'

import { notifyInputSchema } from '../../src/notify-input'

describe('notifyInputSchema', () => {
  it('normalises email and postcode so one consumer means one row', () => {
    const parsed = notifyInputSchema.parse({
      email: '  Jane@Example.co.uk ',
      postcode: 'ec2v6aa',
    })

    expect(parsed).toEqual({
      email: 'jane@example.co.uk',
      postcode: 'EC2V 6AA',
    })
  })

  it('rejects an unusable email address', () => {
    const result = notifyInputSchema.safeParse({
      email: 'not-an-email',
      postcode: 'EC2V 6AA',
    })
    expect(result.success).toBe(false)
  })

  // A Notify-Me row is geocoded to a point, so a partial postcode (an outward
  // code alone) is not enough — unlike /search, which will happily resolve
  // "Norwich" to a town centre.
  it('rejects anything that is not a full UK postcode', () => {
    for (const postcode of ['', '   ', 'EC2V', 'Norwich', '12345']) {
      const result = notifyInputSchema.safeParse({
        email: 'jane@example.co.uk',
        postcode,
      })
      expect(
        result.success,
        `expected ${JSON.stringify(postcode)} to fail`,
      ).toBe(false)
    }
  })
})
