import { useCallback, useRef } from 'react';

import { useAuth } from '@/auth/useAuth';
import { useSP } from '@/lib/spClient';
import { buildHandoffSelectFields, FIELD_MAP_HANDOFF } from '@/sharepoint/fields';

import { generateTitleFromMessage } from './generateTitleFromMessage';
import { handoffConfig } from './handoffConfig';
import { fromSpHandoffItem, toSpHandoffCreatePayload } from './handoffMappers';
import {
    generateId,
    getTodayKey,
    loadStorage,
    saveStorage,
} from './handoffStorageUtils';
import type { HandoffRecord, NewHandoffInput } from './handoffTypes';


export type HandoffExternalSource = {
  sourceType: 'meeting-minutes' | 'regulatory-finding' | 'severe-addon-finding';
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
  /** finding 由来などで category を指定 (default: 'その他') */
  category?: NewHandoffInput['category'];
  /** finding 由来などで severity を指定 (default: '通常') */
  severity?: NewHandoffInput['severity'];
};

export type CreateHandoffFromExternalSourceResult = {
  created: boolean;
  itemId: number;
};

const escapeODataString = (value: string): string => value.replace(/'/g, "''");

export const useCreateHandoffFromExternalSource = () => {
  const sp = useSP();
  const spRef = useRef(sp);
  spRef.current = sp;
  const { account } = useAuth();

  return useCallback(
    async (input: CreateHandoffFromExternalSourceInput): Promise<CreateHandoffFromExternalSourceResult> => {
      const { title, body, source, timeBand, category: inputCategory, severity: inputSeverity } = input;

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
          category: inputCategory ?? 'その他',
          severity: inputSeverity ?? '通常',
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

      const currentSp = spRef.current;
      const existingFields = await currentSp.getListFieldInternalNames(handoffConfig.listTitle);
      const selectFields = buildHandoffSelectFields(Array.from(existingFields)).join(',');
      const sourceKeyField = FIELD_MAP_HANDOFF.sourceKey;
      const hasSourceKey = existingFields.has(sourceKeyField);

      if (hasSourceKey) {
        const filter = `${sourceKeyField} eq '${escapeODataString(source.sourceKey)}'`;
        const query = `?$select=${encodeURIComponent(selectFields)}&$filter=${encodeURIComponent(filter)}&$top=1`;
        const response = await currentSp.spFetch(
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
        category: inputCategory ?? 'その他',
        severity: inputSeverity ?? '通常',
        timeBand: timeBand ?? '午前',
        message: body,
        title,
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        sourceUrl: source.sourceUrl,
        sourceKey: source.sourceKey,
        sourceLabel: source.sourceLabel,
      });

      const createRes = await currentSp.spFetch(
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
    [account?.username],
  );
};
