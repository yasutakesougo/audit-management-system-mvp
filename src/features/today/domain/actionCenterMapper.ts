import type { ExceptionItem } from '@/features/exceptions/domain/exceptionLogic';
import type { ActionCenterItem, ActionCenterKind } from './actionCenterTypes';

/**
 * ExceptionItem (Parent) を ActionCenterItem に変換する。
 * Today のコクピットで表示するために情報の重み付けと文言の調整を行う。
 */
export function mapExceptionToActionCenterItem(
  item: ExceptionItem,
  count: number,
): ActionCenterItem | null {
  // マッピングルールの定義
  const configMap: Partial<Record<string, { kind: ActionCenterKind; unit: string; hrefParams: string; reasonCode: string }>> = {
    'missing-record': {
      kind: 'daily',
      unit: '名',
      hrefParams: 'missing=1',
      reasonCode: 'daily_missing',
    },
    'missing-vital': {
      kind: 'vital',
      unit: '名',
      hrefParams: 'missing=1',
      reasonCode: 'vital_missing',
    },
    'critical-handoff': {
      kind: 'handoff',
      unit: '件',
      hrefParams: 'filter=unread',
      reasonCode: 'handoff_critical',
    },
    'transport-alert': {
      kind: 'transport',
      unit: '件',
      hrefParams: 'view=incomplete',
      reasonCode: 'transport_alert',
    },
    'isp-recommendation': {
      kind: 'planning',
      unit: '件',
      hrefParams: 'v=recommendations',
      reasonCode: 'isp_renew_suggest',
    },
  };

  const config = configMap[item.category];
  if (!config) return null;

  // 遷移先の URL 構築 (既存の actionPath を活かしつつ、Today 用のフィルタを追加)
  const baseHref = item.actionPath || '/';
  const hasQuery = baseHref.includes('?');
  const href = `${baseHref}${hasQuery ? '&' : '?'}${config.hrefParams}`;

  return {
    id: `action-${item.id}`,
    kind: config.kind,
    priority: item.severity === 'critical' ? 'critical' : item.severity === 'high' ? 'high' : 'medium',
    title: item.title,
    count,
    unit: config.unit,
    reasonCode: config.reasonCode ?? 'unknown',
    actionLabel: item.actionLabel ?? '詳細を確認',
    href,
  };
}
