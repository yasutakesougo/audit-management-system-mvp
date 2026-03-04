/**
 * SharePoint フィールド定義（後方互換バレル）
 *
 * 📌 全エクスポートは fields/ ディレクトリに分割されています。
 * このファイルは既存の 42+ インポート箇所との互換性維持のため、
 * すべてのシンボルを re-export します。
 *
 * 新規コードでは、個別モジュールからの直接インポートを推奨します：
 * @example
 * import { IUserMaster } from '@/sharepoint/fields/userFields';
 * import { SCHEDULE_FIELD_START } from '@/sharepoint/fields/scheduleFields';
 */
export * from './fields/index';
