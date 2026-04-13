import { OPTIONAL_CHILD_PARENT_ORDERS } from '../constants/procedureRows';

/**
 * 指定した手順の親となる行番号を返す
 */
export function getParentOrder(stepOrder: number): number | null {
  return OPTIONAL_CHILD_PARENT_ORDERS.get(stepOrder) ?? null;
}

/**
 * 指定した手順の子（オプション）となる行番号リストを返す
 */
export function getChildOrders(stepOrder: number): number[] {
  const children: number[] = [];
  for (const [childOrder, parentOrder] of OPTIONAL_CHILD_PARENT_ORDERS) {
    if (parentOrder === stepOrder) {
      children.push(childOrder);
    }
  }
  return children.sort((a, b) => a - b);
}

/**
 * 排他関係（親なら全ての子、子ならその親）にある行番号リストを返す
 */
export function getExclusiveOrders(stepOrder: number): number[] {
  const parentOrder = getParentOrder(stepOrder);
  if (parentOrder != null) {
    return [parentOrder];
  }
  return getChildOrders(stepOrder);
}

/**
 * 現在の記録済み状態（filledStepOrders）と照らして、競合している行を返す
 */
export function getConflictingFilledOrders(
  stepOrder: number,
  filledStepOrders: Set<number>,
): number[] {
  return getExclusiveOrders(stepOrder).filter((order) =>
    filledStepOrders.has(order),
  );
}

/**
 * 選択・表示用に、競合の有無と原因行をまとめた状態を返す
 */
export function getSelectableState(
  stepOrder: number,
  filledStepOrders: Set<number>,
): {
  conflicted: boolean;
  blockingOrders: number[];
} {
  const blockingOrders = getConflictingFilledOrders(stepOrder, filledStepOrders);
  return {
    conflicted: blockingOrders.length > 0,
    blockingOrders,
  };
}

/**
 * 記録保存時に、自動的に無効化（または更新）対象とすべき行番号リストを返す
 */
export function getOrdersToInvalidateOnRecord(stepOrder: number): number[] {
  return getExclusiveOrders(stepOrder);
}

/**
 * 選択・記録状態に基づいて、非表示にすべき行を計算する
 * @param selectedOrders 記録済み・または現在選択中の行番号セット
 */
export function getHiddenOrdersBySelection(selectedOrders: Set<number>): number[] {
  const hidden = new Set<number>();

  // PM外活動準備(18) または PM外活動参加(19) が記録されたら、
  // 事ム所内での PM通常ルートの後半（お茶11, PM日中12）を隠す
  if (selectedOrders.has(18) || selectedOrders.has(19)) {
    hidden.add(11);
    hidden.add(12);
  }

  return [...hidden].sort((a, b) => a - b);
}

/**
 * 特定の行が非表示設定かどうかを判定する
 */
export function isStepHidden(
  stepOrder: number,
  selectedOrders: Set<number>,
): boolean {
  return getHiddenOrdersBySelection(selectedOrders).includes(stepOrder);
}

