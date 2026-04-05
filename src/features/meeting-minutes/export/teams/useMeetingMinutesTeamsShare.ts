import { useCallback, useState } from 'react';
import type { HandoffAudience } from '../../editor/handoffTemplates';
import { buildMeetingMinutesTeamsShareText } from './buildMeetingMinutesTeamsShareText';
import { buildMeetingMinutesTeamsDeepLink } from './buildMeetingMinutesTeamsDeepLink';

export type TeamsShareParams = {
  title?: string;
  meetingDate?: string;
  audience?: HandoffAudience;
  fileName?: string;
  sharePointUrl: string;
};

/**
 * useMeetingMinutesTeamsShare.ts
 *
 * 責務:
 * - UIから簡単にTeams共有を呼び出せるインターフェースを提供する
 * - Deep Linkの起動と、クリップボードへのフォールバックコピー動作を抽象化する
 */
export function useMeetingMinutesTeamsShare() {
  const [error, setError] = useState<string | null>(null);

  const buildTextAndLink = useCallback((params: TeamsShareParams) => {
    const shareText = buildMeetingMinutesTeamsShareText(params);
    const deepLink = buildMeetingMinutesTeamsDeepLink({ shareText, sharePointUrl: params.sharePointUrl });
    return { shareText, deepLink };
  }, []);

  const shareToTeams = useCallback(async (params: TeamsShareParams) => {
    setError(null);
    try {
      const { deepLink } = buildTextAndLink(params);
      
      if (!deepLink) {
        throw new Error('Teamsへのリンク生成に失敗しました。');
      }

      // 新しいタブで Teams Share URL を開く
      window.open(deepLink, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました。');
      throw err;
    }
  }, [buildTextAndLink]);

  const copyTeamsShareText = useCallback(async (params: TeamsShareParams) => {
    setError(null);
    try {
      const { shareText } = buildTextAndLink(params);
      await navigator.clipboard.writeText(shareText);
    } catch (err) {
      setError('クリップボードへのコピーに失敗しました。');
      throw err;
    }
  }, [buildTextAndLink]);

  return { shareToTeams, copyTeamsShareText, error };
}
