/**
 * Lot1B PR #E — Repository-level overlay helpers.
 *
 * `DataProviderUserRepository` の read/write 経路で使う薄いアダプタ。
 * ここに閉じ込めることで、リポジトリ本体の変更を最小化しつつ
 * CUTOVER STEP 5 段を挟み込める。
 */

import type { IUserMasterCreateDto } from '../../../types';
import {
  USER_BENEFIT_PROFILE_MIGRATING_COLUMNS,
  type MigratingColumnDef,
} from './columns';
import { mapMigratingFields, type SharePointRawItem } from './readMapper';
import { buildMigratingFieldsPayload } from './writeMapper';
import type { CutoverStageValue } from './stage';

const toPascal = (camel: string): string => camel.charAt(0).toUpperCase() + camel.slice(1);

/**
 * DTO (PascalCase) から migrating 6列分の domainKey patch を抽出。
 * DTO に明示的に含まれる値のみ対象（undefined は送らない）。
 */
export const extractMigratingDomainPatch = (
  payload: Partial<IUserMasterCreateDto>,
): Record<string, unknown> => {
  const patch: Record<string, unknown> = {};
  for (const col of USER_BENEFIT_PROFILE_MIGRATING_COLUMNS) {
    const pascalKey = toPascal(col.domainKey) as keyof IUserMasterCreateDto;
    if (pascalKey in payload) {
      const val = payload[pascalKey];
      if (val !== undefined) patch[col.domainKey] = val;
    }
  }
  return patch;
};

/**
 * washRow 済みの benefit 行に、stage に応じた read cutover を上書き適用する。
 * - domainKey の値を canonical / legacy から正しく解決し直す
 * - domainKey (camelCase) を対応する canonical (PascalCase) に変換して上書き
 * - 既存の washRow 出力を破壊しないよう新オブジェクトを返す
 */
export const applyBenefitCutoverRead = (
  washedRow: Record<string, unknown>,
  rawRow: SharePointRawItem,
  stage: CutoverStageValue,
): Record<string, unknown> => {
  const overlay = mapMigratingFields(rawRow, stage);
  return { ...washedRow, ...overlay };
};

/**
 * benefit への accessory 書き込みリクエストに、stage に応じた write cutover を適用する。
 *
 * 手順:
 *   1. filteredRequest から migrating 6列のキー（canonical / legacy どちらも）を剥がす
 *   2. DTO から domainKey patch を抽出し、stage に応じた write payload を生成
 *   3. 生成した payload をマージ
 *
 * これにより、既存 toRequest が resolved mapping 経由で１つの物理名にしか書かない制約を回避し、
 * dual-write / canonical-only の切替を後段で強制できる。
 */
export const applyBenefitCutoverWrite = (
  filteredRequest: Record<string, unknown>,
  payload: Partial<IUserMasterCreateDto>,
  stage: CutoverStageValue,
): Record<string, unknown> => {
  const next = { ...filteredRequest };
  for (const col of USER_BENEFIT_PROFILE_MIGRATING_COLUMNS) {
    delete next[col.canonical];
    delete next[col.legacy];
  }
  const domainPatch = extractMigratingDomainPatch(payload);
  if (Object.keys(domainPatch).length === 0) return next;
  const cutoverPayload = buildMigratingFieldsPayload(domainPatch, stage);
  return { ...next, ...cutoverPayload };
};

export { USER_BENEFIT_PROFILE_MIGRATING_COLUMNS, type MigratingColumnDef };
