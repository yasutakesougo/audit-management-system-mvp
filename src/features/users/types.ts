/**
 * Users domain types
 *
 * PR-B: schema.ts 由来の z.infer 型を "新しい正" として export。
 * IUserMaster / IUserMasterCreateDto は fields.ts から引き続き re-export し、
 * 既存コードの互換性を維持する。
 *
 * 移行方針:
 *   - 新規コードは UserCore / UserDetail / UserFull を使用
 *   - 既存コードは IUserMaster のまま動く
 *   - PR-C で fields.ts の IUserMaster 自体を UserFull 由来に置換
 */
import type { IUserMaster, IUserMasterCreateDto } from '../../sharepoint/fields';
import type { UserCore, UserDetail, UserFull } from './schema';

// ---------------------------------------------------------------------------
// Schema-derived types (SSOT = schema.ts) — 新規コード向け
// ---------------------------------------------------------------------------
export type { UserCore, UserDetail, UserFull };

// ---------------------------------------------------------------------------
// Legacy re-exports — 既存コードの互換性維持
// ---------------------------------------------------------------------------
    export type { IUserMaster, IUserMasterCreateDto };
