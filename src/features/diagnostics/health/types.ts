export type HealthStatus = "pass" | "warn" | "fail";

export type HealthCheckCategory =
  | "config"
  | "auth"
  | "connectivity"
  | "lists"
  | "schema"
  | "permissions";

export type HealthNextAction = {
  label: string;
  kind: "copy" | "link" | "doc";
  value: string;
};

export type HealthCheckResult = {
  key: string;          // "config.requiredEnv"
  label: string;        // 画面表示名
  category: HealthCheckCategory;
  status: HealthStatus;
  summary: string;      // 非エンジニア向け 1行
  detail?: string;      // 技術詳細（折りたたみ）
  evidence?: Record<string, unknown>;
  nextActions: HealthNextAction[];
};

export type HealthReport = {
  generatedAt: string;
  overall: HealthStatus;
  counts: Record<HealthStatus, number>;
  byCategory: Record<
    HealthCheckCategory,
    { overall: HealthStatus; counts: Record<HealthStatus, number> }
  >;
  results: HealthCheckResult[];
};

export type CrudCapability = {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export type SpFieldSpec = {
  internalName: string;
  typeHint?: string; // "Text" | "DateTime" | "Number" | "Choice" | "Lookup" など（表示用）
};

export type ListSpec = {
  key: string;             // "Users_Master" 等（あなたの ListKeys に合わせる）
  displayName: string;     // UI 表示名（SharePoint 上のリストタイトル）
  requiredFields: SpFieldSpec[];
  // CRUD チェックに使う "テスト用 minimal item"
  // （安全：専用列が無い場合でも動くように Title を基本にする）
  createItem: Record<string, unknown>;
  updateItem: Record<string, unknown>;
};

export type HealthContext = {
  // env / feature flags 等（あなたの env.ts を丸ごと渡してOK）
  env: Record<string, unknown>;
  // 診断対象の SharePoint 情報
  siteUrl: string;
  listSpecs: ListSpec[];

  // UI向け
  isProductionLike: boolean;
};
