/**
 * buildMeetingMinutesTeamsDeepLink.ts
 *
 * 責務:
 * - Teamsの共有ダイアログ・アプリを起動するための URL / Deep Link を構築する。
 * - shareText や URL が極端に長い場合のフォールバックは、使う側（hook等）で制御する設計とする。
 */
export function buildMeetingMinutesTeamsDeepLink(input: {
  shareText: string;
  sharePointUrl?: string; // 実際のTeams共有リンクとしての primary href
}): string | null {
  const { shareText, sharePointUrl } = input;

  // msgText と href が両方空の場合は作成できない
  if (!shareText && !sharePointUrl) {
    return null;
  }

  try {
    const url = new URL('https://teams.microsoft.com/share');
    
    // href パラメータ（カードのメインリンク用、SharePoint URL があれば優先）
    if (sharePointUrl) {
      url.searchParams.set('href', sharePointUrl);
    }

    // msgText パラメータ（チャットの入力欄に入る初期テキスト）
    if (shareText) {
      url.searchParams.set('msgText', shareText);
    }

    return url.href;
  } catch {
    return null;
  }
}
