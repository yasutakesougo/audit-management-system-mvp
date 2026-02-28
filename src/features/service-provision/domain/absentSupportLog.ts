/**
 * AbsentSupportLog — 欠席時対応ログの型定義 + Note埋め込みフォーマッタ
 *
 * 2セクション構造:
 *   ① 欠席連絡受け入れ（受電4項目）
 *   ② 様子伺い・夕方連絡（3項目 + 結果choice）
 *   + 次回利用予定日
 */

// ─── 型 ────────────────────────────────────────────────

/** ②様子伺いの結果 */
export type FollowUpResult = '実施' | '不通' | '不要';

export interface AbsentSupportLog {
  // ① 欠席連絡受け入れ
  /** 受電日時（ISO文字列 or "HH:mm" — UIに任せる） */
  contactDateTime: string;
  /** 連絡者（相手） */
  contactPerson: string;
  /** 欠席理由 */
  absenceReason: string;
  /** 対応内容（相談援助） */
  supportContent: string;

  // ② 様子伺い（夕方連絡）
  /** 連絡日時 */
  followUpDateTime: string;
  /** 連絡先 */
  followUpTarget: string;
  /** 確認内容 */
  followUpContent: string;
  /** 結果（実施/不通/不要） */
  followUpResult: FollowUpResult;

  // 共通
  /** 次回利用予定日（YYYY-MM-DD） */
  nextPlannedDate: string;
  /** 対応職員ID（Staff_Master.StaffId 形式） */
  staffInChargeId?: string;
}

// ─── 空ログ ─────────────────────────────────────────────

export const EMPTY_ABSENT_LOG: AbsentSupportLog = {
  contactDateTime: '',
  contactPerson: '',
  absenceReason: '',
  supportContent: '',
  followUpDateTime: '',
  followUpTarget: '',
  followUpContent: '',
  followUpResult: '実施',
  nextPlannedDate: '',
  staffInChargeId: '',
};

// ─── Note フォーマッタ ─────────────────────────────────

/**
 * AbsentSupportLog → Note テンプレ文字列
 *
 * 空フィールドは（未入力）と表示。
 * 票面備考欄に転記するときはこの出力をそのまま使える。
 */
export function formatAbsentSupportNote(log: AbsentSupportLog): string {
  const or = (v: string) => v.trim() || '（未入力）';
  const lines: string[] = [
    '[欠席時対応]',
    `■受電: ${or(log.contactDateTime)} / 連絡者: ${or(log.contactPerson)}`,
    `理由: ${or(log.absenceReason)}`,
    `援助: ${or(log.supportContent)}`,
    `■様子伺い: ${or(log.followUpDateTime)} / 連絡先: ${or(log.followUpTarget)} [${log.followUpResult}]`,
    `確認: ${or(log.followUpContent)}`,
    `次回: ${or(log.nextPlannedDate)}`,
  ];
  return lines.join('\n');
}

/**
 * ユーザーメモ + 欠席時対応ログ → 最終 Note
 *
 * ログがある場合、ユーザーメモの前にログを配置し、区切り線で分ける。
 */
export function buildNoteWithAbsentLog(
  userMemo: string,
  log: AbsentSupportLog | null,
): string {
  if (!log) return userMemo.trim();
  const logText = formatAbsentSupportNote(log);
  const memo = userMemo.trim();
  if (!memo) return logText;
  return `${logText}\n---\n${memo}`;
}

/**
 * 票面備考欄用の短縮フォーマット（Excel セル幅対策）
 * 最大3行まで。
 */
export function formatAbsentSupportBrief(log: AbsentSupportLog): string {
  const lines: string[] = [];
  if (log.contactDateTime || log.contactPerson) {
    lines.push(`受電:${log.contactDateTime} ${log.contactPerson} 理由:${log.absenceReason}`);
  }
  if (log.followUpDateTime || log.followUpResult !== '実施') {
    lines.push(`伺い:${log.followUpDateTime} [${log.followUpResult}] ${log.followUpContent}`.trim());
  }
  if (log.nextPlannedDate) {
    lines.push(`次回:${log.nextPlannedDate}`);
  }
  return lines.join(' / ');
}
