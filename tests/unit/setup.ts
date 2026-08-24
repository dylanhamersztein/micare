// Component tests opt into a DOM with a `@vitest-environment jsdom` docblock;
// the rest of the unit suite stays on node, where importing React Testing
// Library would fail. Hence the guard: register the unmount only where there
// is a document to unmount from. Without it, one test's markup is still in the
// body when the next one queries it.
import { afterEach } from 'vitest'

if (typeof document !== 'undefined') {
  const { cleanup } = await import('@testing-library/react')
  afterEach(cleanup)
}
