import { AutonomyLevel, GovernanceDecision } from '@/features/diagnostics/governance/governanceEngine';

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
  governance?: GovernanceDecision;
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
  isEssential?: boolean; // 必須列かどうか（欠落時にFAILにするかWARNにするか）
  typeHint?: string; // "Text" | "DateTime" | "Number" | "Choice" | "Lookup" など（表示用）
  /** drift 吸収用の候補名リスト。未指定時は [internalName] のみで解決 */
  candidates?: string[];
  /** 退役予定のレガシーな物理列名リスト（検出時に WARN ではなく tolerated と表示する） */
  legacyCandidates?: string[];
  /** 欠落していても WARN を出さない（isSilent） */
  isSilent?: boolean;
  /** 退役予定のレガシー列（解決時に WARN ではなく tolerated と表示する） */
  isLegacy?: boolean;
};

export type ListSpec = {
  key: string;             // "Users_Master" 等（あなたの ListKeys に合わせる）
  displayName: string;     // UI 表示名（SharePoint 上のリストタイトル）
  resolvedTitle: string;   // 解決済みの物理リスト名
  requiredFields: SpFieldSpec[];
  // CRUD チェックに使う "テスト用 minimal item"
  // （安全：専用列が無い場合でも動くように Title を基本にする）
  createItem: Record<string, unknown>;
  updateItem: Record<string, unknown>;
  isReadOnly?: boolean;
  isOptional?: boolean;
  isDeleteOptional?: boolean;
};

export type HealthContext = {
  // env / feature flags 等（あなたの env.ts を丸ごと渡してOK）
  env: Record<string, unknown>;
  // 診断対象の SharePoint 情報
  siteUrl: string;
  listSpecs: () => ListSpec[];

  // UI向け
  isProductionLike: boolean;
  autonomyLevel: AutonomyLevel;
};
