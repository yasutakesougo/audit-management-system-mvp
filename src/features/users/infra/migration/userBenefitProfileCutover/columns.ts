/**
 * Lot1B PR #E — UserBenefit_Profile optional 6-column rename-migrate SSOT.
 *
 * Each column declares:
 *   - domainKey   : 内部ドメイン名（read/write 両 mapper で参照するキー）
 *   - canonical   : 移行先 (new) internal name
 *   - legacy      : 現行の `_x0020_` エンコード internal name (old)
 *   - ssotType    : field type（backfill・provision 用メタ）
 *
 * CUTOVER STEP 5段との対応:
 *   1. write two-write : canonical + legacy 両方へ書き込む
 *   2. read fallback   : read mapper が canonical を優先し、null/undefined のときのみ legacy
 *   3. backfill        : scripts/ops/migrate-user-benefit-profile-optional.mjs
 *   4. read cutover    : read mapper が canonical のみ参照（stage=READ_CUTOVER 以降）
 *   5. write cutover   : write mapper が canonical のみ書き込み（stage=WRITE_CUTOVER）
 *
 * 横展開: 新規列を MIGRATING_COLUMNS に追記するだけで 6 列と同一セマンティクスが適用される。
 */

export type MigratingColumnDef = {
  readonly domainKey: string;
  readonly canonical: string;
  readonly legacy: string;
  readonly ssotType: 'Text' | 'DateTime';
};

export const USER_BENEFIT_PROFILE_MIGRATING_COLUMNS: readonly MigratingColumnDef[] = [
  { domainKey: 'copayPaymentMethod', canonical: 'CopayPaymentMethod',  legacy: 'Copay_x0020_Payment_x0020_Method',    ssotType: 'Text' },
  { domainKey: 'grantMunicipality',  canonical: 'GrantMunicipality',   legacy: 'Grant_x0020_Municipality',             ssotType: 'Text' },
  { domainKey: 'grantPeriodStart',   canonical: 'GrantPeriodStart',    legacy: 'Grant_x0020_Period_x0020_Start',       ssotType: 'DateTime' },
  { domainKey: 'grantPeriodEnd',     canonical: 'GrantPeriodEnd',      legacy: 'Grant_x0020_Period_x0020_End',         ssotType: 'DateTime' },
  { domainKey: 'mealAddition',       canonical: 'MealAddition',        legacy: 'Meal_x0020_Addition',                  ssotType: 'Text' },
  { domainKey: 'userCopayLimit',     canonical: 'UserCopayLimit',      legacy: 'User_x0020_Copay_x0020_Limit',         ssotType: 'Text' },
] as const;

export const USER_BENEFIT_PROFILE_MIGRATING_COLUMN_BY_DOMAIN_KEY: Readonly<Record<string, MigratingColumnDef>> =
  Object.freeze(
    Object.fromEntries(USER_BENEFIT_PROFILE_MIGRATING_COLUMNS.map((c) => [c.domainKey, c])),
  );

export type MigratingColumnDomainKey = (typeof USER_BENEFIT_PROFILE_MIGRATING_COLUMNS)[number]['domainKey'];
