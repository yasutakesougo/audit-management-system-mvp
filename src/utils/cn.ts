type ClassValue = string | number | null | false | undefined | Record<string, boolean> | ClassValue[];

const flatten = (input: ClassValue): string[] => {
  if (Array.isArray(input)) {
    return input.flatMap(flatten);
  }
  if (typeof input === 'string' || typeof input === 'number') {
    const value = String(input).trim();
    return value ? [value] : [];
  }
  if (input && typeof input === 'object') {
    return Object.entries(input)
      .filter(([, included]) => Boolean(included))
      .map(([key]) => key.trim())
      .filter((key) => key.length > 0);
  }
  return [];
};

export function cn(...values: ClassValue[]): string {
  const classes = values.flatMap(flatten).filter(Boolean);
  return Array.from(new Set(classes)).join(' ');
}

export default cn;
