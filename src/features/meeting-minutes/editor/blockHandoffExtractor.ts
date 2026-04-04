/**
 * blockHandoffExtractor.ts — Block ベースの handoff 用セクション抽出
 *
 * 責務:
 * - contentBlocks から意味セクション（summary, decisions, actions, reports,
 *   notifications）を prefix / block type / heading ベースで抽出する
 * - legacy フィールドとのハイブリッド fallback を提供する
 * - handoff payload 組み立てに必要なテキストを返す
 *
 * 設計判断:
 * - blockMappers.ts は Repository 層 (保存/読み込み) 向けの変換
 * - このファイルは handoff UI 向けの「セクション分類抽出」に特化
 * - 両者は独立して進化できるよう分離している
 */
import type { MeetingMinuteBlock } from '../types';
import { MEETING_PREFIX } from './slashMenuItems';

// ──────────────────────────────────────────────────────────────
// 公開型
// ──────────────────────────────────────────────────────────────

/**
 * Block から抽出されたセクションテキスト。
 * 各フィールドは空文字列の可能性がある（該当ブロックが無い場合）。
 */
export type ExtractedSections = {
  /** 要点・概要（fallback: 分類不能テキスト） */
  summary: string;
  /** 決定事項 */
  decisions: string;
  /** アクション（チェックリスト形式） */
  actions: string;
  /** 報告事項 */
  reports: string;
  /** 連絡事項 */
  notifications: string;
};

// ──────────────────────────────────────────────────────────────
// テキスト抽出ヘルパー
// ──────────────────────────────────────────────────────────────

/**
 * 単一ブロックからプレーンテキストを抽出する。
 */
function blockToText(block: MeetingMinuteBlock): string {
  if (!Array.isArray(block.content)) return '';
  return block.content
    .filter(
      (c): c is { type: string; text: string } =>
        typeof c === 'object' &&
        c !== null &&
        'text' in c &&
        typeof (c as Record<string, unknown>).text === 'string'
    )
    .map((c) => c.text)
    .join('');
}

/**
 * prefix（【報告】等）で始まるテキストから、prefix を除去して本文を返す。
 * 一致しなければ null を返す。
 */
function stripPrefix(text: string, prefix: string): string | null {
  if (text.startsWith(prefix)) {
    return text.slice(prefix.length).trim();
  }
  return null;
}

// ──────────────────────────────────────────────────────────────
// メイン: Block → セクション抽出
// ──────────────────────────────────────────────────────────────

/**
 * MeetingMinuteBlock 配列を走査し、各ブロックを意味セクションに分類する。
 *
 * 分類ルール（優先順位順）:
 * 1. formal block type マッチ (最優先):
 *    - type: 'decision' → decisions
 *    - type: 'action'   → actions
 * 2. prefix マッチ:
 *    - 【決定事項】 → decisions
 *    - 【報告】     → reports
 *    - 【連絡事項】 → notifications
 *    - 【継続検討】 → summary
 *    - 【次回予定】 → notifications
 * 3. block type (legacy):
 *    - checkListItem → actions
 * 4. heading（セクション見出し）:
 *    - 見出し直後のブロックを heading テキストで分類
 * 5. fallback:
 *    - 分類不能な paragraph → summary
 */
export function extractFromBlocks(
  blocks: MeetingMinuteBlock[]
): ExtractedSections {
  const result: ExtractedSections = {
    summary: '',
    decisions: '',
    actions: '',
    reports: '',
    notifications: '',
  };

  const summaryLines: string[] = [];
  const decisionLines: string[] = [];
  const actionLines: string[] = [];
  const reportLines: string[] = [];
  const notificationLines: string[] = [];

  // セクション見出しコンテキスト: heading で宣言されたセクション名
  let currentSection: 'summary' | 'decisions' | 'actions' | 'reports' | 'notifications' | null = null;

  for (const block of blocks) {
    const text = blockToText(block).trim();
    if (!text && block.type !== 'checkListItem' && block.type !== 'action' && block.type !== 'decision') continue;

    // ── 1. formal block type (最優先) ──
    if (block.type === 'decision') {
      decisionLines.push(text);
      continue;
    }
    if (block.type === 'action') {
      actionLines.push(text);
      continue;
    }

    // ── 2. heading によるセクション切り替え ──
    if (block.type === 'heading') {
      const lower = text.toLowerCase();
      if (lower.includes('決定事項') || lower.includes('decision')) {
        currentSection = 'decisions';
      } else if (lower.includes('アクション') || lower.includes('action')) {
        currentSection = 'actions';
      } else if (lower.includes('報告') || lower.includes('report')) {
        currentSection = 'reports';
      } else if (lower.includes('連絡') || lower.includes('notice') || lower.includes('notification')) {
        currentSection = 'notifications';
      } else if (lower.includes('要点') || lower.includes('summary') || lower.includes('概要')) {
        currentSection = 'summary';
      } else {
        // 不明な見出しは summaryとして扱い、見出しテキスト自体も含める
        currentSection = 'summary';
        summaryLines.push(text);
      }
      continue; // 見出し自体はセクション本文に含めない
    }

    // ── 3. prefix マッチ ──
    // ※ formal block type を採用後は、既存データ互換のために残す
    const decisionContent = stripPrefix(text, MEETING_PREFIX.decision);
    if (decisionContent !== null) {
      decisionLines.push(decisionContent || text);
      continue;
    }

    const reportContent = stripPrefix(text, MEETING_PREFIX.report);
    if (reportContent !== null) {
      reportLines.push(reportContent || text);
      continue;
    }

    const noticeContent = stripPrefix(text, MEETING_PREFIX.notice);
    if (noticeContent !== null) {
      notificationLines.push(noticeContent || text);
      continue;
    }

    const pendingContent = stripPrefix(text, MEETING_PREFIX.pending);
    if (pendingContent !== null) {
      summaryLines.push(`[継続検討] ${pendingContent}`);
      continue;
    }

    const nextContent = stripPrefix(text, MEETING_PREFIX.nextSchedule);
    if (nextContent !== null) {
      notificationLines.push(`[次回] ${nextContent}`);
      continue;
    }

    const agendaContent = stripPrefix(text, MEETING_PREFIX.agenda);
    if (agendaContent !== null) {
      // 議題はセクション見出し的な扱い — summary に含める
      summaryLines.push(agendaContent || text);
      continue;
    }

    // ── 4. block type ベース (legacy checkListItem) ──
    if (block.type === 'checkListItem') {
      if (text) actionLines.push(text);
      continue;
    }

    // ── 5. セクションコンテキストに従って分類 ──
    if (currentSection) {
      switch (currentSection) {
        case 'decisions':
          decisionLines.push(text);
          break;
        case 'actions':
          actionLines.push(text);
          break;
        case 'reports':
          reportLines.push(text);
          break;
        case 'notifications':
          notificationLines.push(text);
          break;
        case 'summary':
        default:
          summaryLines.push(text);
          break;
      }
      continue;
    }

    // ── 6. fallback: 分類不能 → summary ──
    summaryLines.push(text);
  }

  result.summary = summaryLines.join('\n');
  result.decisions = decisionLines.join('\n');
  result.actions = actionLines.join('\n');
  result.reports = reportLines.join('\n');
  result.notifications = notificationLines.join('\n');

  return result;
}

// ──────────────────────────────────────────────────────────────
// Public: ハイブリッド Fallback
// ──────────────────────────────────────────────────────────────

/**
 * Block ベース抽出と legacy フィールドのハイブリッド fallback。
 *
 * - contentBlocks があり、抽出結果が空でなければ block 優先
 * - block から抽出できなかったフィールドは legacy で補完
 */
export function buildHandoffSections(
  contentBlocks: MeetingMinuteBlock[] | undefined,
  legacy: { summary: string; decisions: string; actions: string }
): ExtractedSections {
  // block なし → 完全 legacy
  if (!contentBlocks || contentBlocks.length === 0) {
    return {
      summary: legacy.summary,
      decisions: legacy.decisions,
      actions: legacy.actions,
      reports: '',
      notifications: '',
    };
  }

  const extracted = extractFromBlocks(contentBlocks);

  // ハイブリッド: block 抽出が空なら legacy で補完
  return {
    summary: extracted.summary || legacy.summary,
    decisions: extracted.decisions || legacy.decisions,
    actions: extracted.actions || legacy.actions,
    reports: extracted.reports,
    notifications: extracted.notifications,
  };
}
