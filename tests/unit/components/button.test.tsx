// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import { pxAtDefaultRoot } from '../support/design-system'
import {
  compileStylesFor,
  declarationsFor,
  variantDeclarations,
} from '../support/rendered-styles'
import { Button, buttonClasses } from '../../../src/components/button'
import type { ButtonSize, ButtonVariant } from '../../../src/components/button'

// The paint each variant is specified to produce, straight from the design's
// button plate. Asserting the resolved colour rather than the class name means
// a swap to a different token fails here.
const VARIANT_PAINT: Readonly<
  Record<ButtonVariant, { background: string; text: string }>
> = {
  primary: { background: '#0d4a45', text: '#fff' },
  secondary: { background: '#ffffff', text: '#0d4a45' },
  ghost: { background: 'transparent', text: '#0d4a45' },
  destructive: { background: '#96301c', text: '#fff' },
}

// Three heights, none below the 44px floor.
const SIZE_HEIGHT_PX: Readonly<Record<ButtonSize, number>> = {
  sm: 44,
  md: 48,
  lg: 56,
}

const VARIANTS = Object.keys(VARIANT_PAINT) as Array<ButtonVariant>
const SIZES = Object.keys(SIZE_HEIGHT_PX) as Array<ButtonSize>

describe('Button', () => {
  it('renders its label inside a native button', () => {
    render(<Button>Save</Button>)

    expect(screen.getByRole('button', { name: 'Save' })).toBeDefined()
  })

  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Cancel</Button>)

    expect(screen.getByRole('button').getAttribute('type')).toBe('button')
  })

  it('forwards an explicit type', () => {
    render(<Button type="submit">Continue to payment</Button>)

    expect(screen.getByRole('button').getAttribute('type')).toBe('submit')
  })

  it('forwards native button props such as onClick and name', () => {
    const clicks: Array<string> = []
    render(
      <Button name="radius" onClick={() => clicks.push('clicked')}>
        Change radius
      </Button>,
    )
    const button = screen.getByRole('button')
    button.click()

    expect(button.getAttribute('name')).toBe('radius')
    expect(clicks).toEqual(['clicked'])
  })

  describe('variants', () => {
    for (const variant of VARIANTS) {
      describe(variant, () => {
        let declarations: Record<string, string>
        let disabledDeclarations: Record<string, string>

        beforeAll(async () => {
          const { container } = render(<Button variant={variant}>Go</Button>)
          const button = container.querySelector('button')!
          const css = await compileStylesFor(button)
          declarations = declarationsFor(css, button)
          disabledDeclarations = variantDeclarations(css, button, 'disabled')
        })

        it('paints the background the design specifies', () => {
          expect(declarations['background-color']).toBe(
            VARIANT_PAINT[variant].background,
          )
        })

        it('paints the label the design specifies', () => {
          expect(declarations['color']).toBe(VARIANT_PAINT[variant].text)
        })

        it('drops to the disabled palette when disabled', () => {
          expect(disabledDeclarations['background-color']).toBe('#e7e1d6')
          expect(disabledDeclarations['color']).toBe('#6e6252')
        })
      })
    }

    it('is primary by default', async () => {
      const { container } = render(<Button>Go</Button>)
      const button = container.querySelector('button')!
      const css = await compileStylesFor(button)

      expect(declarationsFor(css, button)['background-color']).toBe('#0d4a45')
    })

    it('underlines the ghost variant, because a bare coloured word is not a button to everyone', async () => {
      const { container } = render(<Button variant="ghost">Cancel</Button>)
      const button = container.querySelector('button')!
      const css = await compileStylesFor(button)

      expect(declarationsFor(css, button)['text-decoration-line']).toBe(
        'underline',
      )
    })
  })

  describe('sizes', () => {
    for (const size of SIZES) {
      it(`renders ${size} at ${SIZE_HEIGHT_PX[size]}px`, async () => {
        const { container } = render(<Button size={size}>Go</Button>)
        const button = container.querySelector('button')!
        const css = await compileStylesFor(button)

        expect(pxAtDefaultRoot(declarationsFor(css, button)['height'])).toBe(
          SIZE_HEIGHT_PX[size],
        )
      })

      it(`holds ${size} above the 44px touch floor even if its height is overridden`, async () => {
        const { container } = render(<Button size={size}>Go</Button>)
        const button = container.querySelector('button')!
        const css = await compileStylesFor(button)

        expect(
          pxAtDefaultRoot(declarationsFor(css, button)['min-height']),
        ).toBeGreaterThanOrEqual(44)
      })
    }

    it('is md by default', async () => {
      const { container } = render(<Button>Go</Button>)
      const button = container.querySelector('button')!
      const css = await compileStylesFor(button)

      expect(pxAtDefaultRoot(declarationsFor(css, button)['height'])).toBe(48)
    })
  })

  describe('loading and disabled', () => {
    it('is disabled and marked busy while loading', () => {
      render(
        <Button loading loadingLabel="Checking the register…">
          Continue to payment
        </Button>,
      )
      const button = screen.getByRole('button')

      expect((button as HTMLButtonElement).disabled).toBe(true)
      expect(button.getAttribute('aria-busy')).toBe('true')
    })

    it('announces what it is busy doing, not the resting label', () => {
      render(
        <Button loading loadingLabel="Checking the register…">
          Continue to payment
        </Button>,
      )

      expect(screen.getByRole('button').textContent).toBe(
        'Checking the register…',
      )
    })

    it('keeps its resting label when no loading label is given', () => {
      render(<Button loading>Continue to payment</Button>)

      expect(screen.getByRole('button').textContent).toBe('Continue to payment')
    })

    it('hides the spinner from assistive technology', () => {
      const { container } = render(<Button loading>Save</Button>)
      const spinner = container.querySelector('svg')

      expect(spinner).not.toBeNull()
      expect(spinner!.getAttribute('aria-hidden')).toBe('true')
    })

    it('shows no spinner at rest', () => {
      const { container } = render(<Button>Save</Button>)

      expect(container.querySelector('svg')).toBeNull()
    })

    it('is not marked busy when merely disabled', () => {
      render(<Button disabled>Save</Button>)
      const button = screen.getByRole('button')

      expect((button as HTMLButtonElement).disabled).toBe(true)
      expect(button.getAttribute('aria-busy')).toBeNull()
    })
  })
})

// One conversion action on the Practitioner profile leaves the site through
// /go, so it has to be an anchor doing a full navigation — but it is still the
// page's primary button and must not be a second, hand-typed copy of one.
describe('a link wearing the button chrome', () => {
  it('paints the same primary plate a Button does', async () => {
    render(
      <a href="/go?p=a1b2c3d4" className={buttonClasses({ size: 'lg' })}>
        Book an appointment
      </a>,
    )

    const link = screen.getByRole('link')
    const css = await compileStylesFor(link)
    const declarations = declarationsFor(css, link)

    expect(declarations['background-color']).toBe('#0d4a45')
    expect(declarations['color']).toBe('#fff')
    expect(pxAtDefaultRoot(declarations['height'])).toBe(56)
  })

  it('is the same chrome the Button itself wears, not a copy of it', () => {
    render(
      <Button variant="secondary" size="sm">
        Save
      </Button>,
    )

    const worn = screen.getByRole('button').className

    for (const className of buttonClasses({
      variant: 'secondary',
      size: 'sm',
    }).split(' ')) {
      expect(worn.split(' ')).toContain(className)
    }
  })
})
