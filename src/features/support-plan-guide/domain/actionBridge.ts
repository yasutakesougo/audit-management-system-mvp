import { ActionSuggestion, buildStableId } from '@/features/action-engine';
import type { SupportPlanTimelineSummary } from './timeline.types';
import type { SupportPlanGuidance } from './guidanceEngine';
import { SupportPlanExportModel } from '../types/export';

/**
 * Action Bridge — 判断を「行動」に変換する
 * 
 * Support Plan Guide の分析結果（Timeline / Guidance）から、
 * Action Engine で扱える「具体的な修正提案（ActionSuggestion）」を生成します。
 * 
 * これにより「説明できる支援」から「実行を促す支援（Executable DES）」へとループを閉じます。
 */
export function buildActionSuggestionsFromSupportPlan(
  userId: string,
  summary: SupportPlanTimelineSummary,
  guidance: SupportPlanGuidance,
  _currentModel: SupportPlanExportModel
): ActionSuggestion[] {
  const suggestions: ActionSuggestion[] = [];
  const now = new Date();

  // 1. 停滞ベースの提案 (P1: High Priority)
  // 90日以上の「意味のある変更」がない場合、アセスメントの形骸化を警告
  if (summary.stagnantSince) {
    const stagnantDate = new Date(summary.stagnantSince);
    const days = Math.floor((now.getTime() - stagnantDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (days >= 90) {
      suggestions.push({
        id: `sp-stagnant-${userId}-${now.getTime()}`,
        stableId: buildStableId('sp-stagnant', userId, now),
        type: 'plan_update',
        priority: 'P1',
        targetUserId: userId,
        title: '支援計画の長期停滞：見直し推奨',
        reason: '90日以上、目標設定や支援内容の構造的な変更が確認されていません。現状の評価が実態と乖離している可能性があります。',
        evidence: {
          metric: '最終構造変更からの経過日数',
          currentValue: `${days}日`,
          threshold: '90日',
          period: '直近四半期',
          sourceRefs: ['timeline.stagnantSince']
        },
        cta: {
          label: 'アセスメントを再考する',
          route: '/support-plan-guide',
          params: { tab: 'assessment', anchor: 'serviceUserName' } // アセスメントの先頭
        },
        createdAt: now.toISOString(),
        ruleId: 'sp-stagnant'
      });
    }
  }

  // 2. 安全対策の空白 (P0: Critical Priority)
  // バージョンを重ねているのに一度も安全対策が更新されていないケース
  if (summary.totalVersions >= 3 && summary.criticalSafetyUpdates === 0) {
    suggestions.push({
      id: `sp-safety-gap-${userId}-${now.getTime()}`,
      stableId: buildStableId('sp-safety-gap', userId, now),
      type: 'plan_update',
      priority: 'P0',
      targetUserId: userId,
      title: '至急：安全管理手順の形骸化リスク',
      reason: '複数回の計画更新が行われていますが、事故防止策や緊急時対応手順のブラッシュアップが一度も行われていません。',
      evidence: {
        metric: '重要安全更新回数',
        currentValue: '0回',
        threshold: '1回以上',
        period: `全${summary.totalVersions}バージョン`,
        sourceRefs: ['timeline.criticalSafetyUpdates']
      },
      cta: {
        label: 'リスク管理を更新する',
        route: '/support-plan-guide',
        params: { tab: 'risk', anchor: 'riskManagement' }
      },
      createdAt: now.toISOString(),
      ruleId: 'sp-safety-gap'
    });
  }

  // 3. クリティカル・ガイダンスの昇格 (P0: Critical Action)
  // ガイダンスエンジンが検出した「致命的不備」は即座にアクションへ変換
  guidance.items
    .filter(item => item.severity === 'critical')
    .forEach((item, idx) => {
      suggestions.push({
        id: `sp-guidance-${item.type}-${userId}-${idx}`,
        stableId: buildStableId(`sp-guidance-${item.type}`, userId, now),
        type: 'plan_update',
        priority: 'P0',
        targetUserId: userId,
        title: 'コンプライアンス：必須項目の修正',
        reason: item.message,
        evidence: {
          metric: 'ガイダンス判定',
          currentValue: item.severity,
          threshold: 'info',
          period: '現在ドラフト',
        },
        cta: {
          label: item.actionLabel || '修正を開始する',
          route: '/support-plan-guide',
          params: item.fieldKey
            ? {
                tab: item.type === 'safety' ? 'risk' : 'compliance',
                anchor: item.fieldKey,
              }
            : {
                tab: item.type === 'safety' ? 'risk' : 'compliance',
              }
        },
        createdAt: now.toISOString(),
        ruleId: `sp-guidance-${item.type}`
      });
    });

  return suggestions;
}
