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
    const v = toNullable(input.Furigana ?? undefined);
    payload.Furigana = v; // canonical (PascalCase)
    payload.furigana = v; // provisioned (lowercase)
  }
  if (Object.prototype.hasOwnProperty.call(input, 'Phone')) {
    const v = toNullable(input.Phone ?? undefined);
    payload.Phone = v;
    payload.phone = v;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'Email')) {
    const v = toNullable(input.Email ?? undefined);
    payload.Email = v;
    payload.email = v;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'IsActive')) {
    const v = toNullableBoolean(input.IsActive ?? undefined);
    payload.IsActive = v;
    // SharePoint boolean nullability: send explicit null when absent/empty
    payload.isActive = v as boolean | null;
  }
  return payload;
}
