/**
 * groupHandoffsByUser — 申し送りを利用者ごとにグループ化する純粋関数
 *
 * データモデル・API を一切変更せず、表示レイヤーのために
 * フラットな HandoffRecord[] を利用者単位に束ねる。
 *
 * 設計原則:
 * - 入力: HandoffRecord[]（フィルタ済み）
 * - 出力: HandoffUserGroup[]（ソート済み）
 * - React / routing / UI コードを含まない
 * - seenMap 等の外部状態も受け取らない（Phase 2 で拡張可能）
 */

import type { HandoffRecord, HandoffSeverity } from '../handoffTypes';

// ────────────────────────────────────────────────────────────
// 出力型
// ────────────────────────────────────────────────────────────

export type HandoffUserGroup = {
  /** 利用者コード（グループキー） */
  userId: string;
  /** 利用者表示名 */
  userName: string;
  /** 最新投稿のメッセージ */
  latestMessage: string;
  /** 最新投稿者名 */
  latestAuthorName: string;
  /** 最新投稿時刻 (ISO datetime) */
  latestAt: string;
  /** そのカテゴリの投稿件数 */
  totalCount: number;
  /** 「重要」severity の投稿が含まれるか */
  hasImportant: boolean;
  /** 「要注意」severity の投稿が含まれるか */
  hasCaution: boolean;
  /** 最も高い重要度 */
  highestSeverity: HandoffSeverity;
  /** 投稿一覧（最新順） */
  records: HandoffRecord[];
};

// ────────────────────────────────────────────────────────────
// ソートヘルパー
// ────────────────────────────────────────────────────────────

/** 重要度 → 数値（高い方が優先） */
function severityWeight(severity: HandoffSeverity): number {
  switch (severity) {
    case '重要': return 2;
    case '要注意': return 1;
    default: return 0;
  }
}

/** 2つの重要度のうち高い方を返す */
function higherSeverity(a: HandoffSeverity, b: HandoffSeverity): HandoffSeverity {
  return severityWeight(a) >= severityWeight(b) ? a : b;
}

// ────────────────────────────────────────────────────────────
// メイン関数
// ────────────────────────────────────────────────────────────

/**
 * HandoffRecord[] を利用者ごとにグループ化し、運用上の重要度順でソートする。
 *
 * ソート順:
 * 1. hasImportant === true が上
 * 2. hasCaution === true が上
 * 3. latestAt 降順（最新の投稿がある利用者が上）
 * 4. userName 昇順（同条件時の安定ソート）
 */
export function groupHandoffsByUser(records: HandoffRecord[]): HandoffUserGroup[] {
  if (!records || records.length === 0) return [];

  // ── 1. userCode でグループ化 ──
  const groupMap = new Map<string, HandoffRecord[]>();

  for (const record of records) {
    const key = record.userCode || '__unknown__';
    const existing = groupMap.get(key);
    if (existing) {
      existing.push(record);
    } else {
      groupMap.set(key, [record]);
    }
  }

  // ── 2. 各グループを HandoffUserGroup に変換 ──
  const groups: HandoffUserGroup[] = [];

  for (const [userId, userRecords] of groupMap) {
    // 最新順にソート（createdAt 降順）
    const sorted = [...userRecords].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const latest = sorted[0];

    let highest: HandoffSeverity = '通常';
    let hasImportant = false;
    let hasCaution = false;

    for (const r of sorted) {
      highest = higherSeverity(highest, r.severity);
      if (r.severity === '重要') hasImportant = true;
      if (r.severity === '要注意') hasCaution = true;
    }

    groups.push({
      userId,
      userName: latest.userDisplayName || userId,
      latestMessage: latest.message,
      latestAuthorName: latest.createdByName || '不明',
      latestAt: latest.createdAt,
      totalCount: sorted.length,
      hasImportant,
      hasCaution,
      highestSeverity: highest,
      records: sorted,
    });
  }

  // ── 3. 運用重要度でソート ──
  groups.sort((a, b) => {
    // 1. 重要が上
    if (a.hasImportant !== b.hasImportant) return a.hasImportant ? -1 : 1;
    // 2. 要注意が上
    if (a.hasCaution !== b.hasCaution) return a.hasCaution ? -1 : 1;
    // 3. 最新投稿が新しい方が上
    const timeA = new Date(a.latestAt).getTime();
    const timeB = new Date(b.latestAt).getTime();
    if (timeA !== timeB) return timeB - timeA;
    // 4. 名前昇順（安定ソート）
    return a.userName.localeCompare(b.userName, 'ja');
  });

  return groups;
}
