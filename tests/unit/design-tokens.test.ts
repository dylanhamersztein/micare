import { beforeAll, describe, expect, it } from 'vitest'

import {
  compileStyles,
  fontFaces,
  mediaQueryBody,
  pxAtDefaultRoot,
  ruleDeclarations,
  rulesSetting,
  utilityDeclarations,
} from './support/design-system'

const SURFACES: Readonly<Record<string, string>> = {
  surface: '#fbf8f3', // warm paper
  'surface-raised': '#ffffff',
  'surface-sunk': '#f4efe7',
  'surface-sand': '#f2e9da', // practitioner blocks
  'surface-deep': '#12332f', // header / footer
}

const INK: Readonly<Record<string, string>> = {
  text: '#1c1a17', // 15.6:1 on surface — AAA
  'text-body': '#423c34', // 10.3:1 on surface — long-form body copy
  'text-muted': '#5a544b', // 7.0:1 on surface — AAA
  'text-subtle': '#6e6252', // 5.5:1 on surface, 4.9:1 on sand
  'text-invert': '#f4efe7', // 12.4:1 on surface-deep
  'text-invert-muted': '#a8c4be', // 7.4:1 on surface-deep
}

const BORDERS: Readonly<Record<string, string>> = {
  border: '#e2dbd0',
  hairline: '#efe9df', // rules inside a card
  'border-strong': '#8f8574', // 3.4:1 on surface — field outlines, SC 1.4.11
  // The two rules the shell draws on surface-deep, where none of the warm
  // borders above are visible at all.
  'hairline-invert': '#445c58', // rules inside the footer
  'outline-invert': '#8e9a94', // 5.1:1 on surface-deep — control outlines
}

const ACTION: Readonly<Record<string, string>> = {
  primary: '#0d4a45', // white on it: 10.1:1
  'primary-hover': '#093632',
  'primary-soft': '#e7f0ee',
  // accent is 3.56:1 on surface: AA for large text only, never body, never a label
  accent: '#b4762a',
  focus: '#0d4a45',
  'focus-invert': '#e8c468',
}

// Ink = the same state at text weight on a white card; never the raw state hue.
const VERIFICATION: Readonly<
  Record<string, { hue: string; bg: string; border: string; ink: string }>
> = {
  verified: {
    hue: '#186a3b',
    bg: '#e8f3ea',
    border: '#c3dfcb',
    ink: '#14472b',
  },
  pending: {
    hue: '#7a4f00',
    bg: '#fdf3dc',
    border: '#e6d3a6',
    ink: '#5e3e00',
  },
  rejected: {
    hue: '#96301c',
    bg: '#fbeae7',
    border: '#e9c6bf',
    ink: '#7e2817',
  },
  revoked: {
    hue: '#7a1f1a',
    bg: '#f3ebe9',
    border: '#dfcdc9',
    ink: '#6b1b16',
  },
}

// The six provider states, mirrored from Stripe. Token names are kebab-cased,
// so the `past_due` status is `--color-sub-past-due`.
const SUBSCRIPTION: Readonly<Record<string, string>> = {
  incomplete: '#6e6252',
  trialing: '#0d4a45',
  active: '#186a3b',
  'past-due': '#7a4f00', // listing STAYS public during retries
  unpaid: '#96301c',
  canceled: '#5a544b',
}

const DISABLED: Readonly<Record<string, string>> = {
  disabled: '#e7e1d6',
  'disabled-border': '#c9c0b1',
  'disabled-ink': '#6e6252', // 5.0:1 on --color-disabled
  skeleton: '#efe9df',
  'skeleton-sheen': '#f7f3ec',
}

const TYPE_SCALE: Readonly<Record<string, { px: number; lineHeight: string }>> =
  {
    label: { px: 13, lineHeight: '1.25' },
    meta: { px: 16, lineHeight: '1.5' },
    base: { px: 17, lineHeight: '1.6' }, // mobile body
    body: { px: 18, lineHeight: '1.61' }, // desktop body
    lg: { px: 19, lineHeight: '1.58' },
    title: { px: 20, lineHeight: '1.4' },
    h2: { px: 24, lineHeight: '1.33' },
    h1: { px: 34, lineHeight: '1.18' },
    display: { px: 44, lineHeight: '1.09' },
    figure: { px: 48, lineHeight: '1.05' },
  }

let css: string

beforeAll(async () => {
  css = await compileStyles([
    ...Object.keys(SURFACES).map((name) => `bg-${name}`),
    ...Object.keys(INK).map((name) => `text-${name}`),
    ...Object.keys(BORDERS).map((name) => `border-${name}`),
    ...Object.keys(ACTION).map((name) => `bg-${name}`),
    ...Object.keys(VERIFICATION).flatMap((status) => [
      `text-${status}`,
      `bg-${status}-bg`,
      `border-${status}-border`,
      `text-${status}-ink`,
    ]),
    'border-primary-border',
    ...Object.keys(SUBSCRIPTION).map((status) => `bg-sub-${status}`),
    ...Object.keys(DISABLED).map((name) => `bg-${name}`),
    ...Object.keys(TYPE_SCALE).map((name) => `text-${name}`),
    'tracking-tightest',
    'tracking-caps',
    'p-1',
    'p-6',
    'rounded-xs',
    'rounded-sm',
    'rounded-md',
    'rounded-lg',
    'shadow-sm',
    'shadow-md',
    'shadow-lg',
    'min-h-(--touch-min)',
    'font-sans',
    'font-serif',
  ])
})

describe('surfaces', () => {
  for (const [name, value] of Object.entries(SURFACES)) {
    it(`paints bg-${name} with ${value}`, () => {
      expect(utilityDeclarations(css, `bg-${name}`)['background-color']).toBe(
        value,
      )
    })
  }
})

describe('ink', () => {
  for (const [name, value] of Object.entries(INK)) {
    it(`renders text-${name} in ${value}`, () => {
      expect(utilityDeclarations(css, `text-${name}`).color).toBe(value)
    })
  }
})

describe('borders', () => {
  for (const [name, value] of Object.entries(BORDERS)) {
    it(`draws border-${name} in ${value}`, () => {
      expect(utilityDeclarations(css, `border-${name}`)['border-color']).toBe(
        value,
      )
    })
  }
})

describe('action', () => {
  for (const [name, value] of Object.entries(ACTION)) {
    it(`paints bg-${name} with ${value}`, () => {
      expect(utilityDeclarations(css, `bg-${name}`)['background-color']).toBe(
        value,
      )
    })
  }
})

describe('verification statuses', () => {
  for (const [status, palette] of Object.entries(VERIFICATION)) {
    describe(status, () => {
      it(`renders text-${status} in the state hue ${palette.hue}`, () => {
        expect(utilityDeclarations(css, `text-${status}`).color).toBe(
          palette.hue,
        )
      })

      it(`fills bg-${status}-bg with ${palette.bg}`, () => {
        expect(
          utilityDeclarations(css, `bg-${status}-bg`)['background-color'],
        ).toBe(palette.bg)
      })

      it(`draws border-${status}-border in ${palette.border}`, () => {
        expect(
          utilityDeclarations(css, `border-${status}-border`)['border-color'],
        ).toBe(palette.border)
      })

      it(`renders text-${status}-ink at text weight in ${palette.ink}`, () => {
        expect(utilityDeclarations(css, `text-${status}-ink`).color).toBe(
          palette.ink,
        )
      })
    })
  }

  it('gives info alerts their own border tint', () => {
    expect(
      utilityDeclarations(css, 'border-primary-border')['border-color'],
    ).toBe('#c6d6d4')
  })
})

describe('subscription statuses', () => {
  for (const [status, value] of Object.entries(SUBSCRIPTION)) {
    it(`dots bg-sub-${status} with ${value}`, () => {
      expect(
        utilityDeclarations(css, `bg-sub-${status}`)['background-color'],
      ).toBe(value)
    })
  }
})

describe('disabled and skeleton', () => {
  for (const [name, value] of Object.entries(DISABLED)) {
    it(`paints bg-${name} with ${value}`, () => {
      expect(utilityDeclarations(css, `bg-${name}`)['background-color']).toBe(
        value,
      )
    })
  }
})

describe('type scale', () => {
  for (const [name, step] of Object.entries(TYPE_SCALE)) {
    it(`renders text-${name} at ${step.px}px on a default root font size`, () => {
      const { 'font-size': fontSize, 'line-height': lineHeight } =
        utilityDeclarations(css, `text-${name}`)

      expect(pxAtDefaultRoot(fontSize)).toBe(step.px)
      expect(lineHeight).toBe(step.lineHeight)
    })
  }
})

describe('tracking', () => {
  it('tightens display type with tracking-tightest', () => {
    expect(
      utilityDeclarations(css, 'tracking-tightest')['letter-spacing'],
    ).toBe('-0.02em')
  })

  it('opens up uppercase labels with tracking-caps', () => {
    expect(utilityDeclarations(css, 'tracking-caps')['letter-spacing']).toBe(
      '0.12em',
    )
  })
})

describe('space, radius and elevation', () => {
  it('scales spacing utilities from a 4px base unit', () => {
    expect(pxAtDefaultRoot(utilityDeclarations(css, 'p-1').padding)).toBe(4)
    expect(pxAtDefaultRoot(utilityDeclarations(css, 'p-6').padding)).toBe(24)
  })

  const RADII: Readonly<Record<string, string>> = {
    xs: '2px',
    sm: '3px',
    md: '4px',
    lg: '6px',
  }

  for (const [name, value] of Object.entries(RADII)) {
    it(`rounds rounded-${name} by ${value}`, () => {
      expect(utilityDeclarations(css, `rounded-${name}`)['border-radius']).toBe(
        value,
      )
    })
  }

  const SHADOWS: Readonly<Record<string, string>> = {
    sm: '0 1px 2px rgb(58 44 26 / 0.08), 0 1px 1px rgb(58 44 26 / 0.06)',
    md: '0 4px 12px rgb(58 44 26 / 0.1), 0 1px 3px rgb(58 44 26 / 0.07)',
    lg: '0 12px 28px rgb(58 44 26 / 0.14), 0 2px 6px rgb(58 44 26 / 0.08)',
  }

  for (const [name, value] of Object.entries(SHADOWS)) {
    it(`casts shadow-${name} as a warm shadow`, () => {
      expect(
        utilityDeclarations(css, `shadow-${name}`)['--tw-shadow'],
      ).toContain(value)
    })
  }

  it('keeps hit targets at the 44px minimum', () => {
    expect(
      pxAtDefaultRoot(
        utilityDeclarations(css, 'min-h-\\(--touch-min\\)')['min-height'],
      ),
    ).toBe(44)
  })
})

describe('typefaces', () => {
  it('sets body and UI copy in the self-hosted Public Sans', () => {
    const stack = utilityDeclarations(css, 'font-sans')['font-family']

    expect(stack).toMatch(/^['"]Public Sans Variable['"]/)
    expect(stack).toContain('system-ui')
  })

  it('sets headings and the wordmark in the self-hosted Newsreader', () => {
    const stack = utilityDeclarations(css, 'font-serif')['font-family']

    expect(stack).toMatch(/^['"]Newsreader Variable['"]/)
    expect(stack).toContain('Georgia')
  })

  it('self-hosts both families, so nothing is fetched from a font host', () => {
    const faces = fontFaces(css)
    const families = new Set(faces.map((face) => face.family))

    expect(families).toEqual(
      new Set(['Public Sans Variable', 'Newsreader Variable']),
    )

    for (const { family, sources } of faces) {
      expect(sources.length).toBeGreaterThan(0)

      for (const source of sources) {
        expect(
          source,
          `${family} is fetched from an external host`,
        ).not.toMatch(/^(https?:)?\/\//)
      }
    }
  })
})

describe('base layer', () => {
  it('pins the colour scheme to light, so a dark OS cannot auto-darken controls', () => {
    expect(ruleDeclarations(css, ':root')['color-scheme']).toBe('light')
  })

  it('gives keyboard users a visible focus indicator in the focus colour', () => {
    const focus = ruleDeclarations(css, ':focus-visible')

    expect(focus.outline).toBe('3px solid #0d4a45')
    expect(focus['outline-offset']).toBe('2px')
  })

  it('switches the focus ring to its invert on deep surfaces', () => {
    expect(
      ruleDeclarations(css, '.on-deep :focus-visible')['outline-color'],
    ).toBe('#e8c468')
  })

  it('all but removes animation for anyone who asked for reduced motion', () => {
    const reduced = mediaQueryBody(css, '(prefers-reduced-motion: reduce)')

    expect(reduced).toMatch(/animation-duration:\s*0\.01ms\s*!important/)
    expect(reduced).toMatch(/transition-duration:\s*0\.01ms\s*!important/)
  })
})

describe('root font size', () => {
  it('leaves the root alone, so every --text-* token renders the px it documents', () => {
    const onRoot = rulesSetting(css, 'font-size').filter(({ selector }) =>
      /(^|[\s,])(html|:root)([\s,]|$)/.test(selector),
    )

    expect(onRoot).toEqual([])
  })

  it('renders body copy at 17px, the mobile step', () => {
    expect(pxAtDefaultRoot(ruleDeclarations(css, 'body')['font-size'])).toBe(17)
  })

  it('steps body copy up to 18px from the 48rem breakpoint', () => {
    const wide = mediaQueryBody(css, '(width >= 48rem)')

    expect(
      pxAtDefaultRoot(ruleDeclarations(css, 'body', wide)['font-size']),
    ).toBe(18)
  })
})
