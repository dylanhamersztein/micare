// Bridges a rendered component to the stylesheet a browser would apply to it.
// jsdom resolves neither `var()` nor Tailwind's utilities, so asserting on
// `getComputedStyle` would prove nothing; instead these helpers compile
// `src/styles.css` for exactly the classes a component rendered and hand back
// the literal declarations. A test can then assert the pixels, not the class
// string.

import {
  compileStyles,
  customProperties,
  resolveVariables,
} from './design-system'

/** Escapes a Tailwind class into the form it takes inside a CSS selector. */
function escapeClass(className: string): string {
  return className.replace(/[^\w-]/g, (character) => `\\${character}`)
}

/** Every class used anywhere in the element's tree, deduplicated. */
export function classesWithin(element: Element): Array<string> {
  const classes = new Set<string>()

  for (const node of [element, ...element.querySelectorAll('*')]) {
    for (const className of node.classList) classes.add(className)
  }

  return [...classes]
}

/** Compiles the stylesheet covering every class the elements' trees use. */
export function compileStylesFor(
  ...elements: ReadonlyArray<Element>
): Promise<string> {
  return compileStyles(elements.flatMap(classesWithin))
}

/**
 * The body of the first rule whose selector matches, brace-balanced so a
 * nested variant block comes back whole. Tailwind v4 nests its variants —
 * `.disabled\:bg-disabled { &:disabled { … } }` — which a non-recursive
 * `[^}]*` match would read straight through.
 */
function ruleBody(css: string, selector: string): string | undefined {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const opening = new RegExp(`(^|\\s)${escaped}\\s*\\{`, 'm').exec(css)

  if (opening === null) return undefined

  const start = opening.index + opening[0].length
  let depth = 1

  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) return css.slice(start, i)
  }

  return undefined
}

/** The declarations directly in a rule body, with `var()` references resolved. */
function ownDeclarations(css: string, body: string): Record<string, string> {
  // A custom property the rule sets itself wins over the same name declared
  // anywhere else — which is how Tailwind's composed utilities work: the
  // `tabular-nums` rule sets `--tw-numeric-spacing` beside the
  // `font-variant-numeric` that reads it, over a global reset to `initial`.
  const properties = customProperties(css)
  const declarations: Record<string, string> = {}

  for (const [property, value] of ownLines(body)) {
    if (property.startsWith('--')) properties.set(property, value)
  }

  for (const [property, value] of ownLines(body)) {
    declarations[property] = resolveVariables(value, properties)
  }

  return declarations
}

/**
 * The property/value pairs at the top level of a rule body. A nested `&:hover`
 * block belongs to the hover state, not to the resting element, so its
 * declarations are skipped.
 */
function ownLines(body: string): Array<[string, string]> {
  const lines: Array<[string, string]> = []
  let depth = 0

  for (const line of body.split('\n')) {
    const declaration =
      depth === 0 ? /^\s*([\w-]+):\s*([^;{]+);/.exec(line) : null

    if (declaration !== null) lines.push([declaration[1], declaration[2]])

    depth += (line.match(/\{/g) ?? []).length
    depth -= (line.match(/\}/g) ?? []).length
  }

  return lines
}

/**
 * The declarations the element's own classes resolve to, merged in the order
 * they appear. Variant classes (`hover:`, `disabled:`) are skipped — they only
 * paint in their state, which `variantDeclarations` reads.
 */
export function declarationsFor(
  css: string,
  element: Element,
): Record<string, string> {
  const declarations: Record<string, string> = {}

  for (const className of element.classList) {
    if (className.includes(':')) continue

    const body = ruleBody(css, `.${escapeClass(className)}`)
    if (body !== undefined)
      Object.assign(declarations, ownDeclarations(css, body))
  }

  return declarations
}

/**
 * The declarations a Tailwind variant adds — `disabled`, `hover`,
 * `focus-visible`, `aria-invalid`. A variant compiles to a chain of nested
 * blocks inside its class rule — `hover:` is `&:hover` wrapped again in
 * `@media (hover: hover)` — so the declarations live at the bottom of the
 * chain, whatever selectors it is made of.
 */
export function variantDeclarations(
  css: string,
  element: Element,
  variant: string,
): Record<string, string> {
  const declarations: Record<string, string> = {}

  for (const className of element.classList) {
    if (!className.startsWith(`${variant}:`)) continue

    const body = ruleBody(css, `.${escapeClass(className)}`)
    if (body === undefined) continue

    Object.assign(declarations, ownDeclarations(css, innermost(body)))
  }

  return declarations
}

/** Descends through wrapper blocks to the one that carries the declarations. */
function innermost(body: string): string {
  let current = body

  while (ownLines(current).length === 0) {
    const nested = /\{([\s\S]*)\}/.exec(current)

    if (nested === null) return current

    current = nested[1]
  }

  return current
}

/**
 * A CSS length in pixels, at the browser's default root font size. Handles the
 * `calc(<length> * <factor>)` shape Tailwind emits for its scaled and negated
 * utilities as well as a bare length.
 */
export function lengthInPx(value: string): number {
  const scaled = /^calc\(\s*(-?[\d.]+)(px|rem)\s*\*\s*(-?[\d.]+)\s*\)$/.exec(
    value,
  )

  if (scaled !== null) {
    return toPx(Number(scaled[1]), scaled[2]) * Number(scaled[3])
  }

  const bare = /^(-?[\d.]+)(px|rem)$/.exec(value)

  if (bare === null) throw new Error(`expected a CSS length, got "${value}"`)

  return toPx(Number(bare[1]), bare[2])
}

/** The browser default every rem-based token is calibrated against. */
const DEFAULT_ROOT_FONT_SIZE_PX = 16

function toPx(amount: number, unit: string): number {
  return unit === 'rem' ? amount * DEFAULT_ROOT_FONT_SIZE_PX : amount
}
