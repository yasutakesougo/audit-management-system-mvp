import { renderHook, waitFor } from '@testing-library/react';
import { useSafetyOperationsSummary } from '@/features/safety/hooks/useSafetyOperationsSummary';
import { localIncidentRepository } from '@/infra/localStorage/localIncidentRepository';
import { localRestraintRepository } from '@/infra/localStorage/localRestraintRepository';
import {
  localCommitteeRepository,
  localGuidelineRepository,
  localTrainingRepository,
} from '@/infra/localStorage/localComplianceRepository';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// モック化
vi.mock('@/infra/localStorage/localIncidentRepository');
vi.mock('@/infra/localStorage/localRestraintRepository');
vi.mock('@/infra/localStorage/localComplianceRepository');

describe('useSafetyOperationsSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('🟢 正常系: すべてのリポジトリに正常なデータが存在する場合、適切に結合され summary が構築されること', async () => {
    // 擬似データをモック返却
    vi.mocked(localIncidentRepository.getAll).mockResolvedValue([
      { id: '1', date: '2026-04-01', level: 'Level 1', title: 'Test', reporter: 'User A', status: 'closed', type: '転倒', createdAt: '', updatedAt: '' } as any
    ]);
    vi.mocked(localRestraintRepository.getAll).mockResolvedValue([
      { id: '1', userId: 'u1', performed: true, restraintType: 'その他', startedAt: '2026-04-02', endedAt: '2026-04-02', durationMinutes: 60, threeRequirements: { immediacy: true, immediacyReason: 'x', nonSubstitutability: true, nonSubstitutabilityReason: 'y', temporariness: true, temporarinessReason: 'z' }, reason: '危険防止', physicalMentalCondition: '', surroundingCondition: '', recordedBy: 'User B', recordedAt: '', status: 'approved' }
    ]);
    vi.mocked(localCommitteeRepository.getAll).mockResolvedValue(
      // 四半期要件を満たすために直近1年間に4回以上必要
      Array(4).fill({ id: '1', meetingDate: '2026-04-03', committeeType: '定期開催', agenda: '', attendees: [], summary: '', decisions: '', issues: '', restraintDiscussed: false, restraintDiscussionDetail: '', recordedBy: '', recordedAt: '', status: 'finalized' })
    );
    vi.mocked(localGuidelineRepository.getAll).mockResolvedValue([
      { id: '1', version: '1.0', title: '安全指針', content: '', changeType: '定期見直し', changeReason: '', requiredItems: { procedureForRestraint: true, organizationalStructure: true, staffTrainingPolicy: true, reportingProcedure: true, threeRequirementsVerification: true, userExplanationMethod: true, reviewReleaseProcess: true }, effectiveDate: '2026-04-01', status: 'active', createdBy: '', createdAt: '' }
    ]);
    vi.mocked(localTrainingRepository.getAll).mockResolvedValue(
      // 年2回要件
      Array(2).fill({ id: '1', title: '安全研修', trainingType: '身体拘束等適正化研修', format: '集合研修', trainingDate: '2026-04-05', durationMinutes: 60, description: '', materials: '', instructor: '', participants: [], achievementNotes: '', improvementNotes: '', recordedBy: '', recordedAt: '', status: 'completed' })
    );

    const { result } = renderHook(() => useSafetyOperationsSummary());

    // 初期状態は loading = true
    expect(result.current.loading).toBe(true);
    expect(result.current.summary).toBeNull();

    // 非同期処理完了を待つ
    await waitFor(() => expect(result.current.loading).toBe(false));

    // summary が期待通り入っていること
    expect(result.current.summary).not.toBeNull();
    // 全て要件を満たしているので good になるはず
    expect(result.current.summary?.overallLevel).toBe('good');
  });

  it('⚪ 空データ: 各種リポジトリからの返り値が空配列の場合でも、クラッシュせずに初期化されること', async () => {
    vi.mocked(localIncidentRepository.getAll).mockResolvedValue([]);
    vi.mocked(localRestraintRepository.getAll).mockResolvedValue([]);
    vi.mocked(localCommitteeRepository.getAll).mockResolvedValue([]);
    vi.mocked(localGuidelineRepository.getAll).mockResolvedValue([]);
    vi.mocked(localTrainingRepository.getAll).mockResolvedValue([]);

    const { result } = renderHook(() => useSafetyOperationsSummary());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.summary).not.toBeNull();
    // 全て空の場合、実施要件違反（委員会未開催など）により「warning」に倒れるドメイン仕様であることを確認
    expect(result.current.summary?.overallLevel).toBe('warning');
    // アクション要件（委員会、指針、研修の3点未実施）が3件となる
    expect(result.current.summary?.actionRequiredCount).toBe(3);
  });

  it('🟡 境界条件: 身体拘束の要件未充足影響で overallLevel が critical に倒れること（既存実装固定）', async () => {
    vi.mocked(localIncidentRepository.getAll).mockResolvedValue([]);
    vi.mocked(localRestraintRepository.getAll).mockResolvedValue([
      { id: '1', userId: 'u1', performed: true, restraintType: 'その他', startedAt: '2026-04-02', endedAt: '2026-04-02', durationMinutes: 60, threeRequirements: { immediacy: false, immediacyReason: '', nonSubstitutability: false, nonSubstitutabilityReason: '', temporariness: false, temporarinessReason: '' }, reason: '危険防止', physicalMentalCondition: '', surroundingCondition: '', recordedBy: 'User B', recordedAt: '', status: 'approved' } // 三要件未充足
    ]);
    vi.mocked(localCommitteeRepository.getAll).mockResolvedValue([]);
    vi.mocked(localGuidelineRepository.getAll).mockResolvedValue([]);
    vi.mocked(localTrainingRepository.getAll).mockResolvedValue([]);

    const { result } = renderHook(() => useSafetyOperationsSummary());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.summary).not.toBeNull();
    // 身体拘束の要件未充足は最重度の critical
    expect(result.current.summary?.overallLevel).toBe('critical');
    // アクション要件数 > 0
    expect(result.current.summary?.actionRequiredCount).toBeGreaterThan(0);
  });

  it('🔀 重要な分岐 (Loading): 直後は loading = true, 完了後に false になること', async () => {
    let resolveIncidents!: (val: any) => void;
    vi.mocked(localIncidentRepository.getAll).mockReturnValue(new Promise((resolve) => {
      resolveIncidents = resolve;
    }));
    vi.mocked(localRestraintRepository.getAll).mockResolvedValue([]);
    vi.mocked(localCommitteeRepository.getAll).mockResolvedValue([]);
    vi.mocked(localGuidelineRepository.getAll).mockResolvedValue([]);
    vi.mocked(localTrainingRepository.getAll).mockResolvedValue([]);

    const { result } = renderHook(() => useSafetyOperationsSummary());

    // まだ resolve していないので loading 中
    expect(result.current.loading).toBe(true);

    // resolve 実行
    resolveIncidents([]);
    await waitFor(() => expect(result.current.loading).toBe(false));
    // ロードが完了すること
    expect(result.current.loading).toBe(false);
  });
});
