import { type SpListEntry } from '@/sharepoint/spListRegistry';
import { type FieldSkipStreakResult } from '../../drift/hooks/usePersistentDrift';
import { type SpFieldDef } from '@/lib/sp/types';

export type GovernanceActionType = 'CREATE_FIELD' | 'ENSURE_INDEX' | 'DELETE_INDEX';
export type GovernancePriorityLevel = 'P1_CRITICAL' | 'P2_HIGH' | 'P3_MEDIUM' | 'P4_LOW';

export interface GovernancePriority {
  level: GovernancePriorityLevel;
  score: number;
  risk: 'data_integrity' | 'performance' | 'operational_friction' | 'slight_drift';
  summary: string;     // 3-second conclusion
  details: string[];   // Supporting facts
}

export interface GovernanceRecommendation {
  id: string;
  category: 'structural_drift' | 'index_pressure' | 'schema_optimization';
  severity: 'critical' | 'warning' | 'info';
  listTitle: string;
  listKey: string;
  targetField: string;
  action: {
    type: GovernanceActionType;
    label: string;
    payload: SpFieldDef;
    confidence: 'high' | 'medium' | 'low'; // Decision certainty
    autoExecutable: boolean;               // Safety flag for batching/automation
  };
  reason: string;
  sourceSignal: 'nightly' | 'realtime';
  priority: GovernancePriority;
}

/**
 * Priority Scoring Weights (Higher is more critical)
 */
const CATEGORY_METRICS = {
  structural_drift: { weight: 4.0, risk: 'data_integrity' as const },
  index_pressure: { weight: 2.0, risk: 'performance' as const },
  schema_optimization: { weight: 1.0, risk: 'slight_drift' as const },
};

const LIST_IMPORTANCE: Record<string, number> = {
  'users_master': 2.0,           
  'schedule_events': 1.8,        
  'daily_activity_records': 1.6, 
  'audit_logs': 1.2,             
};

const PRIORITY_LABELS: Record<GovernancePriorityLevel, string> = {
  'P1_CRITICAL': '【要対応】優先度高（影響あり）',
  'P2_HIGH': '【注意】対応検討',
  'P3_MEDIUM': '【確認推奨】状況確認',
  'P4_LOW': '【最適化】構成見直し',
};

/**
 * computePriority — Priority Scoring & Reasoning Engine (v4.3 Operational Readiness)
 */
function computePriority(
  category: keyof typeof CATEGORY_METRICS,
  listKey: string,
  streak: number
): GovernancePriority {
  const metric = CATEGORY_METRICS[category] || CATEGORY_METRICS.schema_optimization;
  const listWeight = LIST_IMPORTANCE[listKey] || 1.0;
  
  const streakBoost = streak >= 10 ? 5.0 :
                      streak >= 7 ? 3.0 : 
                      streak >= 3 ? 1.5 : 0;

  const score = (metric.weight * listWeight) + streakBoost;
  const rawDetails: string[] = [];

  // 1. Analyze Core Impact
  const isMaster = listWeight >= 2.0;
  const isCore = listWeight >= 1.5;
  const isStructural = metric.weight >= 4.0;
  const isPersistent = streak >= 3;

  if (isStructural) rawDetails.push('レジストリ契約フィールドの未検出（システム動作に影響）');
  else rawDetails.push('潜在的なパフォーマンス低下の要因を検知');

  if (isMaster) rawDetails.push('認証/利用者管理に関わる基盤マスタリスト');
  else if (isCore) rawDetails.push('日々の業務運営を支える基幹データ');

  if (streak >= 7) rawDetails.push(`不整合が長期化（継続 ${streak} 回）しており、修復を推奨します`);
  else if (isPersistent) rawDetails.push('構成がレジストリ契約から乖離し続けています');

  // 4. Synthesize Structured Summary (3-second conclusion)
  let statusText = '';
  let nextAction = '';

  if (isStructural) {
    statusText = 'に構造不備を検出';
    nextAction = '→ フィールドの作成を推奨';
  } else {
    statusText = 'にパフォーマンス上の懸念';
    nextAction = '→ インデックスの付与を推奨';
  }

  const listName = isMaster ? '基盤資産' : isCore ? '基幹資産' : '標準リスト';
  const streakNote = streak >= 3 ? `（継続 ${streak} 回）` : '';

  const priorityLabel = PRIORITY_LABELS[score >= 11 ? 'P1_CRITICAL' : score >= 7 ? 'P2_HIGH' : score < 4 ? 'P4_LOW' : 'P3_MEDIUM'];
  const summary = `${priorityLabel}${listName}${statusText}${streakNote}${nextAction}`;
  const details = rawDetails.slice(0, 3);

  let level: GovernancePriorityLevel = 'P3_MEDIUM';
  if (score >= 11) level = 'P1_CRITICAL';
  else if (score >= 7) level = 'P2_HIGH';
  else if (score < 4) level = 'P4_LOW';

  return { level, score, risk: metric.risk, summary, details };
}

/**
 * deriveGovernanceRecommendations — アドバイザー推論エンジン (v4.3 Operational Readiness)
 */
export function deriveGovernanceRecommendations(
  registry: readonly SpListEntry[],
  persistentDrifts: FieldSkipStreakResult[]
): GovernanceRecommendation[] {
  const recommendations: GovernanceRecommendation[] = [];

  for (const drift of persistentDrifts) {
    const [listKey, fieldInternalName] = drift.reasonKey.split(':');
    const entry = registry.find(e => e.key === listKey);
    if (!entry) continue;

    const listTitle = entry.resolve();
    const fieldDef = entry.provisioningFields?.find(f => f.internalName === fieldInternalName);

    if (fieldDef) {
       const priority = computePriority('structural_drift', listKey, drift.streak);
       
       // Confidence & Automation Logic v4.3
       const isStructural = priority.risk === 'data_integrity';
       const isChronic = drift.streak >= 7;
       const isMaster = (LIST_IMPORTANCE[listKey] || 1.0) >= 2.0;

       const confidence = isStructural && isChronic ? 'high' : 
                         isStructural || isChronic ? 'medium' : 'low';
                         
       const autoExecutable = isStructural && isChronic && isMaster;

       recommendations.push({
         id: `drift:${drift.reasonKey}`,
         category: 'structural_drift',
         severity: priority.level === 'P1_CRITICAL' ? 'critical' : 'warning',
         listTitle,
         listKey,
         targetField: fieldInternalName,
         action: {
           type: 'CREATE_FIELD',
           label: `不整合の修復: ${fieldInternalName}`,
           payload: fieldDef,
           confidence,
           autoExecutable,
         },
         reason: `Nightly Patrol が長期に渡り ${listTitle} の不整合を検知しています。レジストリ契約に基づき、環境の健全性を回復させることをお勧めします。`,
         sourceSignal: 'nightly',
         priority
       });
    }
  }

  return recommendations.sort((a, b) => b.priority.score - a.priority.score);
}
