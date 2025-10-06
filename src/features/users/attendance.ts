const normalizeFromString = (input: string): string[] => {
  const parts = input
    .split(/[,\s、\n]+/u)
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set(parts));
};

export function normalizeAttendanceDays(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    if (value.every((entry) => typeof entry === 'string')) {
      return value.map((entry) => entry.trim()).filter(Boolean);
    }
    return [];
  }

  if (typeof value === 'string') {
    return normalizeFromString(value);
  }

  return [];
}

export default normalizeAttendanceDays;
