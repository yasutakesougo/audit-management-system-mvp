import type { ChecklistInsertDTO, ChecklistItem, ChecklistItemDTO } from '../types';

/**
 * DTOから内部モデルへの変換
 */
export function mapToChecklistItem(dto: ChecklistItemDTO): ChecklistItem {
  return {
    id: dto.RuleID,
    label: dto.RuleName,
    value: dto.EvaluationLogic ?? null,
    note: null, // 現在のスキーマには備考フィールドがない
    required: undefined,
    severityLevel: dto.SeverityLevel,
    validFrom: dto.ValidFrom ?? null,
    validTo: dto.ValidTo ?? null,
  };
}

/**
 * チェックリストの表示フィルタリング
 * ruleId が指定されている場合は RuleID (item.id) が完全一致するもののみを返す
 */
export function filterChecklistItems(
  items: ChecklistItem[],
  ruleIdFilter?: string | null
): ChecklistItem[] {
  if (!ruleIdFilter) return items;
  const filterVal = ruleIdFilter.trim();
  if (filterVal === '') return items;

  return items.filter(item => item.id === filterVal);
}

/**
 * 新規登録フォームのバリデーション
 */
export function isValidChecklistInsert(form: Partial<ChecklistInsertDTO>): boolean {
  const title = (form.Title ?? '').trim();
  const ruleId = (form.RuleID ?? '').trim();
  const ruleName = (form.RuleName ?? '').trim();

  return title.length > 0 && ruleId.length > 0 && ruleName.length > 0;
}

/**
 * チェックリストの表示順の制御
 * 現状の暗黙的仕様（追加したものが上に来る、既存はAPI取得順）を維持するため
 * 引数の配列をそのまま返す（将来的な明示ルールの保護バリアとして機能）
 */
export function sortChecklistItems(items: ChecklistItem[]): ChecklistItem[] {
  return [...items];
}
