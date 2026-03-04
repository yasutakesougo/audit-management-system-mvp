export function getNow(): Date { return new Date(); }
export default getNow;

/**
 * Return a date as `YYYY-MM-DD` in the **local timezone**.
 *
 * ⚠️ DO NOT use `date.toISOString().slice(0, 10)` — that returns the
 *    UTC date, which is **one day behind** in JST (UTC+9) from 0:00–8:59.
 *
 * @param date  Defaults to `new Date()` (now)
 */
export function toLocalDateISO(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
