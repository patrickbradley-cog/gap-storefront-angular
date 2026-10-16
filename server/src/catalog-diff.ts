/**
 * Compares two catalogs product-by-product (as served by the API, i.e. after
 * relational rows are reassembled). Used by the Oracle -> Postgres migration
 * verification and by tests. Returns human-readable mismatches; [] = identical.
 */
export function diffCatalogs(
  expected: Map<string, unknown>,
  actual: Map<string, unknown>,
  expectedLabel = 'expected',
  actualLabel = 'actual',
): string[] {
  const problems: string[] = [];
  for (const id of expected.keys()) {
    if (!actual.has(id)) problems.push(`product ${id}: missing from ${actualLabel}`);
  }
  for (const id of actual.keys()) {
    if (!expected.has(id)) problems.push(`product ${id}: only in ${actualLabel}`);
  }
  for (const [id, want] of expected) {
    if (!actual.has(id)) continue;
    const got = actual.get(id) as Record<string, unknown>;
    const w = want as Record<string, unknown>;
    for (const key of new Set([...Object.keys(w), ...Object.keys(got)])) {
      const a = JSON.stringify(w[key]);
      const b = JSON.stringify(got[key]);
      if (a !== b) {
        problems.push(`product ${id}.${key}: ${expectedLabel}=${a} ${actualLabel}=${b}`);
      }
    }
  }
  return problems;
}
