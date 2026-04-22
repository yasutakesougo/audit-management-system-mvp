/**
 * SharePoint リスト レジストリ — 公開入口
 *
 * 定義の実体は `spListRegistry.definitions.ts` に集約し、
 * 本ファイルは既存 import パスを維持するための薄い facade とする。
 * これにより `@/sharepoint/spListRegistry` を唯一の公開 API としつつ、
 * 実定義の二重管理を解消する。
 */

import {
  attendanceListEntries,
  complianceListEntries,
  dailyListEntries,
  handoffListEntries,
  masterListEntries,
  meetingListEntries,
  otherListEntries,
  scheduleListEntries,
} from './spListRegistry.definitions';
import type { SpListCategory, SpListEntry } from './spListRegistry.shared';

export {
  envOr,
  fromConfig,
} from './spListRegistry.shared';
export type {
  SpListCategory,
  SpListEntry,
  SpListLifecycle,
  SpListOperation,
} from './spListRegistry.shared';

/**
 * SharePoint リスト レジストリ — 全リストの Single Source of Truth
 */
export const SP_LIST_REGISTRY = [
  ...masterListEntries,
  ...dailyListEntries,
  ...attendanceListEntries,
  ...scheduleListEntries,
  ...meetingListEntries,
  ...handoffListEntries,
  ...complianceListEntries,
  ...otherListEntries,
] as const satisfies readonly SpListEntry[];

/** キーでリスト定義を取得 */
export const findListEntry = (key: string): SpListEntry | undefined =>
  SP_LIST_REGISTRY.find((e) => e.key === key);

/** カテゴリでフィルタ */
export const getListsByCategory = (category: SpListCategory): SpListEntry[] =>
  SP_LIST_REGISTRY.filter((e) => e.category === category) as SpListEntry[];
