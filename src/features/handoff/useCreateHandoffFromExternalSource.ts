import { useCallback } from 'react';

import { useAuth } from '@/auth/useAuth';
import { useSP } from '@/lib/spClient';
import { buildHandoffSelectFields, FIELD_MAP_HANDOFF } from '@/sharepoint/fields';

import { handoffConfig } from './handoffConfig';
import { generateTitleFromMessage } from './generateTitleFromMessage';
import type { HandoffRecord, NewHandoffInput } from './handoffTypes';
import { fromSpHandoffItem, toSpHandoffCreatePayload } from './handoffTypes';

const STORAGE_KEY = 'handoff.timeline.dev.v1';

type StorageShape = Record<string, HandoffRecord[]>;

const safeJson = <T,>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const loadStorage = (): StorageShape =>
  safeJson<StorageShape>(window.localStorage.getItem(STORAGE_KEY), {});

const saveStorage = (data: StorageShape) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    console.warn('[handoff] Failed to save local storage');
  }
};

const generateId = (): number => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    const uuid = crypto.randomUUID();
    const hash = uuid.replace(/-/g, '').slice(0, 8);
    return parseInt(hash, 16);
  }
  return Date.now() + Math.floor(Math.random() * 1000);
};

const getTodayKey = (date = new Date()): string => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export type HandoffExternalSource = {
  sourceType: 'meeting-minutes';
  sourceId: number;
  sourceUrl: string;
  sourceKey: string;
  sourceLabel?: string;
};

export type CreateHandoffFromExternalSourceInput = {
  title: string;
  body: string;
  source: HandoffExternalSource;
  timeBand?: NewHandoffInput['timeBand'];
};

export type CreateHandoffFromExternalSourceResult = {
  created: boolean;
  itemId: number;
};

const escapeODataString = (value: string): string => value.replace(/'/g, "''");

export const useCreateHandoffFromExternalSource = () => {
  const sp = useSP();
  const { account } = useAuth();

  return useCallback(
    async (input: CreateHandoffFromExternalSourceInput): Promise<CreateHandoffFromExternalSourceResult> => {
      const { title, body, source, timeBand } = input;

      if (handoffConfig.storage !== 'sharepoint') {
        const data = loadStorage();
        const existing = Object.values(data)
          .flat()
          .find((record) => record.sourceKey === source.sourceKey);

        if (existing) {
          return { created: false, itemId: existing.id };
        }

        const nowIso = new Date().toISOString();
        const record: HandoffRecord = {
          id: generateId(),
          title: title || generateTitleFromMessage(body),
          message: body,
          userCode: account?.username ?? 'system',
          userDisplayName: account?.username ?? 'システム',
          category: 'その他',
          severity: '通常',
          status: '未対応',
          timeBand: timeBand ?? '午前',
          createdAt: nowIso,
          createdByName: account?.username ?? 'システム',
          isDraft: false,
          sourceType: source.sourceType,
          sourceId: source.sourceId,
          sourceUrl: source.sourceUrl,
          sourceKey: source.sourceKey,
          sourceLabel: source.sourceLabel,
        };

        const key = getTodayKey();
        const list = data[key] ?? [];
        data[key] = [record, ...list];
        saveStorage(data);

        return { created: true, itemId: record.id };
      }

      const existingFields = await sp.getListFieldInternalNames(handoffConfig.listTitle);
      const selectFields = buildHandoffSelectFields(Array.from(existingFields)).join(',');
      const sourceKeyField = FIELD_MAP_HANDOFF.sourceKey;
      const hasSourceKey = existingFields.has(sourceKeyField);

      if (hasSourceKey) {
        const filter = `${sourceKeyField} eq '${escapeODataString(source.sourceKey)}'`;
        const query = `?$select=${encodeURIComponent(selectFields)}&$filter=${encodeURIComponent(filter)}&$top=1`;
        const response = await sp.spFetch(
          `lists/getbytitle('${handoffConfig.listTitle}')/items${query}`,
        );
        if (response.ok) {
          const data = (await response.json()) as { value?: Record<string, unknown>[] };
          const item = (data.value ?? [])[0];
          if (item) {
            const record = fromSpHandoffItem(item as unknown as Parameters<typeof fromSpHandoffItem>[0]);
            return { created: false, itemId: record.id };
          }
        }
      }

      const payload = toSpHandoffCreatePayload({
        userCode: account?.username ?? 'system',
        userDisplayName: account?.username ?? 'システム',
        category: 'その他',
        severity: '通常',
        timeBand: timeBand ?? '午前',
        message: body,
        title,
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        sourceUrl: source.sourceUrl,
        sourceKey: source.sourceKey,
        sourceLabel: source.sourceLabel,
      });

      const createRes = await sp.spFetch(
        `lists/getbytitle('${handoffConfig.listTitle}')/items`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;odata=verbose',
          },
          body: JSON.stringify(payload),
        },
      );
      if (!createRes.ok) {
        throw new Error(`Failed to create handoff: ${createRes.status} ${createRes.statusText}`);
      }
      const created = (await createRes.json()) as { d?: { Id?: number } };
      const itemId = created.d?.Id ?? 0;
      return { created: true, itemId };
    },
    [account?.username, sp],
  );
};
