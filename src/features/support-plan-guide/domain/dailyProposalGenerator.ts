/**
 * Daily Record Proposal Generator
 *
 * Daily Record の specialNotes から改善提案キーワードを含む行を
 * SupportChangeProposal に変換する。
 *
 * Phase 7A: Daily 起点の proposal 生成
 *
 * @module features/support-plan-guide/domain/dailyProposalGenerator
 */

import type { DailyRecordUserRow } from '@/features/daily/schema';
import type { SupportChangeProposal } from './proposalTypes';

/** 改善提案キーワード */
const PROPOSAL_KEYWORDS = ['改善', '変更', '提案', '検討', '見直し'] as const;

/** Daily Record の UserRow から proposal 候補かどうかを判定 */
const hasProposalKeyword = (text: string): boolean =>
  PROPOSAL_KEYWORDS.some((kw) => text.includes(kw));

export type DailyProposalInput = {
  /** 記録日 (YYYY-MM-DD) */
  date: string;
  /** Daily Record ID (SharePoint item ID or date fallback) */
  recordId?: string;
  /** User rows from the daily record */
  userRows: DailyRecordUserRow[];
};

/**
 * Daily Record の specialNotes からキーワードを含む行を proposal に変換する。
 *
 * - PROPOSAL_KEYWORDS の少なくとも1つを含む specialNotes のみ対象
 * - 1 user row → 最大 1 proposal
 * - source は 'daily'、evidenceRef.type は 'daily-record'
 */
export const generateDailyProposals = (
  input: DailyProposalInput,
): SupportChangeProposal[] => {
  const { date, recordId, userRows } = input;

  return userRows
    .filter((row) => row.specialNotes && hasProposalKeyword(row.specialNotes))
    .map((row) => ({
      id: `daily-${date}-${row.userId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: String(row.userId),
      source: 'daily' as const,
      title: `[Daily] ${row.specialNotes.slice(0, 50)}`,
      rationale: `${date} の日報特記事項より — ${row.userName || row.userId}`,
      recommendedAction: row.specialNotes,
      evidenceRef: {
        type: 'daily-record' as const,
        itemId: recordId ?? date,
        userId: String(row.userId),
        date,
      },
      status: 'proposed' as const,
      createdAt: new Date().toISOString(),
    }));
};
