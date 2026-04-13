import type {
    SupportPlanDraftRepository,
    SupportPlanListParams,
} from '../domain/SupportPlanDraftRepository';
import type { SupportPlanDraft } from '../types';
import { createDraft } from '../utils/helpers';

// ────────────────────────────────────────────────────────────────────────────
// InMemory Implementation
// ────────────────────────────────────────────────────────────────────────────

/**
 * In-memory implementation of SupportPlanDraftRepository.
 *
 * Used in:
 * - Development mode (no SharePoint access)
 * - Demo / offline mode
 * - Unit testing
 *
 * Seeds with a single empty draft on construction.
 */
class InMemorySupportPlanDraftRepositoryImpl implements SupportPlanDraftRepository {
  private store = new Map<string, SupportPlanDraft>();

  constructor() {
    const seed = createDraft('利用者 1');
    this.store.set(seed.id, seed);

    // ────────────────────────────────────────────────────────────────────────
    // Seed: Shioda Yuki (塩田 裕貴) - Alignment with Excel Original
    // ────────────────────────────────────────────────────────────────────────
    const shiodaId = 'draft-shioda-excel-v1';
    const shioda: SupportPlanDraft = {
      id: shiodaId,
      name: '塩田 裕貴',
      userId: 5203,
      userCode: 'I016',
      createdAt: '2026-04-12T00:00:00.000Z',
      updatedAt: '2026-04-12T00:00:00.000Z',
      data: {
        ...createDraft('塩田 裕貴').data,
        serviceUserName: '塩田 裕貴 / I016',
        supportLevel: '支援区分4',
        planPeriod: '2026/04/01 〜 2027/03/31',
        assessmentSummary: '本人の希望: 好きな作業（ハサミ）に夢中になってしまい、切り替えができなくなってしまう。好きなこと、やりたいことを見つける。\n\n家族・相談支援の意向: 日中、元気に楽しく過ごしてほしい。本人が安心できる環境、楽しめることをみつけてほしい。',
        strengths: '音楽活動への意欲が高い。家族の支援が安定している。',
        decisionSupport: '写真カードによる選択肢提示。本人の表情や動作からのフィードバック収集。',
        monitoringPlan: '月1回の個別面談。支援記録の推移分析。',
        riskManagement: 'ハサミ使用時の安全管理。切り替え不全時のクールダウン場所の確保。',
        goals: [
          {
            id: 'g1',
            text: '予定がわかりやすい環境を整える。',
            label: '長期目標①',
            type: 'long',
            domains: ['cognitive'],
          },
          {
            id: 'g2',
            text: 'スケジュール表を確認し、次の活動を理解する。',
            label: '短期目標①',
            type: 'short',
            domains: ['cognitive'],
          },
          {
            id: 'g3',
            text: '興味のある活動を広げ、充実した時間を過ごす。',
            label: '長期目標②',
            type: 'long',
            domains: ['health'],
          },
          {
            id: 'g4',
            text: 'ハサミ以外の没頭できる新しいプログラムを見つける。',
            label: '短期目標②',
            type: 'short',
            domains: ['health'],
          },
          {
            id: 's1',
            text: '環境を整える',
            type: 'support',
            label: '日中支援',
            domains: ['cognitive'],
          },
          {
            id: 's2',
            text: 'プログラムをみつける',
            type: 'support',
            label: '創作・生産活動',
            domains: ['health'],
          }
        ],
      },
    };
    this.store.set(shioda.id, shioda);
  }

  async listDrafts(params?: SupportPlanListParams): Promise<SupportPlanDraft[]> {
    params?.signal?.throwIfAborted();

    let results = Array.from(this.store.values());

    if (params?.userCode) {
      results = results.filter((d) => d.userCode === params.userCode);
    }

    if (params?.status) {
      const statuses = Array.isArray(params.status) ? params.status : [params.status];
      // In-memory drafts don't have an explicit status field on the domain type yet;
      // all in-memory items are treated as 'draft' unless extended.
      // For now, return all if 'draft' is in the filter, else none.
      if (!statuses.includes('draft')) {
        return [];
      }
    }

    return results.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }

  async saveDraft(draft: SupportPlanDraft): Promise<void> {
    this.store.set(draft.id, { ...draft });
  }

  async deleteDraft(draftId: string): Promise<void> {
    this.store.delete(draftId);
  }

  async bulkSave(drafts: SupportPlanDraft[]): Promise<void> {
    for (const draft of drafts) {
      this.store.set(draft.id, { ...draft });
    }
  }

  // ── Test helpers ──

  /** Get current store size (for testing). */
  get size(): number {
    return this.store.size;
  }

  /** Clear all data (for testing). */
  clear(): void {
    this.store.clear();
  }
}

// ── Singleton export ──
export const inMemorySupportPlanDraftRepository = new InMemorySupportPlanDraftRepositoryImpl();

/** Factory function for creating fresh instances (useful in tests). */
export const createInMemorySupportPlanDraftRepository = (): InMemorySupportPlanDraftRepositoryImpl =>
  new InMemorySupportPlanDraftRepositoryImpl();
