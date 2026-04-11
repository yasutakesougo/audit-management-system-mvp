import { readOptionalEnv } from '@/lib/env';
import { LIST_CONFIG, ListKeys } from '@/sharepoint/fields';

export type SpListOperation = 'R' | 'W' | 'D';

export type SpListCategory =
  | 'master'
  | 'daily'
  | 'attendance'
  | 'schedule'
  | 'meeting'
  | 'handoff'
  | 'compliance'
  | 'other';

export type SpListLifecycle =
  | 'required'
  | 'optional'
  | 'deprecated'
  | 'experimental';

export interface SpListEntry {
  key: string;
  displayName: string;
  resolve: () => string;
  operations: readonly SpListOperation[];
  category: SpListCategory;
  essentialFields?: readonly string[];
  provisioningFields?: readonly import('@/lib/sp/types').SpFieldDef[];
  baseTemplate?: number;
  lifecycle: SpListLifecycle;
}

export const envOr = (envKey: string, fallback: string): string => {
  const envVal = readOptionalEnv(envKey);
  if (!envVal) return fallback;
  if (envVal.toLowerCase().startsWith('guid:')) return fallback;
  return envVal;
};

export const fromConfig = (key: ListKeys): string => LIST_CONFIG[key].title;
