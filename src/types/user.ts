const sanitizeString = (value: string | null | undefined) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const toNullable = (value: string | null | undefined) => {
  const sanitized = sanitizeString(value ?? undefined);
  return sanitized ?? null;
};

const toNullableBoolean = (value: boolean | null | undefined) => {
  if (value === undefined) return null;
  return value ?? null;
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
  payload.Title = sanitizeString(input.Title) ?? '';
  if (Object.prototype.hasOwnProperty.call(input, 'Furigana')) {
    payload.Furigana = toNullable(input.Furigana ?? undefined);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'Phone')) {
    payload.Phone = toNullable(input.Phone ?? undefined);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'Email')) {
    payload.Email = toNullable(input.Email ?? undefined);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'IsActive')) {
    payload.IsActive = toNullableBoolean(input.IsActive ?? undefined);
  }
  return payload;
}
