// Utility: Canonical JSON stringify + SHA-256 hashing for idempotent audit entry hashes.
// - Stable key ordering
// - Cycle safe (cycles -> null)
// - Uses Web Crypto API when available, falls back to Node webcrypto

export function canonicalJSONStringify(input: unknown): string {
  const seen = new WeakSet<object>();
  const norm = (v: unknown): unknown => {
    if (v && typeof v === 'object') {
      if (seen.has(v as object)) return null; // cycle
      seen.add(v as object);
      if (Array.isArray(v)) return v.map(norm);
      const record: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        record[k] = norm((v as Record<string, unknown>)[k]);
      }
      return record;
    }
    return v;
  };
  return JSON.stringify(norm(input));
}

export async function sha256Hex(data: string, injectedSubtle?: SubtleCrypto): Promise<string> {
  const enc = new TextEncoder().encode(data);
  // Use injected subtle (for tests), then try global crypto.subtle, then Node's webcrypto
  const subtle = injectedSubtle
    ?? (globalThis.crypto && 'subtle' in globalThis.crypto
      ? globalThis.crypto.subtle
      : (await import('crypto')).webcrypto.subtle);
  const buf = await subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Compute entry hash based on selected stable fields (idempotency surface)
export async function computeEntryHash(payload: {
  ts: string;
  actor: string;
  action: string;
  entity: string;
  entity_id?: string | null;
  after_json?: string | null;
}): Promise<string> {
  const basis = {
    ts: payload.ts,
    actor: payload.actor,
    action: payload.action,
    entity: payload.entity,
    entity_id: payload.entity_id || '',
    after_json: payload.after_json || ''
  };
  return sha256Hex(canonicalJSONStringify(basis));
}
