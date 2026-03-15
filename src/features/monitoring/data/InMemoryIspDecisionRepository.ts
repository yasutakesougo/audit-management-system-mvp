/**
 * @fileoverview InMemory 実装 — テスト / 開発用
 * @description
 * ページリロードで状態がリセットされる。SharePoint 未接続時の fallback。
 */
import type { IspRecommendationDecision } from '../domain/ispRecommendationDecisionTypes';
import type {
  DecisionListFilter,
  IspDecisionRepository,
  SaveDecisionInput,
} from './IspDecisionRepository';

export class InMemoryIspDecisionRepository implements IspDecisionRepository {
  private records: IspRecommendationDecision[] = [];
  private nextSeq = 1;

  constructor(initialRecords?: readonly IspRecommendationDecision[]) {
    if (initialRecords) {
      this.records = structuredClone(initialRecords) as IspRecommendationDecision[];
    }
  }

  async save(input: SaveDecisionInput): Promise<IspRecommendationDecision> {
    const record: IspRecommendationDecision = {
      ...structuredClone(input) as SaveDecisionInput,
      id: `decision-${Date.now()}-${this.nextSeq++}`,
    };
    this.records.push(record);
    return structuredClone(record) as IspRecommendationDecision;
  }

  async list(filter: DecisionListFilter): Promise<IspRecommendationDecision[]> {
    if (filter.signal?.aborted) return [];

    let results = this.records.filter((r) => r.userId === filter.userId);

    if (filter.goalId) {
      results = results.filter((r) => r.goalId === filter.goalId);
    }

    if (filter.monitoringPeriod) {
      const { from, to } = filter.monitoringPeriod;
      results = results.filter(
        (r) => r.monitoringPeriodFrom === from && r.monitoringPeriodTo === to,
      );
    }

    // decidedAt 降順
    return structuredClone(
      results.sort((a, b) => b.decidedAt.localeCompare(a.decidedAt)),
    ) as IspRecommendationDecision[];
  }

  /** テスト用: 全レコードクリア */
  clear(): void {
    this.records = [];
    this.nextSeq = 1;
  }

  /** テスト用: 全レコード取得 */
  getAll(): IspRecommendationDecision[] {
    return structuredClone(this.records) as IspRecommendationDecision[];
  }
}
