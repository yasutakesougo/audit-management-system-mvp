export function normalizeSharePointBearerToken(rawToken: string | undefined): string | null {
  const normalized = rawToken
    ?.trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/\s+/g, '');

  return normalized ? normalized : null;
}
