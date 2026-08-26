// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { FileUpload } from '../../../src/components/file-upload'
import {
  compileStylesFor,
  declarationsFor,
  lengthInPx,
} from '../support/rendered-styles'

// Design section 07's upload zone. The control is a native file input, hidden
// but focusable behind the words that open the picker — the same arrangement
// the segmented control uses for its radios, and the same positioned-ancestor
// requirement: an absolutely positioned input with no positioned ancestor
// resolves against the page, and the focus ring lands somewhere other than the
// thing the user is on.

function photo(name = 'headshot.jpg'): File {
  return new File(['x'], name, { type: 'image/jpeg' })
}

function renderUpload(props: Partial<Parameters<typeof FileUpload>[0]> = {}) {
  return render(
    <FileUpload
      label="Profile photo"
      guidance="One clear, front-facing photo of you."
      help="JPEG, PNG or WebP · up to 5 MB"
      onFile={() => {}}
      data-testid="profile-photo-input"
      {...props}
    />,
  )
}

describe('FileUpload', () => {
  it('is a native file input, so the platform picker is the picker', () => {
    renderUpload()
    const input = screen.getByTestId<HTMLInputElement>('profile-photo-input')

    expect(input.tagName).toBe('INPUT')
    expect(input.type).toBe('file')
  })

  it('names the control by the field it fills and the words that open it', () => {
    renderUpload()
    const input = screen.getByTestId<HTMLInputElement>('profile-photo-input')

    expect(input.getAttribute('aria-label')).toBeNull()
    expect(
      screen.getByLabelText(/Profile photo/).getAttribute('data-testid'),
    ).toBe('profile-photo-input')
  })

  it('hides the input without taking it out of the tab order', async () => {
    renderUpload()
    const input = screen.getByTestId<HTMLInputElement>('profile-photo-input')
    const css = await compileStylesFor(input)
    const declarations = declarationsFor(css, input)

    expect(Number.parseFloat(declarations['opacity'])).toBe(0)
    expect(declarations['display']).not.toBe('none')
    expect(declarations['position']).toBe('absolute')
  })

  it('positions the label the input hides inside, so the ring lands on it', async () => {
    renderUpload()
    const opener = screen.getByTestId('profile-photo-input').closest('label')!
    const css = await compileStylesFor(opener)

    expect(declarationsFor(css, opener)['position']).toBe('relative')
  })

  it('gives the words that open the picker the 44px a thumb needs', async () => {
    renderUpload()
    const opener = screen.getByTestId('profile-photo-input').closest('label')!
    const css = await compileStylesFor(opener)

    expect(
      lengthInPx(declarationsFor(css, opener)['min-height']),
    ).toBeGreaterThanOrEqual(44)
  })

  it('describes the control with the constraints, not only the rejection', () => {
    renderUpload()
    const describedBy = screen
      .getByTestId('profile-photo-input')
      .getAttribute('aria-describedby')!

    const described = describedBy
      .split(' ')
      .map((id) => document.getElementById(id)!.textContent)
      .join(' ')

    expect(described).toContain('JPEG, PNG or WebP · up to 5 MB')
    expect(described).toContain('One clear, front-facing photo of you.')
  })

  it('hands over the file the picker returned', () => {
    const onFile = vi.fn()
    renderUpload({ onFile })
    const input = screen.getByTestId<HTMLInputElement>('profile-photo-input')

    fireEvent.change(input, { target: { files: [photo()] } })

    expect(onFile).toHaveBeenCalledTimes(1)
    expect(onFile.mock.calls[0][0].name).toBe('headshot.jpg')
  })

  // The zone says a photo can be dropped on it, so a photo dropped on it has
  // to arrive. A prompt the page cannot honour is worse than no prompt.
  it('hands over a file dropped on the zone', () => {
    const onFile = vi.fn()
    const { container } = renderUpload({ onFile })

    fireEvent.drop(container.firstElementChild!, {
      dataTransfer: { files: [photo('dropped.png')] },
    })

    expect(onFile).toHaveBeenCalledTimes(1)
    expect(onFile.mock.calls[0][0].name).toBe('dropped.png')
  })

  it('ignores a drop carrying nothing', () => {
    const onFile = vi.fn()
    const { container } = renderUpload({ onFile })

    fireEvent.drop(container.firstElementChild!, {
      dataTransfer: { files: [] },
    })

    expect(onFile).not.toHaveBeenCalled()
  })

  // Choosing the same file twice in a row is what a Practitioner does after a
  // rejection they have gone away and fixed. Without clearing the input the
  // second choice fires no change event at all.
  it('clears the input so the same file can be chosen again', () => {
    const onFile = vi.fn()
    renderUpload({ onFile })
    const input = screen.getByTestId<HTMLInputElement>('profile-photo-input')

    fireEvent.change(input, { target: { files: [photo()] } })

    expect(input.value).toBe('')
  })

  it('passes the accepted types through to the picker', () => {
    renderUpload({ accept: 'image/jpeg,image/png' })

    expect(
      screen.getByTestId('profile-photo-input').getAttribute('accept'),
    ).toBe('image/jpeg,image/png')
  })
})
