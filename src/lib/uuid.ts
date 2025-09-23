// Shared UUID helper with crypto.randomUUID fallback
// Provides consistent behavior across browser, Node, and test environments.
export function safeRandomUUID(): string {
  const cr = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cr?.randomUUID) return cr.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
