import type { IcebergSession } from '@/features/analysis/domain/icebergTypes';
import type { BehaviorInterventionPlan } from '@/features/analysis/domain/interventionTypes';
import { createEmptyStrategies } from '@/features/analysis/domain/interventionTypes';

// ---------------------------------------------------------------------------
// 氷山セッション → BehaviorInterventionPlan Draft 変換
//
// links[] の因果関係を行動ノード単位でグルーピングし、
// 「1行動 = 1プラン」の Draft を生成する。
// strategies は空文字（スタッフが埋める想定）。
// ---------------------------------------------------------------------------

/**
 * 氷山セッションの links を分析し、BehaviorInterventionPlan の Draft を生成する。
 *
 * - links の targetNodeId → 行動ノード（水上）
 * - links の sourceNodeId → 要因ノード（水下: assessment / environment）
 * - 行動ノードごとにグルーピングし、要因を triggerFactors に集約
 * - リンクのない行動ノードも空の triggerFactors で Draft を生成
 *
 * @returns 行動ノード数分の BIP Draft（strategies は空）
 */
export function icebergToInterventionDrafts(session: IcebergSession): BehaviorInterventionPlan[] {
  const now = new Date().toISOString();
  const nodeMap = new Map(session.nodes.map((n) => [n.id, n]));

  // 行動ノードを抽出
  const behaviorNodes = session.nodes.filter((n) => n.type === 'behavior');

  if (behaviorNodes.length === 0) return [];

  // links を行動ノード（targetNodeId）でグルーピング
  const triggersByBehavior = new Map<string, Array<{ label: string; nodeId: string }>>();

  for (const link of session.links) {
    const targetNode = nodeMap.get(link.targetNodeId);
    const sourceNode = nodeMap.get(link.sourceNodeId);

    if (!targetNode || !sourceNode) continue;

    // targetが行動、sourceが要因の場合
    if (targetNode.type === 'behavior') {
      const triggers = triggersByBehavior.get(targetNode.id) ?? [];
      // 重複チェック
      if (!triggers.some((t) => t.nodeId === sourceNode.id)) {
        triggers.push({ label: sourceNode.label, nodeId: sourceNode.id });
      }
      triggersByBehavior.set(targetNode.id, triggers);
    }

    // source が行動、target が要因の場合（逆方向リンクも考慮）
    if (sourceNode.type === 'behavior') {
      const triggers = triggersByBehavior.get(sourceNode.id) ?? [];
      if (!triggers.some((t) => t.nodeId === targetNode.id)) {
        triggers.push({ label: targetNode.label, nodeId: targetNode.id });
      }
      triggersByBehavior.set(sourceNode.id, triggers);
    }
  }

  // 行動ノードごとに BIP Draft を生成
  return behaviorNodes.map((behavior) => ({
    id: `bip-${behavior.id}`,
    userId: session.targetUserId,
    targetBehavior: behavior.label,
    targetBehaviorNodeId: behavior.id,
    triggerFactors: triggersByBehavior.get(behavior.id) ?? [],
    strategies: createEmptyStrategies(),
    createdAt: now,
    updatedAt: now,
  }));
}
