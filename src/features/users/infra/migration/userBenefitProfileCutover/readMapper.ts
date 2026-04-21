/**
 * Lot1B PR #E — read mapper (CUTOVER STEP 2 & 4 対応).
 *
 * stage に応じて `new ?? old` fallback と canonical-only を切替える。
 *
 *   PRE_MIGRATION / DUAL_WRITE / BACKFILL_IN_PROGRESS
 *     → canonical を読み、空なら legacy にフォールバック（既存挙動互換）
 *   READ_CUTOVER 以降
 *     → canonical のみ読む（legacy には戻らない）
 *
 * 呼び出し側（例: SharePointUserRepository）は `mapMigratingFields(raw, stage)` を呼ぶだけ。
 */

import {
  USER_BENEFIT_PROFILE_MIGRATING_COLUMNS,
  type MigratingColumnDef,
} from './columns';
import { CutoverStage, isAtLeastStage, type CutoverStageValue } from './stage';

export type SharePointRawItem = Readonly<Record<string, unknown>>;

export type MigratingFieldReadResult = Record<string, unknown>;

const readCanonicalOrLegacy = (
  raw: SharePointRawItem,
  column: MigratingColumnDef,
  stage: CutoverStageValue,
): unknown => {
  const canonicalValue = raw[column.canonical];
  if (isAtLeastStage(stage, CutoverStage.READ_CUTOVER)) {
    return canonicalValue ?? null;
  }
  if (canonicalValue !== undefined && canonicalValue !== null) {
    return canonicalValue;
  }
  return raw[column.legacy] ?? null;
};

export const mapMigratingFields = (
  raw: SharePointRawItem,
  stage: CutoverStageValue,
): MigratingFieldReadResult => {
  const result: MigratingFieldReadResult = {};
  for (const column of USER_BENEFIT_PROFILE_MIGRATING_COLUMNS) {
    result[column.domainKey] = readCanonicalOrLegacy(raw, column, stage);
  }
  return result;
};

/**
 * $select に含めるべき internal name の集合。
 * stage ごとに canonical のみ / 両方 を返す。
 */
export const getSelectFieldsForStage = (stage: CutoverStageValue): readonly string[] => {
  if (isAtLeastStage(stage, CutoverStage.READ_CUTOVER)) {
    return USER_BENEFIT_PROFILE_MIGRATING_COLUMNS.map((c) => c.canonical);
  }
  return USER_BENEFIT_PROFILE_MIGRATING_COLUMNS.flatMap((c) => [c.canonical, c.legacy]);
};
