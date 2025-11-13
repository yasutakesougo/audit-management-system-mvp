import type { UseSP } from '@/lib/spClient';
import { SCHEDULE_FIELD_SERVICE_TYPE } from '@/sharepoint/fields';
import { SERVICE_TYPE_OPTIONS } from '@/sharepoint/serviceTypes';

type SpChoiceFieldResponse = {
  Choices?: { results?: string[] };
  Title?: string;
  InternalName?: string;
};

type ScheduleSpClient = Pick<UseSP, 'spFetch'>;

const encodeForOdata = (value: string): string => value.replace(/'/g, "''");

const uniq = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));

/**
 * Ensure the SharePoint Choice field for ServiceType includes the canonical SERVICE_TYPE_OPTIONS.
 * Adds missing entries while preserving any existing choices for safe rollout.
 */
export async function syncServiceTypeChoices(sp: ScheduleSpClient, listTitle: string) {
  const encodedList = encodeForOdata(listTitle);
  const encodedField = encodeForOdata(SCHEDULE_FIELD_SERVICE_TYPE);
  const path = `/lists/getbytitle('${encodedList}')/fields/getbyinternalnameortitle('${encodedField}')`;

  const res = await sp.spFetch(path, {
    method: 'GET',
    headers: { accept: 'application/json;odata=nometadata' },
  });

  if (!res.ok) {
    throw new Error(`ServiceType フィールドの確認に失敗しました (HTTP ${res.status})`);
  }

  const field = (await res.json().catch(() => ({}))) as SpChoiceFieldResponse;
  const current = Array.isArray(field?.Choices?.results) ? field.Choices!.results! : [];
  const missing = SERVICE_TYPE_OPTIONS.filter((option) => !current.includes(option));
  if (!missing.length) {
    return { updated: false, choices: current } as const;
  }

  const nextChoices = uniq([...current, ...missing]);

  const updateRes = await sp.spFetch(path, {
    method: 'PATCH',
    headers: {
      accept: 'application/json;odata=nometadata',
      'content-type': 'application/json;odata=nometadata',
      'IF-MATCH': '*',
      'X-HTTP-Method': 'MERGE',
    },
    body: JSON.stringify({ Choices: { results: nextChoices } }),
  });

  if (!updateRes.ok) {
    throw new Error(`ServiceType フィールドの更新に失敗しました (HTTP ${updateRes.status})`);
  }

  return { updated: true, choices: nextChoices } as const;
}
