/**
 * ServiceProvisionRepository ドメインインターフェース
 *
 * MVP0: getByEntryKey / listByDate / upsertByEntryKey
 */
import type { ServiceProvisionRecord, UpsertProvisionInput } from './types';

export interface ServiceProvisionRepository {
  /** EntryKey で1件取得（存在しなければ null） */
  getByEntryKey(entryKey: string): Promise<ServiceProvisionRecord | null>;

  /** 指定日の全レコード取得 */
  listByDate(recordDateISO: string): Promise<ServiceProvisionRecord[]>;

  /** 指定月の全レコード取得（monthISO: YYYY-MM） */
  listByMonth(monthISO: string): Promise<ServiceProvisionRecord[]>;

  /** EntryKey で upsert（存在すれば更新、なければ新規作成） */
  upsertByEntryKey(input: UpsertProvisionInput): Promise<ServiceProvisionRecord>;
}
