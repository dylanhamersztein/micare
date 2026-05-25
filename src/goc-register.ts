// Pure GOC public-register parser. Turns a saved str.optical.org page into a
// VerificationResult. No IO — unit-testable from saved HTML fixtures. Uses
// node-html-parser, so this module is server-only by convention: routes must
// never import it (it would bloat the client bundle).
//
// The real GOC registrant detail page is a Bootstrap card: a `div.card-body`
// containing repeated `div.media-body[aria-label="…"]` blocks, each pairing a
// `<label>` with a sibling `<span class="d-block">` carrying the value
// ([aria-label="GOC Number"] → `<span>D-17909</span>`,
//  [aria-label="Registration Status"] → `<span><i>…</i>Registered</span>`,
//  the registrant name appears in the card-body's `h1#detail-title`).
//
// If the live register changes status wording, adjust ACTIVE_STATUS_PATTERN.
// The aria-label keys are also the page's accessibility names, so they are
// the most stable hooks available short of the GOC publishing an API.

import { parse } from 'node-html-parser'
import type { HTMLElement as ParsedElement } from 'node-html-parser'

import type { VerificationResult } from './verification'

// Matches the GOC "registered / fully registered" status wording.
const ACTIVE_STATUS_PATTERN = /\b(fully\s+)?registered\b/i

// The no-results message the GOC site injects into #list when a search
// returns zero matches (verbatim from #hiddenNoResultsTextDiv on the live
// page). Used to distinguish "search ran, no matches" from "we got something
// we cannot read".
const NO_RESULTS_PATTERN = /sorry no results match your search/i

// Strips formatting differences (spaces, hyphens, case) so "D-17909",
// "d 17909" and "D17909" all compare equal.
function normalizeNumber(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

// Reads the <span> value paired with an aria-labelled media-body block.
function readFieldValue(card: ParsedElement, ariaLabel: string): string | null {
  const block = card.querySelector(`[aria-label="${ariaLabel}"]`)
  if (!block) return null
  const span = block.querySelector('span.d-block')
  return span ? span.text.trim() : null
}

export function parseGocRegisterPage(
  html: string,
  regNumber: string,
): VerificationResult {
  const root = parse(html)
  const card = root.querySelector('div.card-body')

  if (!card) {
    // No registrant card — either an empty-search-results page, or something
    // we cannot read at all.
    if (NO_RESULTS_PATTERN.test(root.text)) {
      return { kind: 'not-found', registrationNumber: regNumber }
    }
    return { kind: 'ambiguous', registrationNumber: regNumber }
  }

  const cardNumber = readFieldValue(card, 'GOC Number')
  const cardStatus = readFieldValue(card, 'Registration Status')

  if (cardNumber === null || cardStatus === null) {
    // The card is there but missing the fields we depend on — escalate.
    return { kind: 'ambiguous', registrationNumber: regNumber }
  }

  if (normalizeNumber(cardNumber) !== normalizeNumber(regNumber)) {
    // The card is for a different registrant than we queried — treat the
    // queried number as not found rather than silently substituting.
    return { kind: 'not-found', registrationNumber: regNumber }
  }

  if (!ACTIVE_STATUS_PATTERN.test(cardStatus)) {
    return { kind: 'not-found', registrationNumber: regNumber }
  }

  // The registrant name lives in the card heading, e.g.
  // <h1 id="detail-title"><strong>Ethan Belson </strong> <br/><strong>D-17909</strong></h1>.
  // Take the first <strong> whose text is not the GOC number.
  const target = normalizeNumber(regNumber)
  const nameFromHeading =
    card
      .querySelectorAll('#detail-title strong, h1 strong')
      .map((node) => node.text.trim())
      .find(
        (text) => text.length > 0 && !normalizeNumber(text).includes(target),
      ) ?? ''

  return {
    kind: 'found-active',
    registrationNumber: regNumber,
    registrantName: nameFromHeading,
  }
}
