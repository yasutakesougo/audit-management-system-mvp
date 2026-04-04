/**
 * @fileoverview 日次記録1行の初期化・同期・補完ルール
 *
 * @description
 * 行の生成と既存行への補完を pure function として定義する。
 * React / hook の事情は一切持たず、ビジネスルールのみ。
 *
 * Phase 1 対象:
 * - createEmptyRow      … 1行の初期データ生成（Issue #1）
 * - syncRowsWithSelectedUsers … 選択ユーザーに基づく行の再構成（Issue #3）
 * - applyHandoffNotesToRows   … 空 specialNotes への handoff 注入（Issue #3）
 * - shouldPrefillSpecialNotes … handoff 注入のポリシー判定（Issue #3）
 */

import type { UserRowData } from '../../hooks/view-models/useTableDailyRecordForm';
import type { LastActivities } from '../../hooks/legacy/useLastActivities';

// ─── Types ──────────────────────────────────────────────

// contract:allow-interface — 関数パラメータ型、domain entity ではない
export type CreateEmptyRowOptions = {
  /** 申し送りから取得した特記事項テキスト */
  handoffNote?: string;
  /** 前回の午前・午後活動データ */
  lastActivities?: LastActivities | null;
};

// ─── Row Initialization ─────────────────────────────────

/**
 * 日次記録1行の初期データを生成する。
 *
 * 初期化規約:
 * - 前回活動がある場合は am/pm をプリフィル
 * - handoff note がある場合は specialNotes に注入
 * - それ以外は全て空/false
 *
 * @param userId ユーザー識別子
 * @param userName ユーザー表示名
 * @param options 前回活動・申し送りによる初期値設定
 */
export function createEmptyRow(
  userId: string,
  userName: string,
  options?: CreateEmptyRowOptions,
): UserRowData {
  return {
    userId,
    userName,
    amActivity: options?.lastActivities?.amActivity ?? '',
    pmActivity: options?.lastActivities?.pmActivity ?? '',
    lunchAmount: '',
    problemBehavior: {
      selfHarm: false,
      otherInjury: false,
      loudVoice: false,
      pica: false,
      other: false,
    },
    specialNotes: options?.handoffNote ?? '',
    behaviorTags: [],
  };
}

// ─── Row Content Check ──────────────────────────────────

/**
 * 行に入力内容が存在するか判定する。
 * 未送信フィルタや送信件数の算出に使用。
 */
export function hasRowContent(row: UserRowData): boolean {
  if (
    row.amActivity.trim() ||
    row.pmActivity.trim() ||
    row.lunchAmount.trim() ||
    row.specialNotes.trim()
  ) {
    return true;
  }

  if (row.behaviorTags && row.behaviorTags.length > 0) {
    return true;
  }

  return Object.values(row.problemBehavior).some(Boolean);
}

// ─── Handoff Injection Policy ───────────────────────────

/**
 * handoff 特記を空の specialNotes にのみ注入するポリシー判定。
 *
 * ルール:
 * - 手入力済みの specialNotes は上書きしない
 * - handoff note が undefined / 空文字なら注入しない
 */
export function shouldPrefillSpecialNotes(
  currentValue: string,
  incomingValue: string | undefined,
): boolean {
  return !!incomingValue && (!currentValue || currentValue.trim() === '');
}

/**
 * handoff notes を既存 rows に安全に適用する。
 * 手入力済みの specialNotes は上書きしない。
 *
 * @returns rows は新しい配列（変更がない場合でも安全に使える）、
 *          changed は実際に変更があったかのフラグ
 */
export function applyHandoffNotesToRows(
  rows: UserRowData[],
  notesByUser: Map<string, string>,
): { rows: UserRowData[]; changed: boolean } {
  let changed = false;
  const nextRows = rows.map((row) => {
    const note = notesByUser.get(row.userId);
    if (shouldPrefillSpecialNotes(row.specialNotes, note)) {
      changed = true;
      return { ...row, specialNotes: note! };
    }
    return row;
  });
  return { rows: nextRows, changed };
}

// ─── Row Synchronization ────────────────────────────────

// contract:allow-interface — 関数パラメータ型、domain entity ではない
export type SyncRowsUser = {
  userId: string;
  name: string;
};

// contract:allow-interface — 関数パラメータ型、domain entity ではない
export type SyncRowsOptions = {
  /** 前回活動を取得する関数（DI ポイント） */
  getLastActivities?: (userId: string) => LastActivities | null;
};

/**
 * selectedUsers に基づいて userRows を再構成する。
 *
 * ルール:
 * - 既存行が存在するユーザーはその行を維持（入力済みデータ保護）
 * - 新規選択されたユーザーは createEmptyRow で行生成
 * - 未選択のユーザーの行は除外
 * - selectedUserIds に含まれるが selectedUsers に未解決のユーザーも
 *   フォールバックとして行を生成（ID のみの場合）
 *
 * @param existingRows 現在の行データ
 * @param selectedUsers 選択されたユーザーオブジェクト
 * @param selectedUserIds 選択されたユーザーID一覧
 * @param handoffNotesByUser 申し送り特記マップ
 * @param options DI オプション
 */
export function syncRowsWithSelectedUsers(
  existingRows: UserRowData[],
  selectedUsers: SyncRowsUser[],
  selectedUserIds: string[],
  handoffNotesByUser?: Map<string, string>,
  options?: SyncRowsOptions,
): UserRowData[] {
  const existingMap = new Map(existingRows.map((row) => [row.userId, row]));
  const getLastActs = options?.getLastActivities;

  const normalizeName = (name: string): string => name.trim();

  // 1. 解決済みユーザーから行を構築
  const rowsFromResolvedUsers: UserRowData[] = selectedUsers.map((user) => {
    const userId = user.userId || '';
    const existing = existingMap.get(userId);
    if (existing) {
      const resolvedName = normalizeName(user.name || '');
      if (resolvedName.length > 0 && existing.userName !== resolvedName) {
        return { ...existing, userName: resolvedName };
      }
      return existing;
    }
    return createEmptyRow(userId, user.name || '', {
      handoffNote: handoffNotesByUser?.get(userId),
      lastActivities: getLastActs?.(userId),
    });
  });

  // 2. ID のみ選択されているがまだ解決されていないユーザー
  const resolvedUserIds = new Set(rowsFromResolvedUsers.map((row) => row.userId));
  const unresolvedButSelectedRows: UserRowData[] = selectedUserIds
    .filter((userId) => !resolvedUserIds.has(userId))
    .map((userId) => {
      const existing = existingMap.get(userId);
      if (existing) {
        return existing;
      }
      return createEmptyRow(userId, userId, {
        handoffNote: handoffNotesByUser?.get(userId),
        lastActivities: getLastActs?.(userId),
      });
    });

  return [...rowsFromResolvedUsers, ...unresolvedButSelectedRows];
}
