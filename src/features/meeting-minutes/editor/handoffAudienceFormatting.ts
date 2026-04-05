/**
 * handoffAudienceFormatting.ts — handoff 送信先ごとの文面プリセット定義
 *
 * 責務:
 * - 送信先 audience 別の見出し表現、強調スタイル、余白などを定義する
 * - "field" なら短く即実行向け、"admin" なら背景把握・共有向けのトーンにする
 */
import type { HandoffAudience, SectionKey } from './handoffTemplates';

export type HandoffFormattingPreset = {
  audience: HandoffAudience | 'default';
  headings: Record<SectionKey, string>;
  joinStyle: 'compact' | 'spacious';
  introText?: string;
};

export const HANDOFF_FORMATTING_PRESETS: Record<HandoffAudience | 'default', HandoffFormattingPreset> = {
  default: {
    audience: 'default',
    headings: {
      summary: '■要点',
      reports: '■報告',
      decisions: '■決定事項',
      actions: '■アクション',
      notifications: '■連絡事項',
    },
    joinStyle: 'compact',
  },
  field: {
    audience: 'field',
    headings: {
      summary: '📝 要点メモ',
      reports: '📢 報告',
      decisions: '✅ 決定事項',
      actions: '📌 【対応】アクション',
      notifications: 'ℹ️ 【連絡】連絡事項',
    },
    joinStyle: 'compact',
    introText: '【🔥 現場申し送り】',
  },
  admin: {
    audience: 'admin',
    headings: {
      summary: '📄 【要約】議事録エグゼクティブサマリ',
      reports: '📊 【報告】共有事項・状況',
      decisions: '🎯 【決定】方針・承認事項',
      actions: '📌 【Next】アクション',
      notifications: 'ℹ️ 【周知】連絡事項',
    },
    joinStyle: 'spacious',
    introText: '【🏛 管理者共有用レポート】',
  },
};
