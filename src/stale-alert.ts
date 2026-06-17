// Pure half of the daily stale-verification alert (ADR-0007). The
// StalePractitioner shape and the human-readable digest body. No server or
// env imports so it can be unit-tested and, if ever needed, shared with the
// browser. The DB query and delivery live in src/server/.

export type StalePractitioner = {
  id: string
  short_id: string
  full_name: string
  last_verified_at: Date | null
}

export function formatStaleAlertText(
  stale: ReadonlyArray<StalePractitioner>,
  thresholdDays: number,
): string {
  const header = `${stale.length} visible practitioner(s) not re-verified in over ${thresholdDays} days:`
  const lines = stale.map((p) => {
    const when = p.last_verified_at
      ? p.last_verified_at.toISOString()
      : 'never'
    return `- ${p.short_id} ${p.full_name} (last verified: ${when})`
  })
  return [header, ...lines].join('\n')
}
