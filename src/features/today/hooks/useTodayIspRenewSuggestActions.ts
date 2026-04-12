import { useEffect, useMemo, useState } from 'react';
import type { MonitoringMeetingRecord, PlanChangeDecision } from '@/domain/isp/monitoringMeeting';
import { useMonitoringMeetingRepository } from '@/features/monitoring/data/useMonitoringMeetingRepository';
import type {
  IspRecommendationLevel,
  IspRecommendationSummary,
} from '@/features/monitoring/domain/ispRecommendationTypes';
import type { IUserMaster } from '@/features/users/types';
import type { RawActionSource } from '../domain/models/queue.types';
import { mapIspRecommendationToTodaySignal } from '../domain/mapIspRecommendationToTodaySignal';
import { mapTodaySignalsToActionSources } from '../domain/mapTodaySignalToActionSource';
import type { TodaySignal } from '../types/todaySignal.types';

export interface UseTodayIspRenewSuggestActionsResult {
  signals: TodaySignal[];
  actionSources: RawActionSource[];
  isLoading: boolean;
}

function resolveUserId(user: IUserMaster): string {
  const userId = String(user.UserID ?? '').trim();
  return userId || `U${String(user.Id ?? 0).padStart(3, '0')}`;
}

function toRecommendationLevel(decision: PlanChangeDecision): IspRecommendationLevel | null {
  switch (decision) {
    case 'minor_revision':
      return 'adjust-support';
    case 'major_revision':
      return 'revise-goal';
    case 'urgent_revision':
    case 'reassessment':
      return 'urgent-review';
    case 'no_change':
      return null;
    default: {
      const _exhaustive: never = decision;
      return _exhaustive;
    }
  }
}

function pickLatestMeeting(meetings: MonitoringMeetingRecord[]): MonitoringMeetingRecord | null {
  if (meetings.length === 0) return null;
  return [...meetings].sort((a, b) => {
    const meetingDateDiff = b.meetingDate.localeCompare(a.meetingDate);
    if (meetingDateDiff !== 0) return meetingDateDiff;
    return (b.recordedAt ?? '').localeCompare(a.recordedAt ?? '');
  })[0] ?? null;
}

function toRecommendationReason(meeting: MonitoringMeetingRecord): string {
  return (
    meeting.changeReason?.trim() ||
    meeting.discussionSummary?.trim() ||
    meeting.overallAssessment?.trim() ||
    'モニタリング結果から計画見直しを推奨'
  );
}

function buildSummaryFromMeeting(
  meeting: MonitoringMeetingRecord,
): IspRecommendationSummary | null {
  const level = toRecommendationLevel(meeting.planChangeDecision);
  if (!level) return null;

  const reason = toRecommendationReason(meeting);
  return {
    recommendations: [
      {
        goalId: meeting.id || `meeting-${meeting.meetingDate}`,
        level,
        reason,
        evidence: {
          progressLevel: 'stagnant',
          rate: 0.25,
          trend: level === 'urgent-review' ? 'declining' : 'stable',
          matchedRecordCount: 1,
          matchedTagCount: 0,
          linkedCategories: [],
        },
      },
    ],
    overallLevel: level,
    actionableCount: 1,
    totalGoalCount: 1,
    summaryText: reason,
  };
}

export function useTodayIspRenewSuggestActions(
  users: IUserMaster[],
): UseTodayIspRenewSuggestActionsResult {
  const monitoringMeetingRepository = useMonitoringMeetingRepository();
  const [signals, setSignals] = useState<TodaySignal[]>([]);
  const [actionSources, setActionSources] = useState<RawActionSource[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const targetUserIds = useMemo(
    () =>
      users
        .filter((user) => user.IsHighIntensitySupportTarget === true)
        .map((user) => resolveUserId(user)),
    [users],
  );
  const targetUserKey = useMemo(() => targetUserIds.join('|'), [targetUserIds]);

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      const currentUserIds = targetUserKey ? targetUserKey.split('|').filter(Boolean) : [];

      if (currentUserIds.length === 0) {
        if (!active) return;
        setSignals([]);
        setActionSources([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const maybeSignals = await Promise.all(
          currentUserIds.map(async (userId) => {
            const meetings = await monitoringMeetingRepository.listByUser(userId);
            const latest = pickLatestMeeting(meetings);
            if (!latest) return null;

            const recommendationSummary = buildSummaryFromMeeting(latest);
            if (!recommendationSummary) return null;

            const sourceRef = latest.id || `monitoring-${latest.meetingDate}`;
            return mapIspRecommendationToTodaySignal({
              userId,
              recommendationSummary,
              sourceRef,
              createdAt: latest.recordedAt || new Date().toISOString(),
              actionPath:
                `/support-plan-guide?userId=${encodeURIComponent(userId)}` +
                `&tab=operations.monitoring&sourceRef=${encodeURIComponent(sourceRef)}`,
            });
          }),
        );

        if (!active) return;

        const nextSignals = maybeSignals.filter(
          (signal): signal is TodaySignal => signal !== null,
        );
        setSignals(nextSignals);
        setActionSources(mapTodaySignalsToActionSources(nextSignals));
      } catch {
        if (!active) return;
        setSignals([]);
        setActionSources([]);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [monitoringMeetingRepository, targetUserKey]);

  return {
    signals,
    actionSources,
    isLoading,
  };
}
