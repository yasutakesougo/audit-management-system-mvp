/**
 * SharePoint Lookup / Person フィールドから安全に文字列を取り出す。
 *
 * SP REST API が返す Lookup / Person 列は `{ Title: "...", Id: N }` 形式の
 * オブジェクトになることがある。TypeScript 上で `as string` と型主張しても
 * 実行時にはオブジェクトのまま流れ、テンプレートリテラルや `String()` で
 * `[object Object]` 化して照合キーが壊れる。
 *
 * この helper はオブジェクトの場合に Title > LookupValue > Id の優先順で
 * スカラー文字列を取り出し、プリミティブはそのまま String 化する。
 *
 * @param value - SP フィールドの生値 (string | number | object | null | undefined)
 * @returns スカラー文字列。取り出せない場合は空文字列。
 */
export const readSharePointText = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of ['Title', 'LookupValue', 'Id'] as const) {
      const v = obj[key];
      if (v != null && (typeof v === 'string' || typeof v === 'number')) {
        return String(v);
      }
    }
  }
  return '';
};
