const sanitizeString = (value: string | null | undefined): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toNullable = (value: string | null | undefined): string | null => {
  const sanitized = sanitizeString(value);
  return sanitized ?? null;
};

const toNullableBoolean = (value: boolean | null | undefined): boolean | null => {
  if (value === undefined || value === null) return null;
  return value; // true または false
};

export type UserUpsert = {
  Title: string;
  Furigana?: string | null;
  Phone?: string | null;
  Email?: string | null;
  IsActive?: boolean | null;
};

export function toUserItem(input: UserUpsert): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  // Title は必須だが、sanitize して無ければ空文字
  const title = sanitizeString(input.Title);
  payload.Title = title ?? '';

  if ('Furigana' in input) {
    payload.Furigana = toNullable(input.Furigana);
  }
  if ('Phone' in input) {
    payload.Phone = toNullable(input.Phone);
  }
  if ('Email' in input) {
    payload.Email = toNullable(input.Email);
  }
  if ('IsActive' in input) {
    payload.IsActive = toNullableBoolean(input.IsActive);
  }

  return payload;
}
