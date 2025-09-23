// Shared UUID helper with layered fallbacks.
// Order:
// 1. Injected implementation (for tests)
// 2. globalThis.crypto.randomUUID (native)
// 3. crypto.getRandomValues based RFC4122 v4 generation
// 4. Math.random based (least strong; last resort)

export interface SafeUUIDOptions {
  randomUUID?: () => string;
}

export function safeRandomUUID(opts?: SafeUUIDOptions): string {
  if (opts?.randomUUID) return opts.randomUUID();
  const cr = (globalThis as unknown as { crypto?: { randomUUID?: () => string; getRandomValues?: (buf: Uint8Array) => Uint8Array } }).crypto;
  if (cr?.randomUUID) return cr.randomUUID();
  if (cr?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cr.getRandomValues(bytes);
    // Per RFC 4122 section 4.4
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xxxxxx
    const hex: string[] = [];
    for (let i = 0; i < 256; i++) hex.push((i + 0x100).toString(16).slice(1));
    return (
      hex[bytes[0]] + hex[bytes[1]] + hex[bytes[2]] + hex[bytes[3]] + '-' +
      hex[bytes[4]] + hex[bytes[5]] + '-' +
      hex[bytes[6]] + hex[bytes[7]] + '-' +
      hex[bytes[8]] + hex[bytes[9]] + '-' +
      hex[bytes[10]] + hex[bytes[11]] + hex[bytes[12]] + hex[bytes[13]] + hex[bytes[14]] + hex[bytes[15]]
    );
  }
  // Math.random fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}


