/**
 * ISP 三層モデル — Zod バリデーションスキーマ (後方互換エントリポイント)
 *
 * ⚠️ このファイルは後方互換のために残す委譲ファイルです。
 *    実装は `schema/` ディレクトリに分割されています。
 *    新規コードは以下を import してください:
 *
 *    import { ... } from '@/domain/isp/schema/ispBaseSchema';
 *    import { ... } from '@/domain/isp/schema/ispComplianceSchema';
 *    import { ... } from '@/domain/isp/schema/ispPlanningSheetSchema';
 *    import { ... } from '@/domain/isp/schema/ispProcedureRecordSchema';
 *    import { ... } from '@/domain/isp/schema/ispViewTypes';
 *
 *    または barrel 経由：
 *    import { ... } from '@/domain/isp/schema';  // この委譲ファイルと同じ
 *
 * ADR-005 準拠。SharePoint 行のパースおよびフォーム入力のバリデーションに使用する。
 *
 * @see docs/adr/ADR-005-isp-three-layer-separation.md
 * @see src/domain/isp/types.ts
 */

export * from './schema/index';
