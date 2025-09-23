// 型定義: チェックリストのアイテム/保存DTO/ユーティリティ

export interface ChecklistItem {
  id: string;                 // 安定ID（例: "plan.createdAt"）
  label: string;              // 表示名
  required?: boolean;         // 必須か
  value?: string | null;      // ISO日付やテキスト
  note?: string | null;       // 備考
}

export interface ChecklistInsertDTO {
  Title: string;              // SharePoint の既定タイトル
  cr013_key: string;          // id に相当（内部名例）
  cr013_value?: string | null;
  cr013_note?: string | null;
}

export interface ChecklistItemDTO {
  Id: number;
  Title: string;
  cr013_key: string;
  cr013_value?: string | null;
  cr013_note?: string | null;
}

export function mapToChecklistItem(dto: ChecklistItemDTO): ChecklistItem {
  return {
    id: dto.cr013_key,
    label: dto.Title,
    value: dto.cr013_value ?? null,
    note: dto.cr013_note ?? null,
    required: undefined,
  };
}
