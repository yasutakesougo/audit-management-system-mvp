export async function withRetry<T>(fn: () => Promise<T>, opts: { retries?: number; baseMs?: number } = {}): Promise<T> {
  const retries = opts.retries ?? 3;
  const base = opts.baseMs ?? 400;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries) {
        break;
      }
      const delay = base * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
}
