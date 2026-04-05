/**
 * buildHandoffPayload.ts — handoff 送信用 payload 組み立て
 *
 * 責務:
 * - ExtractedSections と選択オプションから、送信用の title / body / sourceUrl を生成する
 * - セクション選択に応じた条件付き結合
 * - 固定順序での出力: 要約 → 報告 → 決定事項 → アクション → 連絡事項 → 追記
 *
 * 設計判断:
 * - DetailPage から分離して単体テスト可能にする
 * - handoff API 契約は変更しない（title + body + sourceUrl の文字列ベース）
 * - legacy / block ハイブリッドの抽出は buildHandoffSections が担当するため、ここでは結合のみ
 */
import type { MeetingMinuteBlock } from '../types';
import { buildHandoffSections, type ExtractedSections } from './blockHandoffExtractor';
import type { SectionKey, HandoffAudience } from './handoffTemplates';
import { HANDOFF_FORMATTING_PRESETS } from './handoffAudienceFormatting';

// ──────────────────────────────────────────────────────────────
// Public 型
// ──────────────────────────────────────────────────────────────

/**
 * handoff に含めるセクションの選択状態。
 */
export type HandoffSectionSelection = {
  includeSummary: boolean;
  includeDecisions: boolean;
  includeActions: boolean;
  includeReports?: boolean;
  includeNotifications?: boolean;
  extraText?: string;
  sectionOrder?: SectionKey[];
  audience?: HandoffAudience;
};

/**
 * handoff 送信に必要な payload。
 */
export type HandoffPayload = {
  title: string;
  body: string;
  sourceUrl: string;
};

/**
 * 議事録データのうち、payload 組み立てに必要な最小情報。
 */
export type MinutesPayloadSource = {
  id: number;
  category: string;
  meetingDate: string;
  summary: string;
  decisions: string;
  actions: string;
  contentBlocks?: MeetingMinuteBlock[];
};

// ──────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────

/**
 * ExtractedSections と選択オプションから handoff payload を組み立てる。
 *
 * セクション出力順序（固定）:
 * 1. 要点（要約）
 * 2. 報告
 * 3. 決定事項
 * 4. アクション
 * 5. 連絡事項
 * 6. 追記
 *
 * 空のセクションは自動的にスキップされる。
 * 未選択のセクションも含まれない。
 */
export function buildHandoffPayloadFromSections(
  sections: ExtractedSections,
  options: HandoffSectionSelection,
  meta: { category: string; meetingDate: string; minutesId: number },
): HandoffPayload {
  const lines: string[] = [];
  const label = `${meta.category}（${meta.meetingDate}）`;
  lines.push(`【${label}】`);

  const preset = options.audience ? HANDOFF_FORMATTING_PRESETS[options.audience] : HANDOFF_FORMATTING_PRESETS.default;
  const sectionGap = preset.joinStyle === 'spacious' ? '\n\n' : '\n';

  const order = options.sectionOrder || ['summary', 'reports', 'decisions', 'actions', 'notifications'];

  const sectionRenderers: Record<SectionKey, () => void> = {
    summary: () => {
      if (options.includeSummary && sections.summary) {
        lines.push(`${sectionGap}${preset.headings.summary}\n${sections.summary}`);
      }
    },
    reports: () => {
      if (options.includeReports && sections.reports) {
        lines.push(`${sectionGap}${preset.headings.reports}\n${sections.reports}`);
      }
    },
    decisions: () => {
      if (options.includeDecisions && sections.decisions) {
        lines.push(`${sectionGap}${preset.headings.decisions}\n${sections.decisions}`);
      }
    },
    actions: () => {
      if (options.includeActions && sections.actions) {
        lines.push(`${sectionGap}${preset.headings.actions}\n${sections.actions}`);
      }
    },
    notifications: () => {
      if (options.includeNotifications && sections.notifications) {
        lines.push(`${sectionGap}${preset.headings.notifications}\n${sections.notifications}`);
      }
    },
  };

  if (preset.introText) {
    lines.push(`\n${preset.introText}`);
  }

  for (const key of order) {
    if (sectionRenderers[key]) {
      sectionRenderers[key]();
    }
  }

  if (options.extraText?.trim()) {
    lines.push(`${sectionGap}■追記\n${options.extraText.trim()}`);
  }

  const sourceUrl = `/meeting-minutes/${meta.minutesId}`;
  lines.push(`\n---\n元議事録: ${sourceUrl}`);

  const title = `【${meta.category}】${meta.meetingDate}`;
  const body = lines.join('\n');

  return { title, body, sourceUrl };
}

/**
 * 議事録データから直接 handoff payload を組み立てるコンビニエンス関数。
 *
 * 内部で buildHandoffSections → buildHandoffPayloadFromSections を呼ぶ。
 * DetailPage で使用するエントリポイント。
 */
export function buildHandoffPayload(
  minutes: MinutesPayloadSource,
  options: HandoffSectionSelection,
): HandoffPayload {
  const sections = buildHandoffSections(
    minutes.contentBlocks,
    { summary: minutes.summary, decisions: minutes.decisions, actions: minutes.actions },
  );

  return buildHandoffPayloadFromSections(
    sections,
    options,
    { category: minutes.category, meetingDate: minutes.meetingDate, minutesId: minutes.id },
  );
}
