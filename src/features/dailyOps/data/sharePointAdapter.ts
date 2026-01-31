import { createSpClient, ensureConfig } from '@/lib/spClient';
import type { DailyOpsSignalsPort, DailyOpsSignal, UpsertDailyOpsSignalInput } from './port';
import { DAILY_OPS_FIELDS, DAILY_OPS_LIST_TITLE } from './spSchema';

type SpItem = Record<string, unknown>;

const toIsoDateOnly = (value: string): string => String(value).slice(0, 10);

const makeTitle = (input: UpsertDailyOpsSignalInput): string => {
  const t = input.time ? ` ${input.time}` : '';
  return `[${input.date}] ${input.targetId} ${input.kind}${t}`;
};

// 重複キー = (date, targetType, targetId, kind, time)
const buildCompositeFilter = (
  input: Pick<UpsertDailyOpsSignalInput, 'date' | 'targetType' | 'targetId' | 'kind' | 'time'>,
): string => {
  const f = DAILY_OPS_FIELDS;
  const iso = toIsoDateOnly(input.date);

  const timeFilter = input.time
    ? `${f.time} eq '${input.time}'`
    : `(${f.time} eq null or ${f.time} eq '')`;

  return [
    `${f.date} eq '${iso}'`,
    `${f.targetType} eq '${input.targetType}'`,
    `${f.targetId} eq '${input.targetId}'`,
    `${f.kind} eq '${input.kind}'`,
    timeFilter,
  ].join(' and ');
};

const mapFromSp = (item: SpItem): DailyOpsSignal => {
  const f = DAILY_OPS_FIELDS;

  return {
    id: Number(item.Id),
    title: String(item[f.title] ?? ''),
    date: toIsoDateOnly(String(item[f.date] ?? '')),
    targetType: String(item[f.targetType] ?? '') as DailyOpsSignal['targetType'],
    targetId: String(item[f.targetId] ?? ''),
    kind: String(item[f.kind] ?? '') as DailyOpsSignal['kind'],
    time: item[f.time] ? String(item[f.time]) : undefined,
    summary: item[f.summary] ? String(item[f.summary]) : undefined,
    status: String(item[f.status] ?? 'Active') as DailyOpsSignal['status'],
    source: String(item[f.source] ?? 'Other') as DailyOpsSignal['source'],
    createdAt: item.Created ? String(item.Created) : undefined,
    updatedAt: item.Modified ? String(item.Modified) : undefined,
  };
};

export const makeSharePointDailyOpsSignalsPort = (
  acquireToken: () => Promise<string | null>,
): DailyOpsSignalsPort => {
  const { baseUrl } = ensureConfig();
  // ✅ schedules と同じ形式に完全一致
  const client = createSpClient(acquireToken, baseUrl);

  const selectFields = [
    'Id',
    DAILY_OPS_FIELDS.title,
    DAILY_OPS_FIELDS.date,
    DAILY_OPS_FIELDS.targetType,
    DAILY_OPS_FIELDS.targetId,
    DAILY_OPS_FIELDS.kind,
    DAILY_OPS_FIELDS.time,
    DAILY_OPS_FIELDS.summary,
    DAILY_OPS_FIELDS.status,
    DAILY_OPS_FIELDS.source,
    'Created',
    'Modified',
  ] as const;

  return {
    async listByDate(date, opts) {
      const f = DAILY_OPS_FIELDS;
      const iso = toIsoDateOnly(date);

      const filter =
        `${f.date} eq '${iso}'` + (opts?.status ? ` and ${f.status} eq '${opts.status}'` : '');

      const items = await client.getListItemsByTitle<SpItem>(
        DAILY_OPS_LIST_TITLE,
        [...selectFields],
        filter,
        'Modified desc',
        500,
      );

      return (items ?? []).map(mapFromSp);
    },

    async upsert(input) {
      const f = DAILY_OPS_FIELDS;
      const iso = toIsoDateOnly(input.date);

      const payload: Record<string, unknown> = {
        [f.title]: input.title ?? makeTitle({ ...input, date: iso }),
        [f.date]: iso,
        [f.targetType]: input.targetType,
        [f.targetId]: input.targetId,
        [f.kind]: input.kind,
        [f.time]: input.time ?? null,
        [f.summary]: input.summary ?? null,
        [f.status]: input.status ?? 'Active',
        [f.source]: input.source ?? 'Other',
      };

      // 既存チェック
      const filter = buildCompositeFilter({ ...input, date: iso });
      const existing = await client.getListItemsByTitle<SpItem>(
        DAILY_OPS_LIST_TITLE,
        ['Id'],
        filter,
        undefined,
        1,
      );

      if (existing?.length) {
        const id = Number(existing[0].Id);
        await client.updateItemByTitle(DAILY_OPS_LIST_TITLE, id, payload);

        const updated = await client.getListItemsByTitle<SpItem>(
          DAILY_OPS_LIST_TITLE,
          [...selectFields],
          `Id eq ${id}`,
          undefined,
          1,
        );

        return updated?.[0] ? mapFromSp(updated[0]) : (mapFromSp({ Id: id, ...payload } as SpItem) as DailyOpsSignal);
      }

      // CREATE：schedules と同じ addListItemByTitle
      const created = await client.addListItemByTitle<Record<string, unknown>, SpItem>(
        DAILY_OPS_LIST_TITLE,
        payload,
      );

      const createdId = created?.Id ? Number(created.Id) : undefined;
      if (!createdId) {
        return mapFromSp({ Id: -1, ...payload } as SpItem) as DailyOpsSignal;
      }

      const fetched = await client.getListItemsByTitle<SpItem>(
        DAILY_OPS_LIST_TITLE,
        [...selectFields],
        `Id eq ${createdId}`,
        undefined,
        1,
      );

      return fetched?.[0]
        ? mapFromSp(fetched[0])
        : (mapFromSp({ Id: createdId, ...payload } as SpItem) as DailyOpsSignal);
    },

    async setStatus(itemId, status) {
      await client.updateItemByTitle(DAILY_OPS_LIST_TITLE, itemId, { [DAILY_OPS_FIELDS.status]: status });
    },
  };
};
