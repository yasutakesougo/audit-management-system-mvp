import type { HandoffAudience } from '../../editor/handoffTemplates';

/**
 * buildMeetingMinutesPdfFileName.ts
 *
 * 責務:
 * - PDF やファイル保存時のファイル名を自動生成する pure function
 * - 禁則文字の除外による安全なファイル名を提供する
 */
export function buildMeetingMinutesPdfFileName(input: {
  title?: string;
  meetingDate?: string;
  audience?: HandoffAudience;
}): string {
  const { title, meetingDate, audience } = input;

  // OSのファイル名で使えない禁則文字を除去/置換
  // \ / : * ? " < > | および 改行
  const sanitize = (text: string) =>
    text.replace(/[\\/:*?"<>|\r\n]/g, '_').trim();

  const safeTitle = sanitize(title || '無題の議事録');
  const safeDate = sanitize(meetingDate || '日付未定');

  let audienceLabel = '';
  if (audience === 'field') {
    audienceLabel = '_現場申し送り';
  } else if (audience === 'admin') {
    audienceLabel = '_管理者共有';
  }

  return `${safeDate}_${safeTitle}${audienceLabel}.pdf`;
}
