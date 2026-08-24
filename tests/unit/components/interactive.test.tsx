// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  compileStylesFor,
  declarationsFor,
  lengthInPx,
} from '../support/rendered-styles'
import { Button } from '../../../src/components/button'
import { SegmentedRadio } from '../../../src/components/segmented-radio'
import { Select } from '../../../src/components/select'
import { TextInput } from '../../../src/components/text-input'
import { Textarea } from '../../../src/components/textarea'

import type { ReactElement } from 'react'

// Every control a finger or a Tab key can land on. The two rules below hold
// across all of them, which is why they are asserted here rather than repeated
// in each component's own file.
const CONTROLS: ReadonlyArray<{
  name: string
  element: ReactElement
  selector: string
}> = [
  { name: 'Button', element: <Button>Save</Button>, selector: 'button' },
  {
    name: 'TextInput',
    element: <TextInput aria-label="Full name" />,
    selector: 'input',
  },
  {
    name: 'Textarea',
    element: <Textarea aria-label="Bio" />,
    selector: 'textarea',
  },
  {
    name: 'Select',
    element: (
      <Select aria-label="Profession">{<option>Optometrist</option>}</Select>
    ),
    selector: 'select',
  },
  {
    name: 'SegmentedRadio',
    element: (
      <SegmentedRadio
        legend="Search radius"
        name="radiusMiles"
        options={[{ value: 5, label: '5 miles' }]}
        value={5}
        onChange={() => {}}
      />
    ),
    selector: 'label',
  },
]

describe('every interactive primitive', () => {
  for (const { name, element, selector } of CONTROLS) {
    it(`gives ${name} at least a 44px touch target`, async () => {
      const { container } = render(element)
      const control = container.querySelector(selector)!
      const css = await compileStylesFor(control)
      const declarations = declarationsFor(css, control)
      const floor = declarations['min-height'] ?? declarations['height']

      expect(floor).toBeDefined()
      expect(lengthInPx(floor)).toBeGreaterThanOrEqual(44)
    })

    it(`leaves ${name}'s focus ring alone, so the base layer can draw it`, async () => {
      const { container } = render(element)
      const control = container.querySelector(selector)!
      const css = await compileStylesFor(control)
      const declarations = declarationsFor(css, control)

      expect(declarations['outline-style']).not.toBe('none')
      expect(declarations['outline']).not.toBe('none')
    })
  }
})
