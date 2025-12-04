const padSeed = (seed: number): string => String(seed).padStart(4, '0');

export const formatLocalUserId = (seed: number): string => `LOCAL-U-${padSeed(seed)}`;

export const ensureUserId = (explicit: string | null | undefined, seed: number): string => {
  const trimmed = explicit?.trim();
  if (trimmed) {
    return trimmed;
  }
  return formatLocalUserId(seed);
};
