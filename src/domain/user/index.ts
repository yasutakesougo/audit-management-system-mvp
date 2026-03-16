/**
 * domain/user — 利用者ドメインの公開 API
 *
 * 利用者マスタと各ドメインを結合するための共通型・ユーティリティを提供。
 */
export {
  // Schemas
  userRefSchema,
  userSnapshotSchema,

  // Types
  type UserRef,
  type UserSnapshot,
  type UserLookup,
  type WithUserRef,
  type WithUserSnapshot,

  // Factory functions
  toUserRef,
  toUserSnapshot,

  // Lookup builders
  buildUserRefLookup,
  buildUserSnapshotLookup,

  // Resolution & enrichment
  resolveUserNames,
  createUserNameResolver,
  enrichWithUserRef,
  enrichAllWithUserRef,
} from './userRelation';
