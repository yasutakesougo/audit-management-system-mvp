/**
 * UserRelation — 利用者マスタと各ドメインを結合する共通型
 *
 * 各ドメイン（ISP, 日次記録, インシデント, 制度判定, 申し送り）が
 * 利用者マスタを統一的に参照するための型定義とヘルパー。
 *
 * 設計方針:
 *   - UserRef: 最小限の利用者参照（ID + 表示名）— 一覧・ピッカーで使用
 *   - UserSnapshot: 制度判定に必要な属性のスナップショット（作成時点を凍結）
 *   - enrichWithUser: 任意のレコードに利用者マスタ情報を結合する汎用関数
 *   - buildUserLookup: 利用者マスタ配列からルックアップマップを構築
 *
 * @example
 * ```ts
 * const lookup = buildUserLookup(users);
 * const enriched = enrichWithUser(ispRecord, lookup);
 * // enriched.user => { userId, userName, severeFlag, ... }
 * ```
 */

import { z } from 'zod';

// ─────────────────────────────────────────────
// UserRef — 最小限の利用者参照（全ドメイン共通）
// ─────────────────────────────────────────────

/**
 * 利用者への最小参照。
 * 一覧表示やドロップダウンで利用者名を解決するために使用。
 */
export const userRefSchema = z.object({
  /** 利用者コード（Users_Master.UserID） */
  userId: z.string().min(1),
  /** 利用者名（Users_Master.FullName） */
  userName: z.string(),
});

export type UserRef = z.infer<typeof userRefSchema>;

// ─────────────────────────────────────────────
// UserSnapshot — 制度判定用スナップショット
// ─────────────────────────────────────────────

/**
 * 制度判定・加算算定に必要な利用者属性のスナップショット。
 * ISP や支援計画シートの作成時点の状態を凍結保存するために使用。
 *
 * Users_Master の属性から必要な項目のみを抽出した "薄い" 射影。
 */
export const userSnapshotSchema = userRefSchema.extend({
  /** 障害支援区分（"1"〜"6" or null） */
  disabilitySupportLevel: z.string().nullable().default(null),
  /** 重度障害者支援フラグ */
  severeFlag: z.boolean().default(false),
  /** 強度行動障害支援対象フラグ */
  isHighIntensitySupportTarget: z.boolean().default(false),
  /** 受給者証番号 */
  recipientCertNumber: z.string().nullable().default(null),
  /** 受給者証有効期限（ISO 8601） */
  recipientCertExpiry: z.string().nullable().default(null),
  /** 支給決定期間開始日 */
  grantPeriodStart: z.string().nullable().default(null),
  /** 支給決定期間終了日 */
  grantPeriodEnd: z.string().nullable().default(null),
  /** 月間支給日数 */
  grantedDaysPerMonth: z.string().nullable().default(null),
  /** 利用状態 */
  usageStatus: z.string().nullable().default(null),
  /** スナップショット取得日時（ISO 8601） */
  snapshotAt: z.string().default(() => new Date().toISOString()),
});

export type UserSnapshot = z.infer<typeof userSnapshotSchema>;

// ─────────────────────────────────────────────
// UserLookup — 利用者マスタの高速検索マップ
// ─────────────────────────────────────────────

/**
 * 利用者マスタのルックアップマップ。
 * UserID → IUserMaster の射影として使用。
 */
export type UserLookup<T extends UserRef = UserRef> = ReadonlyMap<string, T>;

/**
 * IUserMaster 互換の最小インターフェース。
 * features/users に対する依存を持たないように、
 * domain 層では必要なフィールドだけを宣言する。
 */
interface UserMasterLike {
  readonly UserID: string;
  readonly FullName: string;
  readonly DisabilitySupportLevel?: string | null;
  readonly severeFlag?: boolean | null;
  readonly IsHighIntensitySupportTarget?: boolean | null;
  readonly RecipientCertNumber?: string | null;
  readonly RecipientCertExpiry?: string | null;
  readonly GrantPeriodStart?: string | null;
  readonly GrantPeriodEnd?: string | null;
  readonly GrantedDaysPerMonth?: string | null;
  readonly UsageStatus?: string | null;
}

// ─────────────────────────────────────────────
// ファクトリ関数
// ─────────────────────────────────────────────

/**
 * IUserMaster から UserRef を生成する。
 *
 * @example
 * ```ts
 * const ref = toUserRef(user);
 * // { userId: 'U001', userName: '田中太郎' }
 * ```
 */
export function toUserRef(user: UserMasterLike): UserRef {
  return {
    userId: user.UserID,
    userName: user.FullName,
  };
}

/**
 * IUserMaster から UserSnapshot を生成する。
 * 制度判定に必要な属性を現時点の値で凍結する。
 *
 * @example
 * ```ts
 * const snapshot = toUserSnapshot(user);
 * // ISP 作成時に凍結保存
 * ```
 */
export function toUserSnapshot(user: UserMasterLike): UserSnapshot {
  return {
    userId: user.UserID,
    userName: user.FullName,
    disabilitySupportLevel: user.DisabilitySupportLevel ?? null,
    severeFlag: !!user.severeFlag,
    isHighIntensitySupportTarget: !!user.IsHighIntensitySupportTarget,
    recipientCertNumber: user.RecipientCertNumber ?? null,
    recipientCertExpiry: user.RecipientCertExpiry ?? null,
    grantPeriodStart: user.GrantPeriodStart ?? null,
    grantPeriodEnd: user.GrantPeriodEnd ?? null,
    grantedDaysPerMonth: user.GrantedDaysPerMonth ?? null,
    usageStatus: user.UsageStatus ?? null,
    snapshotAt: new Date().toISOString(),
  };
}

/**
 * 利用者マスタ配列から UserRef のルックアップマップを構築する。
 *
 * @example
 * ```ts
 * const lookup = buildUserRefLookup(users);
 * const ref = lookup.get('U001'); // UserRef | undefined
 * ```
 */
export function buildUserRefLookup(users: readonly UserMasterLike[]): UserLookup<UserRef> {
  const map = new Map<string, UserRef>();
  for (const user of users) {
    if (user.UserID) {
      map.set(user.UserID, toUserRef(user));
    }
  }
  return map;
}

/**
 * 利用者マスタ配列から UserSnapshot のルックアップマップを構築する。
 *
 * @example
 * ```ts
 * const lookup = buildUserSnapshotLookup(users);
 * const snap = lookup.get('U001'); // UserSnapshot | undefined
 * ```
 */
export function buildUserSnapshotLookup(users: readonly UserMasterLike[]): UserLookup<UserSnapshot> {
  const map = new Map<string, UserSnapshot>();
  for (const user of users) {
    if (user.UserID) {
      map.set(user.UserID, toUserSnapshot(user));
    }
  }
  return map;
}

/**
 * userId を含むレコード配列を UserRef で名前解決して返すユーティリティ。
 * userName が存在しない場合は userId をフォールバックとして使用。
 *
 * @example
 * ```ts
 * const resolved = resolveUserNames(ispRecords, lookup, r => r.userId);
 * // [{ ...record, userName: '田中太郎' }]
 * ```
 */
export function resolveUserNames<T>(
  records: readonly T[],
  lookup: UserLookup<UserRef>,
  getUserId: (record: T) => string,
): Array<T & { userName: string }> {
  return records.map((record) => {
    const userId = getUserId(record);
    const ref = lookup.get(userId);
    return {
      ...record,
      userName: ref?.userName ?? userId,
    };
  });
}

/**
 * 利用者マスタ配列から userId → userName のシンプルな名前解決関数を返す。
 * TodayEngine など `resolveUserName: (id: string) => string` callback を
 * 要求する箇所で直接使用できる。
 *
 * @example
 * ```ts
 * const resolve = createUserNameResolver(users);
 * resolve('U001'); // '田中太郎'
 * resolve('UNKNOWN'); // 'UNKNOWN' (fallback)
 * ```
 */
export function createUserNameResolver(
  users: readonly UserMasterLike[],
): (userId: string) => string {
  const map = new Map<string, string>();
  for (const user of users) {
    if (user.UserID) {
      map.set(user.UserID, user.FullName);
    }
  }
  return (userId: string) => map.get(userId) ?? userId;
}

// ─────────────────────────────────────────────
// Enrichment 型 — 利用者情報を付与したレコード
// ─────────────────────────────────────────────

/**
 * 利用者マスタ情報を付与したレコードの型ヘルパー。
 *
 * @example
 * ```ts
 * type EnrichedIsp = WithUserRef<IndividualSupportPlan>;
 * // IndividualSupportPlan & { user: UserRef }
 * ```
 */
export type WithUserRef<T> = T & { user: UserRef };
export type WithUserSnapshot<T> = T & { user: UserSnapshot };

/**
 * 単一レコードに UserRef を付与する汎用関数。
 *
 * @returns ユーザーが見つかった場合は WithUserRef<T>、見つからない場合は null
 */
export function enrichWithUserRef<T>(
  record: T,
  userId: string,
  lookup: UserLookup<UserRef>,
): WithUserRef<T> | null {
  const ref = lookup.get(userId);
  if (!ref) return null;
  return { ...record, user: ref };
}

/**
 * レコード配列にバッチで UserRef を付与する汎用関数。
 * ユーザーが見つからないレコードは user に fallback UserRef を使用する。
 *
 * @example
 * ```ts
 * const enriched = enrichAllWithUserRef(incidents, lookup, r => r.userId);
 * enriched[0].user.userName; // '田中太郎'
 * ```
 */
export function enrichAllWithUserRef<T>(
  records: readonly T[],
  lookup: UserLookup<UserRef>,
  getUserId: (record: T) => string,
): Array<WithUserRef<T>> {
  return records.map((record) => {
    const userId = getUserId(record);
    const ref = lookup.get(userId) ?? { userId, userName: userId };
    return { ...record, user: ref };
  });
}
