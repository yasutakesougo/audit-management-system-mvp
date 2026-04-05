/**
 * exportTypes.ts — エクスポート（PDF/帳票）用の型定義
 *
 * 責務:
 * - 議事録データを帳票・レポート向けの中間表現（View Model）として定義する
 * - formal block の意味（decision, action 等）をセクション種別として保持する
 */

export type MeetingMinutesExportSectionKind =
  | 'meta'
  | 'summary'
  | 'report'
  | 'decision'
  | 'action'
  | 'notification'
  | 'nextSchedule'
  | 'continuingDiscussion'
  | 'generic';

export type MeetingMinutesExportSection = {
  kind: MeetingMinutesExportSectionKind;
  title: string;
  body: string;
  emphasis?: 'normal' | 'highlight' | 'info' | 'warning';
  bulletStyle?: 'none' | 'bullet' | 'check';
};

export type MeetingMinutesExportModel = {
  title: string;
  meetingDate?: string;
  category?: string;
  attendees?: string[];
  chair?: string;
  scribe?: string;
  relatedLinks?: string;
  sections: MeetingMinutesExportSection[];
};
