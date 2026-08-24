// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { pxAtDefaultRoot } from '../support/design-system'
import { compileStylesFor, declarationsFor } from '../support/rendered-styles'
import { Field } from '../../../src/components/field'
import { Select } from '../../../src/components/select'

function professions() {
  return (
    <>
      <option value="optometrist">Optometrist</option>
      <option value="dispensing">Dispensing optician</option>
    </>
  )
}

describe('Select', () => {
  it('renders a native select carrying its options', () => {
    render(<Select aria-label="Profession">{professions()}</Select>)
    const select = screen.getByRole('combobox')

    expect(select.tagName).toBe('SELECT')
    expect(screen.getAllByRole('option')).toHaveLength(2)
  })

  it('forwards name and value to the native element', () => {
    render(
      <Select
        aria-label="Profession"
        name="profession"
        defaultValue="dispensing"
      >
        {professions()}
      </Select>,
    )
    const select = screen.getByRole<HTMLSelectElement>('combobox')

    expect(select.name).toBe('profession')
    expect(select.value).toBe('dispensing')
  })

  it('picks up its label, description and id from the Field around it', () => {
    render(
      <Field label="Profession" help="Sets which register we check you against">
        <Select name="profession">{professions()}</Select>
      </Field>,
    )
    const select = screen.getByLabelText('Profession')

    expect(select.tagName).toBe('SELECT')
    expect(select.getAttribute('aria-describedby')).not.toBeNull()
  })

  it('is marked invalid by a Field in an error state', () => {
    render(
      <Field label="Profession" error="Choose a profession">
        <Select name="profession">{professions()}</Select>
      </Field>,
    )

    expect(screen.getByRole('combobox').getAttribute('aria-invalid')).toBe(
      'true',
    )
  })

  it('stands 48px tall — above the 44px touch floor', async () => {
    const { container } = render(
      <Select aria-label="Profession">{professions()}</Select>,
    )
    const select = container.querySelector('select')!
    const css = await compileStylesFor(select)

    expect(pxAtDefaultRoot(declarationsFor(css, select)['height'])).toBe(48)
  })

  it('suppresses the platform arrow so only the drawn chevron shows', async () => {
    const { container } = render(
      <Select aria-label="Profession">{professions()}</Select>,
    )
    const select = container.querySelector('select')!
    const css = await compileStylesFor(select)

    expect(declarationsFor(css, select)['appearance']).toBe('none')
  })

  it('hides the drawn chevron from assistive technology', () => {
    const { container } = render(
      <Select aria-label="Profession">{professions()}</Select>,
    )
    const chevron = container.querySelector('svg')

    expect(chevron).not.toBeNull()
    expect(chevron!.getAttribute('aria-hidden')).toBe('true')
  })

  it('lets clicks through the chevron to the control beneath it', async () => {
    const { container } = render(
      <Select aria-label="Profession">{professions()}</Select>,
    )
    const chevron = container.querySelector('svg')!
    const css = await compileStylesFor(chevron)

    expect(declarationsFor(css, chevron)['pointer-events']).toBe('none')
  })
})
