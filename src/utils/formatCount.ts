export function formatCount(total: number, filtered: number = total): string {
  if (!Number.isFinite(total)) {
    return '0件';
  }
  const normalizedTotal = Math.max(0, Math.trunc(total));
  const normalizedFiltered = Math.max(0, Math.trunc(filtered));
  if (normalizedTotal === normalizedFiltered) {
    return `${normalizedTotal}件`;
  }
  return `${normalizedFiltered}件 / 全${normalizedTotal}件`;
}
