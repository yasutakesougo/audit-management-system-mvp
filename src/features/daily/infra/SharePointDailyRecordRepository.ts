import { get as getEnv } from '@/env';
import { toSafeError } from '@/lib/errors';
import { fetchSp } from '@/lib/fetchSp';
import { createSpClient, ensureConfig } from '@/lib/spClient';
import type {
    DailyRecordItem,
    DailyRecordRepository,
    DailyRecordRepositoryListParams,
    DailyRecordRepositoryMutationParams,
    SaveDailyRecordInput,
} from '../domain/DailyRecordRepository';
import { DailyRecordItemSchema } from '../schema';

/**
 * SharePoint List Name for Daily Records
 * Can be overridden via environment variable
 */
const getListTitle = (): string => {
  return getEnv('VITE_SP_DAILY_RECORDS_LIST', 'TableDailyRecords');
};

/**
 * SharePoint field names for daily records
 */
const DAILY_RECORD_FIELDS = {
  title: 'Title',              // YYYY-MM-DD
  recordDate: 'RecordDate',    // Date type
  reporterName: 'ReporterName', // Text
  reporterRole: 'ReporterRole', // Text
  userRowsJSON: 'UserRowsJSON', // Multi-line text
  userCount: 'UserCount',       // Number
  created: 'Created',
  modified: 'Modified',
} as const;

/**
 * SharePoint response type
 */
type SharePointResponse<T> = {
  value?: T[];
};

/**
 * Minimal interface for SharePoint items during save/update operations
 */
interface SharePointItem {
  Id: number;
  __metadata?: {
    etag?: string;
  };
}

/**
 * Read error message from SharePoint response
 */
const readSpErrorMessage = async (response: Response): Promise<string> => {
  const text = await response.text().catch(() => '');
  if (!text) return '';
  try {
    const data = JSON.parse(text) as {
      error?: { message?: { value?: string } };
      'odata.error'?: { message?: { value?: string } };
      message?: { value?: string };
    };
    return (
      data.error?.message?.value ??
      data['odata.error']?.message?.value ??
      data.message?.value ??
      ''
    );
  } catch {
    return text.slice(0, 400);
  }
};

/**
 * Parse SharePoint item to DailyRecordItem using Zod schema
 */
const parseSpItem = (item: unknown): DailyRecordItem | null => {
  const result = DailyRecordItemSchema.safeParse(item);
  if (!result.success) {
    console.error('[SharePointDailyRecordRepository] Failed to validate item', {
      itemId: (item && typeof item === 'object' && 'Id' in item) ? (item as Record<string, unknown>).Id : 'unknown',
      errors: result.error.flatten().fieldErrors,
    });
    return null;
  }
  return result.data;
};

/**
 * Build list path for API requests
 */
const buildListPath = (baseUrl: string): string => {
  const listTitle = getListTitle();
  return `${baseUrl}/_api/web/lists/GetByTitle('${encodeURIComponent(listTitle)}')`;
};

/**
 * Build OData filter for date range
 */
const buildDateRangeFilter = (startDate: string, endDate: string): string => {
  return `Title ge '${startDate}' and Title le '${endDate}'`;
};

/**
 * SharePoint repository options
 */
type SharePointDailyRecordRepositoryOptions = {
  acquireToken?: () => Promise<string | null>;
  listTitle?: string;
};

/**
 * SharePoint implementation of DailyRecordRepository
 *
 * Uses "Single Item" strategy:
 * - One SharePoint item per day
 * - Multiple user rows stored as JSON in UserRowsJSON field
 * - Provides better transaction consistency and performance
 *
 * SharePoint List Schema:
 * - Title (Single line text): YYYY-MM-DD format date
 * - RecordDate (Date): Date field for filtering
 * - ReporterName (Single line text): Name of reporter
 * - ReporterRole (Single line text): Role of reporter
 * - UserRowsJSON (Multiple lines text): JSON array of UserRowData
 * - UserCount (Number): Count of users for quick filtering
 */
export class SharePointDailyRecordRepository implements DailyRecordRepository {
  private readonly acquireToken: () => Promise<string | null>;
  private readonly listTitle: string;
  private client: ReturnType<typeof createSpClient> | null = null;

  constructor(options: SharePointDailyRecordRepositoryOptions = {}) {
    this.acquireToken = options.acquireToken ?? (async () => null);
    this.listTitle = options.listTitle ?? getListTitle();
  }

  /**
   * Get or create SPClient (lazy initialization)
   */
  private getClient(): ReturnType<typeof createSpClient> {
    if (!this.client) {
      const { baseUrl } = ensureConfig();
      this.client = createSpClient(this.acquireToken, baseUrl);
    }
    return this.client;
  }

  /**
   * Save a daily record
   * Updates existing item or creates new one
   */
  async save(
    input: SaveDailyRecordInput,
    params?: DailyRecordRepositoryMutationParams,
  ): Promise<void> {
    if (params?.signal?.aborted) {
      throw new Error('Operation aborted');
    }

    try {
      const { baseUrl } = ensureConfig();
      const listPath = buildListPath(baseUrl);

      // Check if item exists for this date
      const existingItem = await this.findItemByDate(input.date, params?.signal) as SharePointItem | null;

      // Prepare item data
      const userRowsJSON = JSON.stringify(input.userRows);
      const itemData = {
        Title: input.date,
        RecordDate: new Date(input.date).toISOString(),
        ReporterName: input.reporter.name,
        ReporterRole: input.reporter.role,
        UserRowsJSON: userRowsJSON,
        UserCount: input.userRows.length,
      };

      if (existingItem) {
        // Update existing item
        const updateUrl = `${listPath}/items(${existingItem.Id})`;
        const response = await fetchSp(updateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;odata=verbose',
            'Accept': 'application/json;odata=verbose',
            'IF-MATCH': existingItem.__metadata?.etag ?? '*',
            'X-HTTP-Method': 'MERGE',
          },
          body: JSON.stringify(itemData),
        });

        if (!response.ok) {
          const message = await readSpErrorMessage(response);
          throw new Error(`Failed to update daily record: ${message}`);
        }
      } else {
        // Create new item
        const createUrl = `${listPath}/items`;
        const response = await fetchSp(createUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;odata=verbose',
            'Accept': 'application/json;odata=verbose',
          },
          body: JSON.stringify(itemData),
        });

        if (!response.ok) {
          const message = await readSpErrorMessage(response);
          throw new Error(`Failed to create daily record: ${message}`);
        }
      }
    } catch (error) {
      const safeError = toSafeError(error);
      console.error('[SharePointDailyRecordRepository] Save failed', {
        date: input.date,
        userCount: input.userRows.length,
        error: safeError.message,
      });
      throw safeError;
    }
  }

  /**
   * Load a daily record for a specific date
   */
  async load(date: string): Promise<DailyRecordItem | null> {
    try {
      const item = await this.findItemByDate(date);
      return item ? parseSpItem(item) : null;
    } catch (error) {
      const safeError = toSafeError(error);
      console.error('[SharePointDailyRecordRepository] Load failed', {
        date,
        error: safeError.message,
      });
      throw safeError;
    }
  }

  /**
   * List daily records within date range
   */
  async list(params: DailyRecordRepositoryListParams): Promise<DailyRecordItem[]> {
    if (params.signal?.aborted) {
      return [];
    }

    try {
      const { baseUrl } = ensureConfig();
      const listPath = buildListPath(baseUrl);

      const { startDate, endDate } = params.range;
      const filter = buildDateRangeFilter(startDate, endDate);

      const queryParams = new URLSearchParams();
      queryParams.set('$filter', filter);
      queryParams.set('$orderby', 'Title desc'); // Newest first
      queryParams.set('$top', '100'); // Reasonable limit for date range
      queryParams.set('$select', [
        'Id',
        DAILY_RECORD_FIELDS.title,
        DAILY_RECORD_FIELDS.recordDate,
        DAILY_RECORD_FIELDS.reporterName,
        DAILY_RECORD_FIELDS.reporterRole,
        DAILY_RECORD_FIELDS.userRowsJSON,
        DAILY_RECORD_FIELDS.userCount,
        DAILY_RECORD_FIELDS.created,
        DAILY_RECORD_FIELDS.modified,
      ].join(','));

      const url = `${listPath}/items?${queryParams.toString()}`;
      const response = await fetchSp(url);

      if (!response.ok) {
        const message = await readSpErrorMessage(response);
        console.error('[SharePointDailyRecordRepository] List query failed', {
          status: response.status,
          url,
          message,
        });
        throw new Error(`Failed to list daily records: ${message}`);
      }

      const payload = (await response.json()) as SharePointResponse<unknown>;
      const items = payload.value ?? [];

      // Parse and filter out invalid items
      const results: DailyRecordItem[] = [];
      for (const item of items) {
        const parsed = parseSpItem(item);
        if (parsed) {
          results.push(parsed);
        }
      }

      return results;
    } catch (error) {
      const safeError = toSafeError(error);
      console.error('[SharePointDailyRecordRepository] List failed', {
        range: params.range,
        error: safeError.message,
      });
      throw safeError;
    }
  }

  /**
   * Find SharePoint item by date
   * @private
   */
  private async findItemByDate(
    date: string,
    signal?: AbortSignal
  ): Promise<SharePointItem | null> {
    if (signal?.aborted) {
      return null;
    }

    try {
      const { baseUrl } = ensureConfig();
      const listPath = buildListPath(baseUrl);

      const queryParams = new URLSearchParams();
      queryParams.set('$filter', `Title eq '${date}'`);
      queryParams.set('$top', '1');
      queryParams.set('$select', [
        'Id',
        DAILY_RECORD_FIELDS.title,
        DAILY_RECORD_FIELDS.recordDate,
        DAILY_RECORD_FIELDS.reporterName,
        DAILY_RECORD_FIELDS.reporterRole,
        DAILY_RECORD_FIELDS.userRowsJSON,
        DAILY_RECORD_FIELDS.userCount,
        DAILY_RECORD_FIELDS.created,
        DAILY_RECORD_FIELDS.modified,
      ].join(','));

      const url = `${listPath}/items?${queryParams.toString()}`;
      const response = await fetchSp(url);

      if (!response.ok) {
        const message = await readSpErrorMessage(response);
        console.warn('[SharePointDailyRecordRepository] Find by date failed', {
          date,
          status: response.status,
          message,
        });
        return null;
      }

      const payload = (await response.json()) as SharePointResponse<unknown>;
      const items = payload.value ?? [];

      return items.length > 0 ? items[0] : null;
    } catch (error) {
      console.warn('[SharePointDailyRecordRepository] Find by date error', {
        date,
        error: toSafeError(error).message,
      });
      return null;
    }
  }

  /**
   * Check if list exists (for diagnostics)
   */
  async checkListExists(): Promise<boolean> {
    try {
      const client = this.getClient();
      const metadata = await client.tryGetListMetadata(this.listTitle);
      return Boolean(metadata);
    } catch (error) {
      console.error('[SharePointDailyRecordRepository] List existence check failed:', error);
      return false;
    }
  }
}

/**
 * Singleton instance with default configuration
 */
export const sharePointDailyRecordRepository = new SharePointDailyRecordRepository();
