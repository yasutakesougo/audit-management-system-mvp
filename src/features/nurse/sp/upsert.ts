import pLimit from 'p-limit';
import type { HttpishError, SharePointListApi } from './client';
import type { ObservationListItem } from './map';

const BATCH_MAX = 100;
const PARALLEL_LIMIT = 3;

export type ObservationUpsertEnvelope = {
  key: string;
  item: ObservationListItem;
};

export type ObservationUpsertResult = {
  key: string;
  ok: boolean;
  id?: number;
  created?: boolean;
  error?: string;
  status?: number;
  attempts: number;
};

const escapeFilterValue = (value: string) => value.replace(/'/g, "''");

const buildFilter = (key: string) => `IdempotencyKey eq '${escapeFilterValue(key)}'`;

const chunk = <T>(items: readonly T[], size: number): T[][] => {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const describeError = (input: unknown): { message: string; status?: number } => {
  if (!input) {
    return { message: 'unknown error' };
  }
  if (input instanceof Error) {
    const status = (input as HttpishError).status;
    return { message: input.message, status };
  }
  if (typeof input === 'string') {
    return { message: input };
  }
  return { message: JSON.stringify(input) };
};

const alreadyHandled = (message: string) => /already exists|duplicate|idempotent/i.test(message);

const resolveExistingId = async (api: SharePointListApi, listTitle: string, key: string): Promise<number | null> => {
  const filter = buildFilter(key);
  const existing = await api.findOne({ listTitle, filter, select: ['Id'], top: 1 });
  return existing?.id ?? null;
};

const upsertOnce = async (
  api: SharePointListApi,
  listTitle: string,
  envelope: ObservationUpsertEnvelope,
): Promise<ObservationUpsertResult> => {
  let attempts = 0;
  const { key, item } = envelope;

  const existingId = await resolveExistingId(api, listTitle, key);
  try {
    if (existingId != null) {
      attempts += 1;
      await api.updateItemById(listTitle, existingId, item);
      return { key, ok: true, created: false, id: existingId, attempts };
    }
    attempts += 1;
    const created = await api.addItemByTitle(listTitle, item);
    return { key, ok: true, created: true, id: created.id, attempts };
  } catch (error) {
    const { message, status } = describeError(error);
    if (status === 412) {
      try {
        const refreshedId = await resolveExistingId(api, listTitle, key);
        if (refreshedId == null) {
          return { key, ok: false, error: message, status, attempts };
        }
        attempts += 1;
        await api.updateItemById(listTitle, refreshedId, item);
        return { key, ok: true, created: false, id: refreshedId, attempts };
      } catch (secondaryError) {
        const described = describeError(secondaryError);
        return {
          key,
          ok: false,
          error: described.message,
          status: described.status ?? status,
          attempts,
        };
      }
    }

    if (alreadyHandled(message)) {
      return { key, ok: true, created: false, attempts };
    }

    return { key, ok: false, error: message, status, attempts };
  }
};

const combineResults = (first: ObservationUpsertResult, second: ObservationUpsertResult): ObservationUpsertResult => {
  const attempts = first.attempts + second.attempts;
  if (second.ok) {
    return { ...second, attempts };
  }
  return {
    key: first.key,
    ok: false,
    attempts,
    error: second.error ?? first.error,
    status: second.status ?? first.status,
  };
};

export const batchUpsertObservations = async (
  api: SharePointListApi,
  listTitle: string,
  envelopes: ObservationUpsertEnvelope[],
): Promise<ObservationUpsertResult[]> => {
  if (envelopes.length === 0) {
    return [];
  }

  if (api.mode === 'stub') {
    return envelopes.map((envelope, index) => ({
      key: envelope.key,
      ok: true,
      created: true,
      id: Date.now() + index,
      attempts: 1,
    }));
  }

  const limit = pLimit(PARALLEL_LIMIT);
  const orderedKeys = envelopes.map((item) => item.key);
  const resultsByKey = new Map<string, ObservationUpsertResult>();

  const runBatch = async (batch: ObservationUpsertEnvelope[]) => {
    const firstPass = await Promise.all(batch.map((envelope) => limit(() => upsertOnce(api, listTitle, envelope))));
    batch.forEach((envelope, index) => {
      resultsByKey.set(envelope.key, firstPass[index]);
    });

    const failures = batch
      .map((envelope, index) => ({ envelope, result: firstPass[index] }))
      .filter((entry) => !entry.result.ok);

    if (failures.length === 0) {
      return;
    }

    const secondPass = await Promise.all(
      failures.map(({ envelope }) => limit(() => upsertOnce(api, listTitle, envelope))),
    );

    failures.forEach(({ envelope, result }, index) => {
      const retryOutcome = combineResults(result, secondPass[index]);
      resultsByKey.set(envelope.key, retryOutcome);
    });
  };

  for (const batch of chunk(envelopes, BATCH_MAX)) {
    await runBatch(batch);
  }

  return orderedKeys.map((key) => {
    const result = resultsByKey.get(key);
    return result ?? { key, ok: false, attempts: 0, error: 'unknown-result' };
  });
};

export const upsertObservation = async (
  api: SharePointListApi,
  listTitle: string,
  payload: ObservationListItem,
) => {
  const [result] = await batchUpsertObservations(api, listTitle, [{ key: payload.IdempotencyKey, item: payload }]);
  if (!result || !result.ok || result.id == null) {
    const message = result?.error ?? 'upsert failed';
    const error = new Error(message) as HttpishError;
    error.status = result?.status;
    throw error;
  }
  return { id: result.id, created: Boolean(result.created) };
};

export { BATCH_MAX, PARALLEL_LIMIT };
