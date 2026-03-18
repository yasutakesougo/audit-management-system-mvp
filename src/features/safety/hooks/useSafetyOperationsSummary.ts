// ---------------------------------------------------------------------------
// useSafetyOperationsSummary — 安全管理サマリフック
//
// P0-1/P0-2/P0-3 の全データを横串で取得し、
// RegulatoryDashboard や ComplianceDashboard に表示するための
// 統合サマリを算出する。
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type IncidentSummary,
  computeIncidentSummary,
} from '@/domain/support/incidentRepository';
import {
  type RestraintSummary,
  computeRestraintSummary,
} from '@/domain/safety/physicalRestraint';
import {
  type CommitteeSummary,
  computeCommitteeSummary,
} from '@/domain/safety/complianceCommittee';
import {
  type GuidelineSummary,
  computeGuidelineSummary,
} from '@/domain/safety/guidelineVersion';
import {
  type TrainingSummary,
  computeTrainingSummary,
} from '@/domain/safety/trainingRecord';

import { localIncidentRepository } from '@/infra/localStorage/localIncidentRepository';
import { localRestraintRepository } from '@/infra/localStorage/localRestraintRepository';
import {
  localCommitteeRepository,
  localGuidelineRepository,
  localTrainingRepository,
} from '@/infra/localStorage/localComplianceRepository';
import {
  computeOverallLevel,
  computeActionRequiredCount,
} from '@/domain/safety/safetyLevel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SafetyOperationsSummary = {
  incident: IncidentSummary;
  restraint: RestraintSummary;
  committee: CommitteeSummary;
  guideline: GuidelineSummary;
  training: TrainingSummary;
  /** 全体の適正化レベル */
  overallLevel: 'good' | 'warning' | 'critical';
  /** 要対応事項の数 */
  actionRequiredCount: number;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSafetyOperationsSummary() {
  const [summary, setSummary] = useState<SafetyOperationsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [incidents, restraints, committees, guidelines, trainings] =
        await Promise.all([
          localIncidentRepository.getAll(),
          localRestraintRepository.getAll(),
          localCommitteeRepository.getAll(),
          localGuidelineRepository.getAll(),
          localTrainingRepository.getAll(),
        ]);

      const incidentSummary = computeIncidentSummary(incidents);
      const restraintSummary = computeRestraintSummary(restraints);
      const committeeSummary = computeCommitteeSummary(committees);
      const guidelineSummary = computeGuidelineSummary(guidelines);
      const trainingSummary = computeTrainingSummary(trainings);

      // 要対応数・全体レベルを純関数で算出
      const levelInput = {
        incident: incidentSummary,
        restraint: restraintSummary,
        committee: committeeSummary,
        guideline: guidelineSummary,
        training: trainingSummary,
      };
      const overallLevel = computeOverallLevel(levelInput);
      const actionRequiredCount = computeActionRequiredCount(levelInput);

      setSummary({
        incident: incidentSummary,
        restraint: restraintSummary,
        committee: committeeSummary,
        guideline: guidelineSummary,
        training: trainingSummary,
        overallLevel,
        actionRequiredCount,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return useMemo(() => ({ summary, loading, reload: loadData }), [summary, loading, loadData]);
}
