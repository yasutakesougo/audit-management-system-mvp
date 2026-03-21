/**
 * buildHighLoadTileViewModel — HighLoadWarning[] → Today タイル用 ViewModel 変換
 *
 * 純関数。Schedule Ops の高負荷警告データを
 * Today ページの1行サマリータイル用に圧縮する。
 *
 * 設計方針:
 * - 0件 → visible: false（タイルごと非表示）
 * - 1件以上 → スコア降順で最重要日を選出
 * - 理由文言は computeHighLoadReasons() の返却順をUI契約として扱う
 * - 理由が空の場合は '高負荷' にフォールバック
 *
 * @see OpsHighLoadWarningBanner — Schedule Ops 内のフル表示版
 * @see TodayBentoLayout — 消費先
 */

import type { HighLoadWarning } from '@/features/schedules/domain/scheduleOpsLoadScore';

// ── Date Formatter ───────────────────────────────────────────

const TILE_DATE_FORMATTER = new Intl.DateTimeFormat('ja-JP', {
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
});

function formatTileDate(dateIso: string): string {
  const d = new Date(dateIso + 'T00:00:00');
  return TILE_DATE_FORMATTER.format(d);
}

// ── Types ────────────────────────────────────────────────────

export type HighLoadTileViewModel =
  | {
      readonly visible: true;
      /** 対象日数 */
      readonly dayCount: number;
      /** 最重要警告日（スコア最大） */
      readonly topWarning: {
        readonly dateIso: string;
        /** "3/24(月)" 形式 */
        readonly dateLabel: string;
        readonly level: 'high' | 'critical';
        /** reasons[0].label ?? '高負荷' */
        readonly topReasonLabel: string;
        readonly score: number;
      };
      /** critical が含まれるか */
      readonly hasCritical: boolean;
    }
  | {
      readonly visible: false;
    };

// ── Main Function ────────────────────────────────────────────

/**
 * HighLoadWarning[] を Today タイル用 ViewModel に変換する。
 *
 * @param warnings - computeHighLoadWarnings() の結果
 * @returns HighLoadTileViewModel
 */
export function buildHighLoadTileViewModel(
  warnings: readonly HighLoadWarning[],
): HighLoadTileViewModel {
  if (warnings.length === 0) {
    return { visible: false };
  }

  // スコア降順ソート（最重要日が先頭）
  const sorted = [...warnings].sort((a, b) => b.score - a.score);
  const top = sorted[0]!;

  return {
    visible: true,
    dayCount: warnings.length,
    topWarning: {
      dateIso: top.dateIso,
      dateLabel: formatTileDate(top.dateIso),
      level: top.level,
      topReasonLabel: top.reasons[0]?.label ?? '高負荷',
      score: top.score,
    },
    hasCritical: sorted.some((w) => w.level === 'critical'),
  };
}
