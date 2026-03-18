/**
 * ISP 三層モデル — Zod バリデーションスキーマ
 *
 * ADR-005 準拠。SharePoint 行のパースおよびフォーム入力のバリデーションに使用する。
 *
 * 設計方針:
 *   - SP REST API レスポンスを安全にパースする `*SpRowSchema` 系
 *   - フォーム入力を検証する `*FormSchema` 系
 *   - 一覧表示用の軽量型 `*ListItemSchema` 系
 *
 * @deprecated Use imports from `@/domain/isp` or `@/domain/isp/index` directly.
 */

export * from './index';
