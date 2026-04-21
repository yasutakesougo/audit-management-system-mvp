/**
 * Lot1B PR #E — write mapper (CUTOVER STEP 1 & 5 対応).
 *
 * stage に応じて書き込み先を切替える:
 *
 *   PRE_MIGRATION
 *     → legacy のみ（既存挙動。本 lot 着手前の状態を保持可能）
 *   DUAL_WRITE / BACKFILL_IN_PROGRESS / READ_CUTOVER
 *     → canonical + legacy 両方（step 1 の「二重書き」）
 *   WRITE_CUTOVER
 *     → canonical のみ（step 5）
 *
 * rollback 時は stage を下げるだけで二重書き or legacy-only に戻せる（legacy 列残置が前提）。
 */

import {
  USER_BENEFIT_PROFILE_MIGRATING_COLUMNS,
  USER_BENEFIT_PROFILE_MIGRATING_COLUMN_BY_DOMAIN_KEY,
  type MigratingColumnDef,
} from './columns';
import { CutoverStage, isAtLeastStage, type CutoverStageValue } from './stage';

export type DomainPatch = Readonly<Record<string, unknown>>;
export type SharePointWritePayload = Record<string, unknown>;

const writeTargets = (
  column: MigratingColumnDef,
  stage: CutoverStageValue,
): readonly string[] => {
  if (isAtLeastStage(stage, CutoverStage.WRITE_CUTOVER)) return [column.canonical];
  if (isAtLeastStage(stage, CutoverStage.DUAL_WRITE)) return [column.canonical, column.legacy];
  return [column.legacy]; // PRE_MIGRATION
};

export const buildMigratingFieldsPayload = (
  patch: DomainPatch,
  stage: CutoverStageValue,
): SharePointWritePayload => {
  const payload: SharePointWritePayload = {};
  for (const [domainKey, value] of Object.entries(patch)) {
    const column = USER_BENEFIT_PROFILE_MIGRATING_COLUMN_BY_DOMAIN_KEY[domainKey];
    if (!column) continue;
    for (const target of writeTargets(column, stage)) {
      payload[target] = value;
    }
  }
  return payload;
};

/**
 * stage ごとの書き込み対象 internal name 集合（provision 検証 / lint 用）。
 */
export const getWriteFieldsForStage = (stage: CutoverStageValue): readonly string[] =>
  USER_BENEFIT_PROFILE_MIGRATING_COLUMNS.flatMap((c) => writeTargets(c, stage));
