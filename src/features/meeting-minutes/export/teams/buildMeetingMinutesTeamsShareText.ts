import type { HandoffAudience } from '../../editor/handoffTemplates';

/**
 * buildMeetingMinutesTeamsShareText.ts
 *
 * 責務:
 * - Teamsで共有する際のメッセージテキストを構築する Pure Function。
 * - Audienceの種別に応じて文面のトーンと説明を切り替える。
 */
export function buildMeetingMinutesTeamsShareText(input: {
  title?: string;
  meetingDate?: string;
  audience?: HandoffAudience;
  fileName?: string;
  sharePointUrl: string;
}): string {
  const { title, meetingDate, audience, fileName, sharePointUrl } = input;

  const displayTitle = title || '無題の議事録';
  const displayDate = meetingDate ? `（${meetingDate}）` : '';
  const fileInfo = fileName ? `\nファイル名: ${fileName}` : '';

  let message = '';

  if (audience === 'field') {
    message = `【現場申し送り】\n${displayTitle}${displayDate} の議事録を出力しました。\n現場向けの印刷用HTMLとして保存済みです。以下のリンクから確認または印刷をお願いします。\n${fileInfo}\n\nリンク: ${sharePointUrl}`;
  } else if (audience === 'admin') {
    message = `【管理者共有】\n${displayTitle}${displayDate} の議事録を出力・保存しました。\n管理者共有用の印刷HTML成果物となります。内容の確認をお願いいたします。\n${fileInfo}\n\nリンク: ${sharePointUrl}`;
  } else {
    message = `【議事録共有】\n${displayTitle}${displayDate} の議事録（印刷用HTML）を保存しました。\n以下のリンクから確認できます。\n${fileInfo}\n\nリンク: ${sharePointUrl}`;
  }

  return message;
}
