/**
 * buildMeetingMinutesSharePointLink.ts
 *
 * 責務:
 * - SharePoint に保存した成果物の ServerRelativeUrl または AbsoluteUrl から、
 *   ブラウザで開ける完全な URL を組み立てる pure function。
 */
export function buildMeetingMinutesSharePointLink(input: {
  siteUrl?: string; // e.g. "https://tenant.sharepoint.com/sites/foobar"
  serverRelativeUrl?: string; // e.g. "/sites/foobar/Shared Documents/file.html"
  absoluteUrl?: string;
}): string | null {
  const { siteUrl, serverRelativeUrl, absoluteUrl } = input;

  if (absoluteUrl) {
    return absoluteUrl;
  }

  if (serverRelativeUrl && siteUrl) {
    // URLクラスを使って安全に結合する
    try {
      // siteUrl は origin のみを抽出するか、そのまま base として扱う
      const origin = new URL(siteUrl).origin;
      return new URL(serverRelativeUrl, origin).href;
    } catch {
      // siteUrl が不正な形式の場合などはフォールバック（例: / から始まるなら自身のWindowのオリジン）
      if (serverRelativeUrl.startsWith('/') && typeof window !== 'undefined') {
        return window.location.origin + serverRelativeUrl;
      }
    }
  }

  // 万一 siteUrl が渡されなかった場合のブラウザハック
  if (serverRelativeUrl && serverRelativeUrl.startsWith('/') && typeof window !== 'undefined') {
    return window.location.origin + serverRelativeUrl;
  }

  return null;
}
