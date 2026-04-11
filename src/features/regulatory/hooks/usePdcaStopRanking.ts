import type { ImprovementOutcomeRepository } from '@/domain/isp/improvementOutcomeRepository';
import { buildPdcaHealthScore, type PdcaHealthScore } from '@/domain/isp/pdcaHealth';
import type { MonitoringMeetingRepository } from '@/domain/isp/monitoringMeetingRepository';
import type { PlanningSheetRepository } from '@/domain/isp/port';
import type { PlanPatchRepository } from '@/domain/isp/planPatchRepository';
import type { IUserMaster } from '@/sharepoint/fields';
import { useEffect, useMemo, useState } from 'react';

export interface PdcaStopRankingEntry extends PdcaHealthScore {
  userName?: string;
}

export interface PdcaStopRankingResult {
  ranking: PdcaStopRankingEntry[];
  isLoading: boolean;
  error: Error | null;
}

function resolveUserId(user: IUserMaster): string {
  const userId = String(user.UserID ?? '').trim();
  return userId || `user-${user.Id}`;
}

export function usePdcaStopRanking(
  users: IUserMaster[],
  isLoading: boolean,
  error: Error | null,
  planningSheetRepo?: PlanningSheetRepository | null,
  monitoringMeetingRepo?: MonitoringMeetingRepository | null,
  planPatchRepository?: PlanPatchRepository | null,
  improvementOutcomeRepository?: ImprovementOutcomeRepository | null,
): PdcaStopRankingResult {
  const [ranking, setRanking] = useState<PdcaStopRankingEntry[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingError, setRankingError] = useState<Error | null>(null);

  const targetUsers = useMemo(
    () => users.filter((user) => user.IsActive !== false && user.IsHighIntensitySupportTarget === true),
    [users],
  );

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      if (
        isLoading ||
        error ||
        !planningSheetRepo ||
        !monitoringMeetingRepo ||
        !planPatchRepository ||
        !improvementOutcomeRepository
      ) {
        if (active) {
          setRanking([]);
          setRankingError(error);
        }
        return;
      }

      if (targetUsers.length === 0) {
        if (active) setRanking([]);
        return;
      }

      setRankingLoading(true);
      setRankingError(null);

      try {
        const rows = await Promise.all(
          targetUsers.map(async (user) => {
            const userId = resolveUserId(user);
            const sheets = await planningSheetRepo.listCurrentByUser(userId);
            if (sheets.length === 0) {
              return [];
            }

            const meetings = await monitoringMeetingRepo.listByUser(userId);

            const scores = await Promise.all(
              sheets.map(async (sheet) => {
                const patches = await planPatchRepository.findByPlanningSheetId(sheet.id);
                const outcomes = await improvementOutcomeRepository.findByPlanningSheetId(sheet.id);
                return buildPdcaHealthScore({
                  planningSheetId: sheet.id,
                  userId,
                  patches,
                  meetings: meetings.filter((meeting) => meeting.planningSheetId === sheet.id),
                  outcomes,
                });
              }),
            );

            return scores
              .filter((score) => score.score > 0)
              .map((score) => ({
                ...score,
                userName: user.FullName ?? userId,
              }));
          }),
        );

        if (active) {
          setRanking(
            rows
              .flat()
              .sort((a, b) => b.score - a.score),
          );
        }
      } catch (loadError) {
        if (active) {
          setRankingError(loadError instanceof Error ? loadError : new Error(String(loadError)));
          setRanking([]);
        }
      } finally {
        if (active) setRankingLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [
    error,
    improvementOutcomeRepository,
    isLoading,
    monitoringMeetingRepo,
    planPatchRepository,
    planningSheetRepo,
    targetUsers,
  ]);

  return {
    ranking,
    isLoading: isLoading || rankingLoading,
    error: error || rankingError,
  };
}
