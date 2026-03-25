/**
 * groupExceptionsByParent — parentId ベースの親子グルーピング
 *
 * ExceptionItem[] を受け取り、parentId の有無で親/子を分離し、
 * 親の直後に対応する子を並べた表示順リストを返す。
 *
 * ## 設計意図
 * - ExceptionTable の折りたたみ UI を支える純粋関数
 * - 親がいない orphan 子は通常の行として扱う
 * - 子の件数を親に付与し「集約（3件）」のように表示できる
 *
 * @see buildTransportExceptions.ts - parentId の生成元
 */

import type { ExceptionItem, ExceptionSeverity } from './exceptionLogic';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ParentChildGroup = {
  /** 親 Exception */
  parent: ExceptionItem;
  /** 子 Exception 群 */
  children: ExceptionItem[];
  /** 子の中で最も高い severity */
  highestChildSeverity: ExceptionSeverity;
};

export type FlatWithGroupInfo =
  | { kind: 'parent'; item: ExceptionItem; childCount: number; highestChildSeverity: ExceptionSeverity }
  | { kind: 'child'; item: ExceptionItem; parentId: string }
  | { kind: 'standalone'; item: ExceptionItem };

// ─── Severity Ordering ──────────────────────────────────────────────────────

const SEVERITY_RANK: Record<ExceptionSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function highestSeverity(items: ExceptionItem[]): ExceptionSeverity {
  if (items.length === 0) return 'low';
  let best: ExceptionSeverity = 'low';
  for (const item of items) {
    if (SEVERITY_RANK[item.severity] < SEVERITY_RANK[best]) {
      best = item.severity;
    }
  }
  return best;
}

// ─── Core Function ──────────────────────────────────────────────────────────

/**
 * ExceptionItem[] を parentId で構造化し、
 * 親 → 子の順序で並べた FlatWithGroupInfo[] を返す。
 *
 * parentId を持たないアイテムは:
 * - 子を持つ場合 → `parent` として扱う
 * - 子を持たない場合 → `standalone` として扱う
 */
export function groupExceptionsByParent(
  items: ExceptionItem[],
): FlatWithGroupInfo[] {
  // Step 1: 子を parentId でグループ化
  const childrenMap = new Map<string, ExceptionItem[]>();
  const parentIds = new Set<string>();

  for (const item of items) {
    if (item.parentId) {
      parentIds.add(item.parentId);
      const existing = childrenMap.get(item.parentId) ?? [];
      existing.push(item);
      childrenMap.set(item.parentId, existing);
    }
  }

  // Step 2: 親 → 子の順で flat list を構築
  const result: FlatWithGroupInfo[] = [];

  for (const item of items) {
    if (item.parentId) continue; // 子は親の後に追加するのでスキップ

    const children = childrenMap.get(item.id);

    if (children && children.length > 0) {
      result.push({
        kind: 'parent',
        item,
        childCount: children.length,
        highestChildSeverity: highestSeverity(children),
      });
      for (const child of children) {
        result.push({
          kind: 'child',
          item: child,
          parentId: item.id,
        });
      }
    } else {
      result.push({ kind: 'standalone', item });
    }
  }

  // Step 3: 親が見つからない orphan 子を standalone として追加
  for (const item of items) {
    if (item.parentId && !items.some((i) => i.id === item.parentId)) {
      result.push({ kind: 'standalone', item });
    }
  }

  return result;
}

// ─── Initial Expansion Logic ────────────────────────────────────────────────

/**
 * 初期表示時に展開する親 ID の Set を返す。
 *
 * ルール:
 * - 子に critical または high が1件でもある → 展開
 * - それ以外 → 折りたたみ
 */
export function getInitialExpandedParents(
  groups: FlatWithGroupInfo[],
): Set<string> {
  const expanded = new Set<string>();

  for (const group of groups) {
    if (group.kind !== 'parent') continue;
    if (
      group.highestChildSeverity === 'critical' ||
      group.highestChildSeverity === 'high'
    ) {
      expanded.add(group.item.id);
    }
  }

  return expanded;
}
