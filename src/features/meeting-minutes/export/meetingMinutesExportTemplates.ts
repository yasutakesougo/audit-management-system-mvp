/**
 * meetingMinutesExportTemplates.ts
 *
 * 責務:
 * - formal block 種別や audience に応じて、エクスポート出力時の
 *   見出し（title）、強調表現（emphasis）、箇条書き表現（bulletStyle）を決定する
 */

import type { HandoffAudience } from '../editor/handoffTemplates';
import type { MeetingMinutesExportSectionKind } from './exportTypes';

type ExportSectionConfig = {
  title: string;
  emphasis: 'normal' | 'highlight' | 'info' | 'warning';
  bulletStyle: 'none' | 'bullet' | 'check';
};

/**
 * 種別と audience から、エクスポート時のフォーマット設定を取得する。
 */
export function getExportSectionConfig(
  kind: MeetingMinutesExportSectionKind,
  audience?: HandoffAudience
): ExportSectionConfig {
  const isField = audience === 'field';
  const isAdmin = audience === 'admin';

  switch (kind) {
    case 'decision':
      return {
        title: '決定事項',
        emphasis: 'highlight',
        bulletStyle: 'bullet',
      };
    case 'action':
      return {
        title: 'アクション',
        emphasis: isField ? 'warning' : 'info',
        bulletStyle: 'check',
      };
    case 'report':
      return {
        title: '報告事項',
        emphasis: isAdmin ? 'info' : 'normal',
        bulletStyle: 'bullet',
      };
    case 'notification':
      return {
        title: '連絡事項',
        emphasis: isField ? 'info' : 'normal',
        bulletStyle: 'bullet',
      };
    case 'nextSchedule':
      return {
        title: '次回予定',
        emphasis: 'info',
        bulletStyle: 'none',
      };
    case 'continuingDiscussion':
      return {
        title: '継続検討事項',
        emphasis: 'normal',
        bulletStyle: 'bullet',
      };
    case 'summary':
      return {
        title: '要点・概要',
        emphasis: isAdmin ? 'highlight' : 'normal',
        bulletStyle: 'none',
      };
    case 'meta':
    case 'generic':
    default:
      return {
        title: 'その他',
        emphasis: 'normal',
        bulletStyle: 'none',
      };
  }
}
