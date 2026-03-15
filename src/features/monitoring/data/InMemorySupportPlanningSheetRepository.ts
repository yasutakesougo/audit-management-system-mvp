/**
 * @fileoverview InMemory 実装 — テスト / 開発用
 * @description
 * ページリロードで状態がリセットされる。SharePoint 未接続時の fallback。
 */
import type {
  SaveSupportPlanningSheetInput,
  SupportPlanningSheetFilter,
  SupportPlanningSheetRecord,
} from '../domain/supportPlanningSheetTypes';
import type { SupportPlanningSheetRepository } from './SupportPlanningSheetRepository';

export class InMemorySupportPlanningSheetRepository implements SupportPlanningSheetRepository {
  private records: SupportPlanningSheetRecord[] = [];
  private nextSeq = 1;

  constructor(initialRecords?: readonly SupportPlanningSheetRecord[]) {
    if (initialRecords) {
      this.records = structuredClone(initialRecords) as SupportPlanningSheetRecord[];
    }
  }

  async save(input: SaveSupportPlanningSheetInput): Promise<SupportPlanningSheetRecord> {
    const record: SupportPlanningSheetRecord = {
      ...structuredClone(input) as SaveSupportPlanningSheetInput,
      id: `sps-${Date.now()}-${this.nextSeq++}`,
    };
    this.records.push(record);
    return structuredClone(record) as SupportPlanningSheetRecord;
  }

  async list(filter: SupportPlanningSheetFilter): Promise<SupportPlanningSheetRecord[]> {
    if (filter.signal?.aborted) return [];

    let results = this.records.filter((r) => r.userId === filter.userId);

    if (filter.goalId) {
      results = results.filter((r) => r.goalId === filter.goalId);
    }

    // decisionAt 降順
    return structuredClone(
      results.sort((a, b) => b.decisionAt.localeCompare(a.decisionAt)),
    ) as SupportPlanningSheetRecord[];
  }

  /** テスト用: 全レコードクリア */
  clear(): void {
    this.records = [];
    this.nextSeq = 1;
  }

  /** テスト用: 全レコード取得 */
  getAll(): SupportPlanningSheetRecord[] {
    return structuredClone(this.records) as SupportPlanningSheetRecord[];
  }
}
