// SharePoint フィールド/リスト定義（本番スキーマ対応）

// === Interfaces ===
export interface IUserMaster {
  Id: number;                 // SP Item ID
  UserID: string;
  FullName: string;
  ContractDate?: string;      // ISO (yyyy-MM-dd or ISO 8601)
  IsHighIntensitySupportTarget?: boolean;
  ServiceStartDate?: string;
  ServiceEndDate?: string | null;
}

export interface IUserMasterCreateDto {
  UserID: string;
  FullName: string;
  ContractDate?: string;
  IsHighIntensitySupportTarget?: boolean;
  ServiceStartDate?: string;
  ServiceEndDate?: string | null;
}

// ほかのモデルを追加する場合はここに

// === List Keys ===
export enum ListKeys {
  UsersMaster = "Users_Master",
  // StaffMaster = "Staff_Master",
  // PerformanceSlips = "Performance_Slips",
}

// === リスト表示名設定 ===
export const LIST_CONFIG: Record<ListKeys, { title: string }> = {
  [ListKeys.UsersMaster]: { title: "Users_Master" },
  // [ListKeys.StaffMaster]: { title: "Staff_Master" },
  // [ListKeys.PerformanceSlips]: { title: "Performance_Slips" },
};

// === 論理名 → SP 内部列名マップ ===
// 内部列名は PnP テンプレートの StaticName/PascalCase を使用
export const FIELD_MAP = {
  Users_Master: {
    id: "Id",
    userId: "UserID",
    fullName: "FullName",
    contractDate: "ContractDate",
    isHighIntensitySupportTarget: "IsHighIntensitySupportTarget",
    serviceStartDate: "ServiceStartDate",
    serviceEndDate: "ServiceEndDate",
  },
  // Staff_Master: { ... },
  // Performance_Slips: { ... },
} as const;

// SELECT に使う既定列（Users）
export const USERS_SELECT_FIELDS = [
  "Id",
  "UserID",
  "FullName",
  "ContractDate",
  "IsHighIntensitySupportTarget",
  "ServiceStartDate",
  "ServiceEndDate",
] as const;
