/**
 * 国保連CSV — エンコーディング
 *
 * encoding-japanese で UTF-8 文字列 → Shift_JIS バイト列に変換。
 * 純粋関数（DOM不要）なのでテスト可能。
 */
import Encoding from 'encoding-japanese';

/**
 * UTF-8 文字列 → Shift_JIS の Uint8Array
 *
 * 国保連CSVは Shift_JIS 必須のため、
 * ブラウザの TextEncoder（UTF-8専用）では対応できない。
 */
export function encodeToSjis(text: string): Uint8Array {
  // 文字列 → Unicode コードポイント配列
  const unicodeArray = Encoding.stringToCode(text);

  // Unicode → Shift_JIS 変換
  const sjisArray = Encoding.convert(unicodeArray, {
    to: 'SJIS',
    from: 'UNICODE',
  });

  return new Uint8Array(sjisArray);
}
