// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Field } from '../../../src/components/field'
import { TextInput } from '../../../src/components/text-input'

const LABEL = 'GOC registration number'
const HELP =
  'Two digits or one to two letters, then a hyphen and four to six digits.'
const ERROR = 'That is not a GOC number we recognise.'

/** The ids `aria-describedby` points at, in the order a screen reader reads them. */
function describedByIds(control: Element): Array<string> {
  const value = control.getAttribute('aria-describedby')

  return value === null || value === '' ? [] : value.split(' ')
}

/** The text a screen reader announces as the control's description. */
function description(control: Element): string {
  return describedByIds(control)
    .map((id) => control.ownerDocument.getElementById(id)?.textContent ?? '')
    .join(' ')
}

describe('Field', () => {
  it('labels the control it wraps', () => {
    render(
      <Field label={LABEL}>
        <TextInput name="gocNumber" />
      </Field>,
    )

    expect(screen.getByLabelText(LABEL).tagName).toBe('INPUT')
  })

  it('gives each field its own ids, so two on a page never collide', () => {
    render(
      <>
        <Field label="Full name" help="As on the register">
          <TextInput name="fullName" />
        </Field>
        <Field label="Practice name" help="As on the register">
          <TextInput name="practiceName" />
        </Field>
      </>,
    )
    const [first, second] = screen.getAllByRole('textbox')

    expect(first.id).not.toBe(second.id)
    expect(describedByIds(first)).not.toEqual(describedByIds(second))
  })

  it('exposes help text to the control through aria-describedby', () => {
    render(
      <Field label={LABEL} help={HELP}>
        <TextInput name="gocNumber" />
      </Field>,
    )

    expect(description(screen.getByRole('textbox'))).toBe(HELP)
  })

  it('describes nothing when there is no help text and no error', () => {
    render(
      <Field label={LABEL}>
        <TextInput name="gocNumber" />
      </Field>,
    )

    expect(describedByIds(screen.getByRole('textbox'))).toEqual([])
  })

  it('describes nothing when the help text is null, so an absent hint adds no empty description', () => {
    render(
      <Field label={LABEL} help={null}>
        <TextInput name="gocNumber" />
      </Field>,
    )

    expect(describedByIds(screen.getByRole('textbox'))).toEqual([])
  })

  it('marks required in words, never with an asterisk', () => {
    render(
      <Field label={LABEL} requirement="required">
        <TextInput name="gocNumber" />
      </Field>,
    )

    expect(screen.getByText('Required')).toBeDefined()
    expect(screen.queryByText('*')).toBeNull()
  })

  it('marks optional in words too', () => {
    render(
      <Field label="Bio" requirement="optional">
        <TextInput name="bio" />
      </Field>,
    )

    expect(screen.getByText('Optional')).toBeDefined()
  })

  it('marks nothing when the requirement is not stated', () => {
    render(
      <Field label={LABEL}>
        <TextInput name="gocNumber" />
      </Field>,
    )

    expect(screen.queryByText('Required')).toBeNull()
    expect(screen.queryByText('Optional')).toBeNull()
  })

  describe('in an error state', () => {
    it('marks the control invalid', () => {
      render(
        <Field label={LABEL} help={HELP} error={ERROR}>
          <TextInput name="gocNumber" />
        </Field>,
      )

      expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe(
        'true',
      )
    })

    it('chains help text and error message through aria-describedby, help first', () => {
      render(
        <Field label={LABEL} help={HELP} error={ERROR}>
          <TextInput name="gocNumber" />
        </Field>,
      )

      expect(describedByIds(screen.getByRole('textbox'))).toHaveLength(2)
      expect(description(screen.getByRole('textbox'))).toBe(`${HELP} ${ERROR}`)
    })

    it('describes the error alone when the field has no help text', () => {
      render(
        <Field label={LABEL} error={ERROR}>
          <TextInput name="gocNumber" />
        </Field>,
      )

      expect(description(screen.getByRole('textbox'))).toBe(ERROR)
    })

    it('adds the error beneath rather than replacing the help text', () => {
      render(
        <Field label={LABEL} help={HELP} error={ERROR}>
          <TextInput name="gocNumber" />
        </Field>,
      )

      expect(screen.getByText(HELP)).toBeDefined()
      expect(screen.getByText(ERROR)).toBeDefined()
    })

    it('hides the error glyph from assistive technology, which already has the words', () => {
      const { container } = render(
        <Field label={LABEL} error={ERROR}>
          <TextInput name="gocNumber" />
        </Field>,
      )
      const glyph = container.querySelector('svg')

      expect(glyph).not.toBeNull()
      expect(glyph!.getAttribute('aria-hidden')).toBe('true')
    })

    it('treats a null error as no error, since a server function reports a clean field as null', () => {
      render(
        <Field label={LABEL} help={HELP} error={null}>
          <TextInput name="gocNumber" />
        </Field>,
      )
      const input = screen.getByRole('textbox')

      expect(input.getAttribute('aria-invalid')).toBeNull()
      expect(description(input)).toBe(HELP)
    })

    it('leaves aria-invalid off when there is no error', () => {
      render(
        <Field label={LABEL} help={HELP}>
          <TextInput name="gocNumber" />
        </Field>,
      )

      expect(
        screen.getByRole('textbox').getAttribute('aria-invalid'),
      ).toBeNull()
    })
  })
})
