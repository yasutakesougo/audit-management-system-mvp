import { createDataProvider } from '@/lib/data/createDataProvider';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { createSpClient, ensureConfig } from '@/lib/spClient';
import { result } from '@/shared/result';

import { getScheduleRepository } from '@/features/schedules/repositoryFactory';

import type { DateRange, SchedItem, SchedulesPort, UpdateScheduleEventInput } from './port';
import { getHttpStatus, getListFieldsMeta as getListFieldsMetaFromProvider } from './scheduleSpHelpers';
import type { ListFieldMeta, SharePointSchedulesPortOptions } from './scheduleSpMappers';

type TokenProvider = {
  acquireToken: () => Promise<string | null>;
};

const isProvider = (value: unknown): value is IDataProvider => {
  if (!value || typeof value !== 'object') return false;
  return 'listItems' in value && 'getFieldInternalNames' in value;
};

const ensureTokenProvider = (
  value: SharePointSchedulesPortOptions | TokenProvider | undefined,
): TokenProvider => {
  const acquireToken = value?.acquireToken;
  if (!acquireToken) {
    throw new Error('SharePoint schedules port requires acquireToken() when no override is provided.');
  }
  return { acquireToken };
};

const mapUpdateError = (error: unknown, etag: string | undefined) => {
  const status = getHttpStatus(error);
  if (status === 412) {
    return result.conflict<SchedItem>({
      message: 'Schedule update conflict (etag mismatch)',
      etag,
      resource: 'schedule',
      op: 'update',
    });
  }
  if (status === 403) {
    return result.forbidden<SchedItem>('Forbidden');
  }
  if (status === 404) {
    return result.notFound<SchedItem>('Not found');
  }
  const safe = error instanceof Error ? error : new Error(String(error));
  return result.unknown<SchedItem>(safe.message, error);
};

export const makeSharePointSchedulesPort = (
  options: SharePointSchedulesPortOptions,
): SchedulesPort => {
  const getRepository = () => {
    const { acquireToken } = ensureTokenProvider(options);
    return getScheduleRepository({
      acquireToken,
      currentOwnerUserId: options.currentOwnerUserId,
    });
  };

  const listImpl: SchedulesPort['list'] = async (range: DateRange) => {
    if (options.listRange) {
      return options.listRange(range);
    }
    const repository = getRepository();
    return repository.list({ range });
  };

  const createImpl: SchedulesPort['create'] | undefined = options.create
    ? options.create
    : async (input) => {
        try {
          const repository = getRepository();
          const item = await repository.create(input);
          return result.ok(item);
        } catch (error) {
          const safe = error instanceof Error ? error : new Error(String(error));
          return result.unknown<SchedItem>(safe.message, error);
        }
      };

  const updateImpl: SchedulesPort['update'] | undefined = options.update
    ? options.update
    : async (input: UpdateScheduleEventInput) => {
        if (!input.etag) {
          return result.validation<SchedItem>('Missing etag for update', { field: 'etag' });
        }
        try {
          const repository = getRepository();
          const item = await repository.update(input);
          return result.ok(item);
        } catch (error) {
          return mapUpdateError(error, input.etag);
        }
      };

  const removeImpl: SchedulesPort['remove'] | undefined = options.remove
    ? options.remove
    : async (id: string) => {
        const repository = getRepository();
        await repository.remove(id);
      };

  return {
    list: listImpl,
    create: createImpl,
    update: updateImpl,
    remove: removeImpl,
  } satisfies SchedulesPort;
};

export const getListFieldsMeta = async (
  source: IDataProvider | TokenProvider,
): Promise<ListFieldMeta[]> => {
  if (isProvider(source)) {
    return getListFieldsMetaFromProvider(source);
  }

  const { baseUrl } = ensureConfig();
  const client = createSpClient(source.acquireToken, baseUrl);
  const { provider } = createDataProvider(client, { type: 'sharepoint' });
  return getListFieldsMetaFromProvider(provider);
};

export type { ListFieldMeta };
