/**
 * Exception to Today Action Mapper
 * 
 * ISP 三層モデルの整合性エラー (TriggeredException) を、
 * 現場が「今日やること」として直動できる RawActionSource へ変換する。
 */

import type { TriggeredException } from '@/domain/isp/exceptionBridge';
import type { RawActionSource } from '@/features/today/domain/models/queue.types';

/**
 * 個別の例外を Today アクションソースへ変換する。
 */
export function mapExceptionToTodayActionSource(exception: TriggeredException): RawActionSource {
  // 1. セマンティック・タイトルへの変換
  // 理屈（Exception Title）を 行動（Action Label）へ
  const actionLabel = getActionLabelFromCategory(exception);

  return {
    id: `today-exc-${exception.id}`,
    sourceType: 'exception',
    title: actionLabel,
    isCompleted: exception.isResolved,
    // 計画出典や重要度をペイロードとして保持
    payload: {
      originalExceptionId: exception.id,
      severity: exception.severity,
      reason: exception.reason,
      suggestedAction: exception.suggestedAction,
      provenance: exception.provenance
    }
  };
}

/**
 * 判定カテゴリに基づいた、現場職員が迷わない「行動ラベル」の生成
 */
function getActionLabelFromCategory(exc: TriggeredException): string {
  const userName = exc.provenance.userId; // 本来は UserMaster から名前を引くが、ここでは ID/Placeholder
  
  switch (exc.category) {
    case 'unperformed':
      return `【至急確認】${userName} さんの未実施手順があります`;
    case 'deviated':
    case 'risk_detected':
      return `【安全注意】${userName} さんのリスク状態を確認してください`;
    case 'missing_focus':
      return `${userName} さんの記録に観察重点を追記`;
    default:
      return `${userName} さんに関する計画との差分を解消`;
  }
}

/**
 * 一括変換
 */
export function mapExceptionsToTodayActionSources(exceptions: TriggeredException[]): RawActionSource[] {
  return exceptions.map(mapExceptionToTodayActionSource);
}
