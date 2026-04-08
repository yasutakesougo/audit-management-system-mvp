/**
 * Japanese Name Collator and Sorting Utilities
 * 
 * Provides unified sorting logic for Japanese names across the application.
 * Rules:
 * 1. Primary: Kana (Furigana || FullNameKana || FullName)
 * 2. Secondary: Display Name (FullName)
 * 3. Tertiary: Stable ID (UserID || String(Id))
 */

export const japaneseNameCollator = new Intl.Collator('ja-JP', {
  sensitivity: 'base',
  numeric: true,
});

/**
 * Normalizes input to a string, trimmed.
 */
function normalize(val: string | number | undefined | null): string {
  if (val == null) return '';
  return String(val).trim();
}

export function getUserKanaLike(user: {
  Furigana?: string | null;
  FullNameKana?: string | null;
  FullName?: string | null;
}) {
  return normalize(user.Furigana || user.FullNameKana || user.FullName);
}

export function getUserDisplayName(user: {
  FullName?: string | null;
}) {
  return normalize(user.FullName);
}

export function getUserStableId(user: {
  UserID?: string | null;
  Id?: string | number | null;
}) {
  return normalize(user.UserID || user.Id);
}

/**
 * Common comparison function for users following Japanese sorting conventions.
 */
export function compareUsersByJapaneseOrder(
  a: {
    Furigana?: string | null;
    FullNameKana?: string | null;
    FullName?: string | null;
    UserID?: string | null;
    Id?: string | number | null;
  },
  b: {
    Furigana?: string | null;
    FullNameKana?: string | null;
    FullName?: string | null;
    UserID?: string | null;
    Id?: string | number | null;
  }
) {
  const byKana = japaneseNameCollator.compare(getUserKanaLike(a), getUserKanaLike(b));
  if (byKana !== 0) return byKana;

  const byName = japaneseNameCollator.compare(getUserDisplayName(a), getUserDisplayName(b));
  if (byName !== 0) return byName;

  return japaneseNameCollator.compare(getUserStableId(a), getUserStableId(b));
}

/**
 * Checks if a user matches a search query across multiple fields.
 */
export function userMatchesQuery(
  user: {
    Furigana?: string | null;
    FullNameKana?: string | null;
    FullName?: string | null;
    UserID?: string | null;
    Id?: string | number | null;
  },
  query: string
): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const fields = [
    user.Furigana,
    user.FullNameKana,
    user.FullName,
    user.UserID,
    user.Id != null ? String(user.Id) : null,
  ];

  return fields.some((field) => 
    field != null && field.trim().toLowerCase().includes(normalizedQuery)
  );
}

