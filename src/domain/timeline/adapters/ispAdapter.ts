/**
 * ispAdapter — IndividualSupportPlan → TimelineEvent 変換
 *
 * ISP ドメインの個別支援計画レコードを
 * 統一タイムラインイベントに変換する純粋関数。
 *
 * 変換ルール:
 *   - occurredAt: `isp.createdAt`（ISO 8601）
 *   - severity: 常に 'info'（ISP にリスクレベル概念なし）
 *   - title: ISP ステータスの日本語ラベルを含む
 *   - userId: schema 型は string だがフォールバックとして String() を適用
 */

import type { IndividualSupportPlan, IspStatus } from '@/domain/isp/schema';
import { ISP_STATUS_DISPLAY } from '@/domain/isp/schema';
import type { TimelineEvent } from '../types';

/**
 * IndividualSupportPlan を TimelineEvent に変換する。
 *
 * @param isp - ISP レコード
 * @returns 統一タイムラインイベント
 */
export function ispToTimelineEvent(isp: IndividualSupportPlan): TimelineEvent {
  const statusLabel = ISP_STATUS_DISPLAY[isp.status as IspStatus] ?? isp.status;

  return {
    id: `isp-${isp.id}`,
    source: 'isp',
    userId: String(isp.userId),
    occurredAt: isp.createdAt,
    title: `個別支援計画 (${statusLabel})`,
    severity: 'info',
    sourceRef: { id: isp.id },
    meta: {
      status: isp.status,
      version: isp.version,
    },
  };
}
