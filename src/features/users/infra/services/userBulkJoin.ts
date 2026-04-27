import { washRow } from '@/lib/sp/helpers';

import { applyBenefitCutoverRead } from '../migration/userBenefitProfileCutover';
import type { CutoverStageValue } from '../migration/userBenefitProfileCutover/stage';
import type { IUserMaster } from '../../types';
import type { UserJoiner } from './UserJoiner';

/**
 * Map keyed by UserID to a single accessory row.
 * Values are raw (un-washed) SharePoint rows so that downstream
 * `washRow` and `applyBenefitCutoverRead` can operate on them.
 */
export type AccessoryRowMap = Map<string, Record<string, unknown>>;

export interface AccessoryListContext {
  map: AccessoryRowMap;
  candidates: Record<string, string[]>;
  resolved: Record<string, string | undefined>;
}

export interface BulkJoinContext {
  transport: AccessoryListContext;
  benefit: AccessoryListContext;
  benefitExt: AccessoryListContext;
  joiner: UserJoiner;
  benefitCutoverStage: CutoverStageValue;
}

/**
 * Group raw accessory rows by their UserID join key.
 *
 * Pure function: no I/O. The first row encountered for a given UserID wins,
 * matching the previous `top: 1` per-user fetch behavior. Rows whose join
 * value is missing or non-string are skipped.
 */
export function groupRowsByUserId(
  rows: ReadonlyArray<Record<string, unknown>>,
  userIdField: string,
): AccessoryRowMap {
  const map: AccessoryRowMap = new Map();
  for (const row of rows) {
    const raw = row[userIdField];
    const userId = typeof raw === 'string' ? raw : raw == null ? '' : String(raw);
    if (!userId) continue;
    if (!map.has(userId)) {
      map.set(userId, row);
    }
  }
  return map;
}

/**
 * Build the minimal `$select` field list for an accessory list bulk fetch
 * from a resolved-fields mapping. Only includes physical names that were
 * actually resolved, plus `Id` (always required by SharePoint).
 */
export function buildAccessorySelect(resolved: Record<string, string | undefined>): string[] {
  const fields = new Set<string>(['Id']);
  for (const value of Object.values(resolved)) {
    if (typeof value === 'string' && value.length > 0) {
      fields.add(value);
    }
  }
  return Array.from(fields);
}

/**
 * Pure function: join already-fetched main user rows with already-fetched
 * accessory list rows (passed as in-memory maps). No I/O performed here.
 *
 * For each user, looks up by `user.UserID` in each accessory map, washes
 * the matched raw row, applies the benefit cutover overlay if applicable,
 * sanitizes columns owned by the accessory, and merges the values back.
 */
export function joinUsersWithAccessoryMaps(
  users: ReadonlyArray<IUserMaster>,
  context: BulkJoinContext,
): IUserMaster[] {
  return users.map((user) => {
    const userId = user.UserID;
    if (!userId) return user;

    const transportRaw = context.transport.map.get(userId);
    const benefitRaw = context.benefit.map.get(userId);
    const benefitExtRaw = context.benefitExt.map.get(userId);

    const transport = transportRaw
      ? washRow(transportRaw, context.transport.candidates, context.transport.resolved)
      : undefined;
    let benefit = benefitRaw
      ? washRow(benefitRaw, context.benefit.candidates, context.benefit.resolved)
      : undefined;
    const benefitExt = benefitExtRaw
      ? washRow(benefitExtRaw, context.benefitExt.candidates, context.benefitExt.resolved)
      : undefined;

    if (benefit && benefitRaw) {
      benefit = applyBenefitCutoverRead(benefit, benefitRaw, context.benefitCutoverStage);
    }

    const sanitized = context.joiner.sanitizeDomainRecord(user, !!transport, !!benefit, !!benefitExt);
    return context.joiner.mergeExtraData(
      sanitized,
      transport as Record<string, unknown> | undefined,
      benefit as Record<string, unknown> | undefined,
      benefitExt as Record<string, unknown> | undefined,
    );
  });
}
