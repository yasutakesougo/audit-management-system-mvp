/**
 * ISP 三層モデル — スキーマバレル
 *
 * schema.ts の後継。すべての export を再集約する。
 * 既存コードからは '@/domain/isp/schema' で引き続き参照可能（schema.ts が本ファイルに委譲）。
 *
 * 分割構造:
 *   ispBaseSchema.ts         - 共通フィールド + 第1層 ISP
 *   ispComplianceSchema.ts   - コンプライアンスメタデータ + 承認ロジック
 *   ispPlanningSheetSchema.ts - 第2層 支援計画シート
 *   ispProcedureRecordSchema.ts - 第3層 支援手順書兼記録
 *   ispViewTypes.ts          - 合成ビュー型 + 編集状態型
 *
 * @see docs/adr/ADR-005-isp-three-layer-separation.md
 */

// 第1層・共通基盤
export * from './ispBaseSchema';

// コンプライアンスメタデータ
export * from './ispComplianceSchema';

// 第2層: 支援計画シート
export * from './ispPlanningSheetSchema';

// 第3層: 支援手順書兼記録
export * from './ispProcedureRecordSchema';

// 合成ビュー型・編集状態型
export * from './ispViewTypes';
