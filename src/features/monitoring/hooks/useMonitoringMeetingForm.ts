import { useState, useCallback } from 'react';
import { 
  MonitoringMeetingDraft, 
  MeetingAttendee, 
  GoalEvaluation,
} from '@/domain/isp/monitoringMeeting';
import { useAuth } from '@/auth/useAuth';

/**
 * useMonitoringMeetingForm — モニタリング会議フォームのステータス管理
 */
export function useMonitoringMeetingForm(initial?: Partial<MonitoringMeetingDraft>) {
  const { account } = useAuth();

  const [draft, setDraft] = useState<MonitoringMeetingDraft>({
    userId: initial?.userId ?? '',
    ispId: initial?.ispId ?? '',
    planningSheetId: initial?.planningSheetId ?? '',
    meetingType: initial?.meetingType ?? 'regular',
    meetingDate: initial?.meetingDate ?? new Date().toISOString().slice(0, 10),
    venue: initial?.venue ?? '事業所内',
    attendees: initial?.attendees ?? [],
    goalEvaluations: initial?.goalEvaluations ?? [],
    overallAssessment: initial?.overallAssessment ?? '',
    userFeedback: initial?.userFeedback ?? '',
    familyFeedback: initial?.familyFeedback ?? '',
    planChangeDecision: initial?.planChangeDecision ?? 'no_change',
    changeReason: initial?.changeReason ?? '',
    decisions: initial?.decisions ?? [],
    nextMonitoringDate: initial?.nextMonitoringDate ?? '',
    implementationSummary: initial?.implementationSummary ?? '',
    behaviorChangeSummary: initial?.behaviorChangeSummary ?? '',
    effectiveSupportSummary: initial?.effectiveSupportSummary ?? '',
    issueSummary: initial?.issueSummary ?? '',
    discussionSummary: initial?.discussionSummary ?? '',
    requiresPlanSheetUpdate: initial?.requiresPlanSheetUpdate ?? false,
    requiresIspUpdate: initial?.requiresIspUpdate ?? false,
    nextActions: initial?.nextActions ?? [],
    hasBasicTrainedMember: initial?.hasBasicTrainedMember ?? false,
    hasPracticalTrainedMember: initial?.hasPracticalTrainedMember ?? false,
    qualificationCheckStatus: initial?.qualificationCheckStatus ?? 'ok',
    recordedBy: initial?.recordedBy ?? account?.name ?? '',
    status: initial?.status ?? 'draft',
    finalizedAt: initial?.finalizedAt,
    finalizedBy: initial?.finalizedBy,
    previousMeetingId: initial?.previousMeetingId,
  });

  const update = useCallback((patch: Partial<MonitoringMeetingDraft>) => {
    setDraft(prev => {
      // 確定済みの場合は更新不可（ただし内部的な確定処理自体は patch に含まれるはずなので、patch.status があれば通す）
      if (prev.status === 'finalized' && !patch.status) {
        return prev;
      }

      const next = { ...prev, ...patch };
      
      // 資格チェックの自動判定
      if (patch.attendees) {
        const hasBasic = patch.attendees.some(a => a.hasBasicTraining || a.hasPracticalTraining);
        const hasPractical = patch.attendees.some(a => a.hasPracticalTraining);
        next.hasBasicTrainedMember = hasBasic;
        next.hasPracticalTrainedMember = hasPractical;
        
        // とりあえず基礎研修がいれば ok, いなければ warning
        next.qualificationCheckStatus = hasBasic ? 'ok' : 'warning';
      }
      
      return next;
    });
  }, []);

  const finalize = useCallback(() => {
    update({
      status: 'finalized',
      finalizedAt: new Date().toISOString(),
      finalizedBy: account?.name ?? 'unknown',
    });
  }, [update, account]);

  const addAttendee = useCallback((attendee: MeetingAttendee) => {
    if (draft.status === 'finalized') return;
    setDraft(prev => {
      const attendees = [...prev.attendees, attendee];
      const hasBasic = attendees.some(a => a.hasBasicTraining || a.hasPracticalTraining);
      const hasPractical = attendees.some(a => a.hasPracticalTraining);
      return { 
        ...prev, 
        attendees,
        hasBasicTrainedMember: hasBasic,
        hasPracticalTrainedMember: hasPractical,
        qualificationCheckStatus: hasBasic ? 'ok' : 'warning'
      };
    });
  }, [draft.status]);

  const removeAttendee = useCallback((staffId: string) => {
    if (draft.status === 'finalized') return;
    setDraft(prev => {
      const attendees = prev.attendees.filter(a => a.staffId !== staffId);
      const hasBasic = attendees.some(a => a.hasBasicTraining || a.hasPracticalTraining);
      const hasPractical = attendees.some(a => a.hasPracticalTraining);
      return { 
        ...prev, 
        attendees,
        hasBasicTrainedMember: hasBasic,
        hasPracticalTrainedMember: hasPractical,
        qualificationCheckStatus: hasBasic ? 'ok' : 'warning'
      };
    });
  }, [draft.status]);

  const updateGoalEvaluation = useCallback((index: number, patch: Partial<GoalEvaluation>) => {
    if (draft.status === 'finalized') return;
    setDraft(prev => {
      const goalEvaluations = [...prev.goalEvaluations];
      goalEvaluations[index] = { ...goalEvaluations[index], ...patch };
      return { ...prev, goalEvaluations };
    });
  }, [draft.status]);

  return {
    draft,
    isFinalized: draft.status === 'finalized',
    update,
    finalize,
    addAttendee,
    removeAttendee,
    updateGoalEvaluation,
  };
}
