import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { compile } from 'tailwindcss'

const require = createRequire(import.meta.url)

const stylesheetPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../src/styles.css',
)

async function loadStylesheet(id: string, base: string) {
  const resolved = id.startsWith('.')
    ? path.resolve(base, id)
    : require.resolve(id === 'tailwindcss' ? 'tailwindcss/index.css' : id, {
        paths: [base],
      })

  return {
    path: resolved,
    base: path.dirname(resolved),
    content: await readFile(resolved, 'utf8'),
  }
}

/**
 * Compiles `src/styles.css` the way the app's Tailwind plugin does, asking for
 * the given utility classes. Returns the stylesheet a browser would receive.
 */
export async function compileStyles(
  candidates: ReadonlyArray<string>,
): Promise<string> {
  const source = await readFile(stylesheetPath, 'utf8')
  const compiler = await compile(source, {
    base: path.dirname(stylesheetPath),
    loadStylesheet,
  })

  return compiler.build([...candidates])
}

function indexOfTopLevelComma(value: string): number {
  let depth = 0

  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++
    else if (value[i] === ')') depth--
    else if (value[i] === ',' && depth === 0) return i
  }

  return -1
}

/** Substitutes `var(--token, fallback)` references until a literal value remains. */
function resolveVariables(
  value: string,
  variables: Map<string, string>,
): string {
  const start = value.indexOf('var(')
  if (start === -1) return value.trim()

  let depth = 0
  let end = start + 3

  for (; end < value.length; end++) {
    if (value[end] === '(') depth++
    else if (value[end] === ')' && --depth === 0) break
  }

  const inner = value.slice(start + 4, end)
  const comma = indexOfTopLevelComma(inner)
  const name = (comma === -1 ? inner : inner.slice(0, comma)).trim()
  const fallback = comma === -1 ? '' : inner.slice(comma + 1).trim()
  // A custom property set to `initial` is guaranteed-invalid, so `var()` falls
  // back. Tailwind seeds its own `--tw-*` properties that way.
  const declared = variables.get(name)
  const replacement =
    declared === undefined || declared === 'initial' ? fallback : declared

  return resolveVariables(
    value.slice(0, start) + replacement + value.slice(end + 1),
    variables,
  )
}

/** Every custom property the stylesheet declares, keyed by token name. */
export function customProperties(css: string): Map<string, string> {
  const properties = new Map<string, string>()

  for (const [, name, value] of css.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)) {
    properties.set(name, value.replace(/\s+/g, ' ').trim())
  }

  return properties
}

/** The value a design token resolves to, following any `var()` indirection. */
export function tokenValue(css: string, token: string): string | undefined {
  const properties = customProperties(css)
  const declared = properties.get(token)

  return declared === undefined
    ? undefined
    : resolveVariables(declared, properties)
}

/**
 * The declarations a rule produces, with design tokens resolved to the literal
 * values a browser would paint. Empty when nothing matches the selector.
 */
export function ruleDeclarations(
  css: string,
  selector: string,
  within: string = css,
): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rule = new RegExp(`^\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm').exec(within)

  if (rule === null) return {}

  const properties = customProperties(css)
  const declarations: Record<string, string> = {}

  for (const [, property, value] of rule[1].matchAll(/([\w-]+):\s*([^;]+);/g)) {
    declarations[property] = resolveVariables(value, properties)
  }

  return declarations
}

/** Every rule that sets the given property, paired with its selector. */
export function rulesSetting(
  css: string,
  property: string,
): Array<{ selector: string; value: string }> {
  const rules: Array<{ selector: string; value: string }> = []

  for (const [, selector, block] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const value = new RegExp(`(?:^|;)\\s*${property}:\\s*([^;]+)`).exec(block)

    if (value !== null) {
      rules.push({ selector: selector.trim(), value: value[1].trim() })
    }
  }

  return rules
}

/** The declarations a utility class produces. */
export function utilityDeclarations(
  css: string,
  utility: string,
): Record<string, string> {
  return ruleDeclarations(css, `.${utility}`)
}

/** The browser default every `--text-*` token is calibrated against. */
const DEFAULT_ROOT_FONT_SIZE_PX = 16

/**
 * The pixel size a rem length renders at when the root font-size is left at the
 * browser's default — the condition the design's type scale assumes.
 */
export function pxAtDefaultRoot(value: string): number {
  // Spacing utilities arrive as `calc(0.25rem * 6)`; everything else is a
  // bare rem length.
  const scaled = /^calc\(\s*(-?[\d.]+)rem\s*\*\s*(-?[\d.]+)\s*\)$/.exec(value)

  if (scaled !== null) {
    return Number(scaled[1]) * Number(scaled[2]) * DEFAULT_ROOT_FONT_SIZE_PX
  }

  const rem = /^(-?[\d.]+)rem$/.exec(value)

  if (rem === null) {
    throw new Error(`expected a rem length, got "${value}"`)
  }

  return Number(rem[1]) * DEFAULT_ROOT_FONT_SIZE_PX
}

export type FontFace = { family: string; sources: ReadonlyArray<string> }

/** Every `@font-face` the stylesheet declares, with the URLs it points at. */
export function fontFaces(css: string): Array<FontFace> {
  const faces: Array<FontFace> = []

  for (const [, block] of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const family = /font-family:\s*([^;]+);/.exec(block)?.[1].trim()

    if (family === undefined) continue

    faces.push({
      family: family.replace(/^['"]|['"]$/g, ''),
      sources: [...block.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map(
        ([, url]) => url,
      ),
    })
  }

  return faces
}

/** The body of an `@media` block, or an empty string when there is none. */
export function mediaQueryBody(css: string, condition: string): string {
  const start = css.indexOf(`@media ${condition}`)
  if (start === -1) return ''

  const open = css.indexOf('{', start)
  let depth = 0

  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i)
  }

  return ''
}
