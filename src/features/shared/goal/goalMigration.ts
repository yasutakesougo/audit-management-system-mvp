/**
 * 目標データ マイグレーション (v2 → v3)
 *
 * support-plan-guide の v2 フリーテキスト (string) を
 * 構造化された GoalItem[] に一方向変換する。
 *
 * ⚠ 不可逆変換: v3 → v2 への逆変換は意図的に提供しない。
 */
import type { GoalItem } from './goalTypes';

/**
 * 箇条書きプレフィックスを除去する正規表現
 *
 * マッチするパターン:
 *   ・ / ● / ▪ / ▸ / ◦ (全角記号)
 *   - / * (半角記号)
 *   1. / 2) / ① 等 (番号付き)
 */
const BULLET_PREFIX = /^[\s]*(?:[・●▪▸◦\-*]|(?:\d+[.)）]|[①-⑳]))\s*/;

/**
 * テキストを意味のある行に分割する。
 *
 * 分割ルール:
 *   1. 改行 (\n) で分割
 *   2. 各行の先頭にある箇条書きプレフィックスを除去
 *   3. 空白行は除外
 */
function splitLines(text: string): string[] {
  return text
    .split(/\n/)
    .map((line) => line.replace(BULLET_PREFIX, '').trim())
    .filter((line) => line.length > 0);
}

/**
 * v2 フリーテキストを GoalItem[] に変換する。
 *
 * @param text         - v2 のフリーテキスト値 (空文字・undefined 許容)
 * @param type         - 目標種別 ('long' | 'short' | 'support')
 * @param defaultLabel - GoalItem.label に設定するラベル文言
 * @returns GoalItem[] — 空テキストの場合は空配列
 *
 * @example
 * ```ts
 * migrateV2TextToGoals(
 *   '週3回以上、創作活動に参加する\n朝の会で挨拶する',
 *   'short',
 *   '短期目標',
 * );
 * // => [
 * //   { id: '<uuid>', type: 'short', label: '短期目標①', text: '週3回以上、創作活動に参加する', domains: [] },
 * //   { id: '<uuid>', type: 'short', label: '短期目標②', text: '朝の会で挨拶する', domains: [] },
 * // ]
 * ```
 */
export function migrateV2TextToGoals(
  text: string | undefined,
  type: GoalItem['type'],
  defaultLabel: string,
): GoalItem[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const lines = splitLines(text);

  return lines.map((line, index): GoalItem => {
    // 複数行の場合のみ連番サフィックスを付与
    const suffix = lines.length > 1 ? toCircledNumber(index + 1) : '';

    return {
      id: crypto.randomUUID(),
      type,
      label: `${defaultLabel}${suffix}`,
      text: line,
      domains: [],   // マイグレーション時点ではドメイン未設定
    };
  });
}

/**
 * 数値を丸付き数字に変換する (1→①, 2→②, ...)
 * 20を超える場合は普通の数字を使用
 */
function toCircledNumber(n: number): string {
  const circled = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';
  if (n >= 1 && n <= 20) return circled[n - 1];
  return String(n);
}
