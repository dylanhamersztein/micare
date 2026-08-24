// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  compileStylesFor,
  declarationsFor,
  variantDeclarations,
} from '../support/rendered-styles'
import { Field } from '../../../src/components/field'
import { Textarea } from '../../../src/components/textarea'

describe('Textarea', () => {
  it('renders a native textarea', () => {
    render(<Textarea aria-label="Bio" />)

    expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA')
  })

  it('opens at four rows, the height the bio field is designed around', () => {
    render(<Textarea aria-label="Bio" />)

    expect(screen.getByRole('textbox').getAttribute('rows')).toBe('4')
  })

  it('takes a caller row count', () => {
    render(<Textarea aria-label="Bio" rows={8} />)

    expect(screen.getByRole('textbox').getAttribute('rows')).toBe('8')
  })

  it('picks up its label, description and id from the Field around it', () => {
    render(
      <Field label="Bio" help="Plain description of your Practice">
        <Textarea name="bio" />
      </Field>,
    )
    const textarea = screen.getByLabelText('Bio')

    expect(textarea.tagName).toBe('TEXTAREA')
    expect(textarea.getAttribute('aria-describedby')).not.toBeNull()
  })

  it('is marked invalid by a Field in an error state', () => {
    render(
      <Field label="Bio" error="Too long">
        <Textarea name="bio" />
      </Field>,
    )

    expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe(
      'true',
    )
  })

  it('resizes vertically only, so it can never break the column it sits in', async () => {
    const { container } = render(<Textarea aria-label="Bio" />)
    const textarea = container.querySelector('textarea')!
    const css = await compileStylesFor(textarea)

    expect(declarationsFor(css, textarea)['resize']).toBe('vertical')
  })

  it('carries the same outline and error tone as every other control', async () => {
    const { container } = render(<Textarea aria-label="Bio" />)
    const textarea = container.querySelector('textarea')!
    const css = await compileStylesFor(textarea)

    expect(declarationsFor(css, textarea)['border-color']).toBe('#8f8574')
    expect(
      variantDeclarations(css, textarea, 'aria-invalid')['border-color'],
    ).toBe('#96301c')
  })
})
