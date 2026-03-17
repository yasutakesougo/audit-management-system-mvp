/**
 * dailyAdapter — AnyDaily → TimelineEvent 変換
 *
 * Daily ドメインの A型（個人）/ B型（軸別）レコードを
 * 統一タイムラインイベントに変換する純粋関数。
 *
 * 変換ルール:
 *   - occurredAt: `daily.date` (YYYY-MM-DD) → ISO 形式 (T00:00:00 付加)
 *   - severity: 常に 'info'（日次記録に重要度概念なし）
 *   - description: A型は specialNotes、B型は notes
 */

import type { AnyDaily } from '@/domain/daily/types';
import type { TimelineEvent } from '../types';

/**
 * AnyDaily を TimelineEvent に変換する。
 *
 * @param daily - Daily レコード（A型 or B型）
 * @returns 統一タイムラインイベント
 */
export function dailyToTimelineEvent(daily: AnyDaily): TimelineEvent {
  const kindLabel = daily.kind === 'A' ? '個人' : '軸別';
  const description =
    daily.kind === 'A' ? daily.data.specialNotes : daily.data.notes;

  return {
    id: `daily-${daily.id}`,
    source: 'daily',
    userId: daily.userId,
    occurredAt: `${daily.date}T00:00:00`,
    title: `日次記録 (${kindLabel})`,
    description: description || undefined,
    severity: 'info',
    sourceRef: { id: daily.id },
    meta: {
      kind: daily.kind,
      status: daily.status,
    },
  };
}
