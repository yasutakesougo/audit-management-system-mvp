// 型定義: コンプライアンスチェックルール

export interface ChecklistItem {
  id: string;                 // RuleID
  label: string;              // RuleName（表示名）
  required?: boolean;         // 必須か
  value?: string | null;      // EvaluationLogic（評価ロジック）
  note?: string | null;       // 備考
  severityLevel?: 'INFO' | 'WARN' | 'ERROR';
  validFrom?: string | null;  // 適用開始日
  validTo?: string | null;    // 適用終了日
}

export interface ChecklistInsertDTO {
  Title: string;              // SharePoint の既定タイトル
  RuleID: string;             // ルールID
  RuleName: string;           // ルール名
  EvaluationLogic?: string | null;  // 要件式（評価ロジック）
  ValidFrom?: string | null;  // 適用開始日
  ValidTo?: string | null;    // 適用終了日
  SeverityLevel?: 'INFO' | 'WARN' | 'ERROR';  // 警告レベル
}

export interface ChecklistItemDTO {
  Id: number;
  Title: string;
  RuleID: string;
  RuleName: string;
  EvaluationLogic?: string | null;
  ValidFrom?: string | null;
  ValidTo?: string | null;
  SeverityLevel?: 'INFO' | 'WARN' | 'ERROR';
}

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
