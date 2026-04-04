import { vi, type Mock } from 'vitest';
import type { SpFetchFn } from '@/lib/sp/spLists';

/**
 * Construct a standardized JSON Response for SP REST mocks.
 */
export const jsonResponse = (value: unknown): Response =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

export type DriftMockOptions = {
  /** The primary list title being mocked */
  listTitle: string;
  /** List of field definitions representing the simulated schema (must have InternalName) */
  fields: Array<{ InternalName: string }>;
  /** Items returned for queries to this list */
  items?: Record<string, unknown>[];
  /** Overridden value returned on POST/update */
  saveResponse?: Record<string, unknown>;
  /** 
   * Additional path-based overrides to handle secondary lists or special endpoints.
   * Key: path match substring (e.g. "lists/getbytitle('DailyRows')")
   * Value: response payload to return as JSON.
   */
  pathOverrides?: Record<string, unknown>;
};

export type MockSpFetch = Mock<SpFetchFn>;

/**
 * 共通基盤向けの drift モック生成ファクトリ。
 * SchemaResolver, GenericDataAccess, GenericSaver の通信要件を満たす。
 */
export function createDriftMock(options: DriftMockOptions): MockSpFetch {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return vi.fn(async (path: string, requestOptions?: any) => {
    // 1. Path overrides priority
    if (options.pathOverrides) {
      for (const [key, value] of Object.entries(options.pathOverrides)) {
        if (path.includes(key)) {
          return jsonResponse(value);
        }
      }
    }

    // 2. Discover available lists (SchemaResolver -> getAvailableListTitles)
    if (path.startsWith('lists?$select=Title')) {
      return jsonResponse({ value: [{ Title: options.listTitle }] });
    }

    // 3. Schema Probe (SchemaResolver -> getListFieldNames)
    if (path.includes(`lists/getbytitle('${options.listTitle}')/fields`)) {
      return jsonResponse({ value: options.fields });
    }

    // 4. Persistence operations (POST / MERGE)
    if (path.includes(`lists/getbytitle('${options.listTitle}')/items`) && requestOptions) {
      const method = requestOptions.method || 'GET';
      if (['POST', 'MERGE', 'PATCH'].includes(method.toUpperCase())) {
        return jsonResponse(options.saveResponse ?? { Id: 1 });
      }
    }

    // 5. Data Access operations (Fetch Items)
    if (path.includes(`lists/getbytitle('${options.listTitle}')/items`)) {
      return jsonResponse({ value: options.items ?? [] });
    }

    // Fallback empty response
    return jsonResponse({ value: [] });
  });
}
