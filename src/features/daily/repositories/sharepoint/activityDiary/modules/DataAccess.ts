import type { SpFetchFn } from '@/lib/sp/spLists';
import { AD_FIELDS, type ADFieldKey, type ADMapping } from '../constants';
import { buildActivityDiarySelectFields } from '@/sharepoint/fields/activityDiaryFields';

export class ActivityDiaryDataAccess {
  constructor(private readonly spFetch: SpFetchFn) {}

  private mf(mapping: ADMapping, key: ADFieldKey): string {
    return mapping[key] ?? AD_FIELDS[key];
  }

  private encodeODataString(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
  }

  private toODataLiteral(value: string | number): string {
    return typeof value === 'number' ? String(value) : this.encodeODataString(value);
  }

  /**
   * 特定の日の記録をロードする（複数ある場合は最新順で返す）
   */
  public async loadByDate(
    date: string,
    userId: number | string,
    listPath: string,
    mapping: ADMapping,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>[]> {
    const resolvedNames = Object.values(mapping).filter((name): name is string => Boolean(name));
    const select = buildActivityDiarySelectFields(resolvedNames);
    const filter = `${this.mf(mapping, 'date')} eq ${this.encodeODataString(date)} and ${this.mf(mapping, 'userId')} eq ${this.toODataLiteral(userId)}`;

    const params = new URLSearchParams();
    params.set('$select', select.join(','));
    params.set('$filter', filter);
    params.set('$orderby', 'Id desc');

    const response = await this.spFetch(`${listPath}/items?${params.toString()}`, { signal });
    const data = (await response.json()) as { value?: Record<string, unknown>[] };
    return data.value ?? [];
  }

  /**
   * 期間指定でリスト取得
   */
  public async list(
    startDate: string,
    endDate: string,
    listPath: string,
    mapping: ADMapping,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>[]> {
    const resolvedNames = Object.values(mapping).filter((name): name is string => Boolean(name));
    const select = buildActivityDiarySelectFields(resolvedNames);
    const filter = `${this.mf(mapping, 'date')} ge ${this.encodeODataString(startDate)} and ${this.mf(mapping, 'date')} le ${this.encodeODataString(endDate)}`;

    const params = new URLSearchParams();
    params.set('$select', select.join(','));
    params.set('$filter', filter);
    params.set('$top', '5000');

    const response = await this.spFetch(`${listPath}/items?${params.toString()}`, { signal });
    const data = (await response.json()) as { value?: Record<string, unknown>[] };
    return data.value ?? [];
  }
}
