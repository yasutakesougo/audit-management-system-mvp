/**
 * blockNormalizer.ts — Block 正規化レイヤー（Lazy Migration）
 *
 * 責務:
 * - 旧 block 表現と新 block 表現の混在を安全に吸収する
 * - 読み込み時・表示時・抽出時にインメモリで正規化する
 * - DB / SharePoint の保存データには一切触れない
 *
 * 設計判断:
 * - pure function: 副作用なし。外部状態に依存しない
 * - idempotent: normalize(normalize(x)) ≡ normalize(x)
 * - conservative: 曖昧な本文を推測で formal block に昇格させない
 * - non-destructive: 未知 block type は pass-through する
 * - prefix paragraph は現フェーズではそのまま維持する
 *
 * フェーズ方針:
 * このフェーズでは「新旧混在でも安定して読める」ことを最優先とし、
 * prefix → formal block への自動変換は行わない。
 */
import type { MeetingMinuteBlock } from '../types';

// ──────────────────────────────────────────────────────────────
// Internal: 単一 block の正規化
// ──────────────────────────────────────────────────────────────

/**
 * 単一ブロックを正規化する。
 *
 * 現フェーズのルール:
 * 1. id が欠落 → 空文字列で補完（表示には影響しない）
 * 2. type が欠落 → 'paragraph' にフォールバック
 * 3. props が欠落 → 空オブジェクト {} で補完
 * 4. content が配列でない → 空配列 [] で補完
 * 5. children があれば再帰的に正規化
 * 6. formal block (decision / action / report / notification / nextSchedule / continuingDiscussion) はそのまま維持
 * 7. prefix paragraph はそのまま維持
 * 8. checkListItem はそのまま維持
 * 9. 未知 block type は pass-through
 */
function normalizeMeetingMinuteBlock(
  block: MeetingMinuteBlock,
): MeetingMinuteBlock {
  // null / undefined guard（型上は来ないが防御的に）
  if (!block || typeof block !== 'object') {
    return {
      id: '',
      type: 'paragraph',
      props: {},
      content: [],
      children: [],
    };
  }

  const id = typeof block.id === 'string' ? block.id : '';
  const type = typeof block.type === 'string' && block.type !== '' ? block.type : 'paragraph';
  const props = (block.props && typeof block.props === 'object' && !Array.isArray(block.props))
    ? block.props
    : {};
  const content = Array.isArray(block.content) ? block.content : [];
  const children = Array.isArray(block.children)
    ? block.children.map(normalizeMeetingMinuteBlock)
    : [];

  return { id, type, props, content, children };
}

// ──────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────

/**
 * MeetingMinuteBlock 配列を正規化する。
 *
 * - null / undefined / 非配列は空配列として返す
 * - 各 block の構造を補完し、安全にエディタ・ビューア・抽出で扱えるようにする
 * - idempotent: 2回適用しても結果は同じ
 * - pure: 引数を変更しない
 *
 * @example
 * ```ts
 * const safe = normalizeMeetingMinuteBlocks(record.contentBlocks);
 * // → safe は常に MeetingMinuteBlock[] として安全に扱える
 * ```
 */
export function normalizeMeetingMinuteBlocks(
  blocks: MeetingMinuteBlock[] | undefined | null,
): MeetingMinuteBlock[] {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .filter((b): b is MeetingMinuteBlock => b != null && typeof b === 'object')
    .map(normalizeMeetingMinuteBlock);
}

export { normalizeMeetingMinuteBlock };
