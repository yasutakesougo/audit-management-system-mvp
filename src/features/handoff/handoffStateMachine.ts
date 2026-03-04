/**
 * 申し送りステータス状態マシン
 *
 * 6段階ステータス × 3モード（normal / evening / morning）の遷移ルールを管理。
 * UI層は getAllowedActions() の戻り値でボタンを描画する（ゼロ計算）。
 */

import type { HandoffStatus, MeetingMode } from './handoffTypes';

// ────────────────────────────────────────────────────────────
// ステータス表示用メタデータ
// ────────────────────────────────────────────────────────────

/** ステータス表示用メタデータ（日本語ラベル対応） */
export const HANDOFF_STATUS_META: Record<HandoffStatus, { label: string; icon: string; color: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' }> = {
  '未対応': { label: '未対応', icon: '📝', color: 'default' },
  '対応中': { label: '対応中', icon: '⏳', color: 'warning' },
  '対応済': { label: '完了', icon: '✅', color: 'success' },   // UI統一: 「完了」表示
  '確認済': { label: '確認済', icon: '👀', color: 'info' },     // v3: 夕会確認
  '明日へ持越': { label: '明日へ', icon: '📅', color: 'warning' }, // v3: 朝会送り
  '完了': { label: '完了', icon: '✅', color: 'success' },       // v3: UI上は対応済と同等
};

// ────────────────────────────────────────────────────────────
// 遷移ロジック
// ────────────────────────────────────────────────────────────

/** 状態を次のステップに進めるヘルパー（従来フロー: normal モード用） */
export function getNextStatus(current: HandoffStatus): HandoffStatus {
  if (current === '未対応') return '対応中';
  if (current === '対応中') return '対応済';
  return '未対応'; // 対応済 → 未対応へ戻る
}

/**
 * 終端ステータスの判定
 * v3 状態マシン: `対応済` と `完了` が終端
 * 注意: `明日へ持越` は終端ではない（朝会で `完了` へ遷移する）
 */
export function isTerminalStatus(status: HandoffStatus): boolean {
  return status === '対応済' || status === '完了';
}

/**
 * モード別の許可遷移を返す関数
 * UI層はこの関数の戻り値でボタンを描画する（ゼロ計算）
 *
 * v3 状態マシン:
 *   未対応 → 確認済 (夕会) / 対応中 (従来)
 *   対応中 → 対応済 (従来)
 *   確認済 → 明日へ持越 / 完了 (夕会)
 *   明日へ持越 → 完了 (朝会)
 *   対応済 / 完了 → (終端、リオープンは管理者のみ)
 */
export function getAllowedActions(
  status: HandoffStatus,
  mode: MeetingMode
): HandoffStatus[] {
  // 終端ステータスはアクションなし
  if (isTerminalStatus(status)) return [];

  switch (mode) {
    case 'evening':
      if (status === '未対応') return ['確認済', '完了'];
      if (status === '確認済') return ['明日へ持越', '完了'];
      if (status === '対応中') return ['対応済'];
      return [];

    case 'morning':
      if (status === '明日へ持越') return ['完了'];
      if (status === '未対応') return ['完了'];
      if (status === '確認済') return ['完了'];
      if (status === '対応中') return ['対応済'];
      return [];

    case 'normal':
    default:
      // 従来のトグルサイクル
      if (status === '未対応') return ['対応中'];
      if (status === '対応中') return ['対応済'];
      // 新規ステータスが normal で表示された場合のフォールバック
      if (status === '確認済') return ['完了'];
      if (status === '明日へ持越') return ['完了'];
      return [];
  }
}
