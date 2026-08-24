// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { pxAtDefaultRoot } from '../support/design-system'
import {
  compileStylesFor,
  declarationsFor,
  variantDeclarations,
} from '../support/rendered-styles'
import { Field } from '../../../src/components/field'
import { TextInput } from '../../../src/components/text-input'

describe('TextInput', () => {
  it('renders a native text input', () => {
    render(<TextInput name="fullName" aria-label="Full name" />)
    const input = screen.getByRole('textbox')

    expect(input.tagName).toBe('INPUT')
    expect(input.getAttribute('type')).toBe('text')
  })

  it('forwards native input attributes the GOC field needs', () => {
    render(
      <TextInput
        name="gocNumber"
        aria-label="GOC number"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        required
      />,
    )
    const input = screen.getByRole('textbox')

    expect(input.getAttribute('name')).toBe('gocNumber')
    expect(input.getAttribute('autocapitalize')).toBe('characters')
    expect(input.getAttribute('autocorrect')).toBe('off')
    expect(input.getAttribute('spellcheck')).toBe('false')
    expect((input as HTMLInputElement).required).toBe(true)
  })

  it('takes a type, so email and tel controls get the right keyboard', () => {
    render(<TextInput type="email" aria-label="Email" />)

    expect(screen.getByRole('textbox').getAttribute('type')).toBe('email')
  })

  it('stands 48px tall — above the 44px touch floor', async () => {
    const { container } = render(<TextInput aria-label="Full name" />)
    const input = container.querySelector('input')!
    const css = await compileStylesFor(input)

    expect(pxAtDefaultRoot(declarationsFor(css, input)['height'])).toBe(48)
  })

  it('stands 56px tall as a search field, the one control sitting under a thumb', async () => {
    const { container } = render(
      <TextInput size="search" aria-label="Postcode" />,
    )
    const input = container.querySelector('input')!
    const css = await compileStylesFor(input)

    expect(pxAtDefaultRoot(declarationsFor(css, input)['height'])).toBe(56)
  })

  it('carries the 3.4:1 field outline the design specifies', async () => {
    const { container } = render(<TextInput aria-label="Full name" />)
    const input = container.querySelector('input')!
    const css = await compileStylesFor(input)

    expect(declarationsFor(css, input)['border-color']).toBe('#8f8574')
  })

  it('thickens its border on focus, so focus survives greyscale and high-contrast mode', async () => {
    const { container } = render(<TextInput aria-label="Full name" />)
    const input = container.querySelector('input')!
    const css = await compileStylesFor(input)
    const focused = variantDeclarations(css, input, 'focus-visible')

    expect(focused['border-width']).toBe('2px')
    expect(focused['border-color']).toBe('#0d4a45')
  })

  it('turns its border to the rejected tone when the field is invalid', async () => {
    const { container } = render(
      <Field label="GOC number" error="Not a number we recognise">
        <TextInput name="gocNumber" />
      </Field>,
    )
    const input = container.querySelector('input')!
    const css = await compileStylesFor(input)
    const invalid = variantDeclarations(css, input, 'aria-invalid')

    expect(invalid['border-width']).toBe('2px')
    expect(invalid['border-color']).toBe('#96301c')
  })

  it('keeps a caller id and description when used outside a Field', () => {
    render(
      <>
        <label htmlFor="postcode">Postcode</label>
        <p id="postcode-help">SW1A 1AA or Bath</p>
        <TextInput id="postcode" aria-describedby="postcode-help" />
      </>,
    )
    const input = screen.getByLabelText('Postcode')

    expect(input.id).toBe('postcode')
    expect(input.getAttribute('aria-describedby')).toBe('postcode-help')
  })
})
