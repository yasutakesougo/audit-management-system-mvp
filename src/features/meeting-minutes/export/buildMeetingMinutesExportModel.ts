/**
 * buildMeetingMinutesExportModel.ts
 *
 * 責務:
 * - MeetingMinutes ドメインモデルから、PDF / 帳票 / 外部出力向けの
 *   中間表現（Export Model）を生成する pure function。
 * - 正規化を通し、formal block type を失わずに ExportSection へマップする。
 * - contentBlocks が無ければ legacy data から fallback 生成する。
 */

import type { MeetingMinutes, MeetingMinuteBlock } from '../types';
import type { HandoffAudience } from '../editor/handoffTemplates';
import { normalizeMeetingMinuteBlocks } from '../editor/blockNormalizer';
import { MEETING_PREFIX } from '../editor/slashMenuItems';
import {
  type MeetingMinutesExportModel,
  type MeetingMinutesExportSection,
  type MeetingMinutesExportSectionKind,
} from './exportTypes';
import { getExportSectionConfig } from './meetingMinutesExportTemplates';

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function blockToText(block: MeetingMinuteBlock): string {
  if (!Array.isArray(block.content)) return '';
  return block.content
    .filter(
      (c: unknown): c is { type: string; text: string } =>
        typeof c === 'object' &&
        c !== null &&
        'text' in c &&
        typeof (c as Record<string, unknown>).text === 'string'
    )
    .map((c: { type: string; text: string }) => c.text)
    .join('');
}

function stripPrefix(text: string, prefix: string): string | null {
  if (text.startsWith(prefix)) {
    return text.slice(prefix.length).trim();
  }
  return null;
}

// ──────────────────────────────────────────────────────────────
// Main Builder
// ──────────────────────────────────────────────────────────────

export function buildMeetingMinutesExportModel(input: {
  minutes: MeetingMinutes;
  audience?: HandoffAudience;
}): MeetingMinutesExportModel {
  const { minutes, audience } = input;

  const sectionMap: Record<MeetingMinutesExportSectionKind, string[]> = {
    meta: [],
    summary: [],
    report: [],
    decision: [],
    action: [],
    notification: [],
    nextSchedule: [],
    continuingDiscussion: [],
    generic: [],
  };

  const hasBlocks = Array.isArray(minutes.contentBlocks) && minutes.contentBlocks.length > 0;

  if (hasBlocks) {
    const blocks = normalizeMeetingMinuteBlocks(minutes.contentBlocks);

    let currentSection: MeetingMinutesExportSectionKind | null = null;

    for (const block of blocks) {
      const text = blockToText(block).trim();
      if (!text && !['checkListItem', 'action', 'decision', 'report', 'notification', 'nextSchedule', 'continuingDiscussion'].includes(block.type)) {
        continue;
      }

      // 1. Formal block types
      if (block.type === 'decision') {
        sectionMap.decision.push(text);
        continue;
      }
      if (block.type === 'action') {
        sectionMap.action.push(text);
        continue;
      }
      if (block.type === 'report') {
        sectionMap.report.push(text);
        continue;
      }
      if (block.type === 'notification') {
        sectionMap.notification.push(text);
        continue;
      }
      if (block.type === 'nextSchedule') {
        sectionMap.nextSchedule.push(text);
        continue;
      }
      if (block.type === 'continuingDiscussion') {
        sectionMap.continuingDiscussion.push(text);
        continue;
      }

      // 2. Heading contexts
      if (block.type === 'heading') {
        const lower = text.toLowerCase();
        if (lower.includes('決定事項') || lower.includes('decision')) {
          currentSection = 'decision';
        } else if (lower.includes('アクション') || lower.includes('action')) {
          currentSection = 'action';
        } else if (lower.includes('報告') || lower.includes('report')) {
          currentSection = 'report';
        } else if (lower.includes('連絡') || lower.includes('notice') || lower.includes('notification')) {
          currentSection = 'notification';
        } else if (lower.includes('要点') || lower.includes('summary') || lower.includes('概要')) {
          currentSection = 'summary';
        } else {
          currentSection = 'generic';
          sectionMap.generic.push(text);
        }
        continue; // 見出しテキスト自体はセクション内容を含めない（Section titleになるため）
      }

      // 3. Prefix mapping
      const decisionContent = stripPrefix(text, MEETING_PREFIX.decision);
      if (decisionContent !== null) {
        sectionMap.decision.push(decisionContent || text);
        continue;
      }
      const reportContent = stripPrefix(text, MEETING_PREFIX.report);
      if (reportContent !== null) {
        sectionMap.report.push(reportContent || text);
        continue;
      }
      const noticeContent = stripPrefix(text, MEETING_PREFIX.notice);
      if (noticeContent !== null) {
        sectionMap.notification.push(noticeContent || text);
        continue;
      }
      const pendingContent = stripPrefix(text, MEETING_PREFIX.pending);
      if (pendingContent !== null) {
        sectionMap.continuingDiscussion.push(pendingContent || text);
        continue;
      }
      const nextContent = stripPrefix(text, MEETING_PREFIX.nextSchedule);
      if (nextContent !== null) {
        sectionMap.nextSchedule.push(nextContent || text);
        continue;
      }
      const agendaContent = stripPrefix(text, MEETING_PREFIX.agenda);
      if (agendaContent !== null) {
        // 議題は summary へ
        sectionMap.summary.push(agendaContent || text);
        continue;
      }

      // 4. block type legacy
      if (block.type === 'checkListItem') {
        if (text) sectionMap.action.push(text);
        continue;
      }

      // 5. context fallback
      if (currentSection) {
        sectionMap[currentSection].push(text);
        continue;
      }

      // 6. generic fallback
      sectionMap.summary.push(text);
    }
  } else {
    // Legacy mapping fallback
    if (minutes.summary) sectionMap.summary.push(minutes.summary);
    if (minutes.decisions) sectionMap.decision.push(minutes.decisions);
    if (minutes.actions) sectionMap.action.push(minutes.actions);
  }

  // 抽出結果を Section 配列に変換
  const sections: MeetingMinutesExportSection[] = [];

  // 出力順序ルール (audience による調整可能)
  const isField = audience === 'field';
  const order: MeetingMinutesExportSectionKind[] = isField
    ? ['action', 'nextSchedule', 'notification', 'decision', 'report', 'continuingDiscussion', 'summary', 'generic']
    : ['summary', 'report', 'decision', 'continuingDiscussion', 'action', 'nextSchedule', 'notification', 'generic'];

  for (const kind of order) {
    const lines = sectionMap[kind];
    if (lines.length > 0) {
      const config = getExportSectionConfig(kind, audience);
      sections.push({
        kind,
        title: config.title,
        body: lines.join('\n'),
        emphasis: config.emphasis,
        bulletStyle: config.bulletStyle,
      });
    }
  }

  return {
    title: minutes.title,
    meetingDate: minutes.meetingDate,
    category: minutes.category,
    attendees: minutes.attendees,
    chair: minutes.chair,
    scribe: minutes.scribe,
    relatedLinks: minutes.relatedLinks,
    sections,
  };
}
