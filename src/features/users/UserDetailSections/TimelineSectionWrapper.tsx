/**
 * TimelineSectionWrapper — User Detail Sections 内のタイムラインタブ用ラッパー
 *
 * 責務:
 *   - IUserMaster の userId を抽出して UserTimelinePanel に渡す
 *   - useUsersStore から users 一覧を取得して Handoff resolver 構築用に渡す
 *   - 各ドメインの Repository を hook 経由で取得し、fetcher に注入する
 *
 * このコンポーネントは SectionDetailContent から lazy-load される。
 * 表示ロジックは UserTimelinePanel に完全委譲。
 *
 * 段階接続:
 *   - Daily: useDailyRecordRepository() ✅
 *   - Incident: localIncidentRepository (直接 import) ✅
 *   - ISP: useIspRepositories().ispRepo ✅
 *   - Handoff: useHandoffData().repo ✅
 *
 * @see features/timeline/components/UserTimelinePanel.tsx — 表示パネル
 * @see features/timeline/useUserTimeline.ts — orchestration hook
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserTimelinePanel } from '@/features/timeline/components/UserTimelinePanel';
import { createTimelineDataFetcher } from '@/features/timeline/createTimelineDataFetcher';
import { useUsersStore } from '@/features/users/store';
import { useDailyRecordRepository } from '@/features/daily/repositories/repositoryFactory';
import { localIncidentRepository } from '@/infra/localStorage/localIncidentRepository';
import { useIspRepositories } from '@/features/support-plan-guide/hooks/useIspRepositories';
import { useHandoffData } from '@/features/handoff/hooks/useHandoffData';
import type { IUserMaster } from '../types';

export interface TimelineSectionWrapperProps {
  /** 対象利用者 */
  user: IUserMaster;
  /** sourceCounts が確定したときのコールバック（タブ見出しバッジ等に使用） */
  onSourceCountsReady?: (counts: { total: number }) => void;
}

export const TimelineSectionWrapper: React.FC<TimelineSectionWrapperProps> = ({
  user,
  onSourceCountsReady,
}) => {
  // userId を IUserMaster から抽出
  const userId = user.UserID ?? String(user.Id);
  const navigate = useNavigate();

  // UserMaster 一覧（Handoff resolver 構築用）
  const { data: users = [] } = useUsersStore();

  // ─── Repository 取得（Hook ルール遵守: すべて無条件で呼ぶ） ───
  const dailyRepo = useDailyRecordRepository();
  const { ispRepo } = useIspRepositories();
  const { repo: handoffRepo } = useHandoffData();

  // fetcher を安定化（依存する repo が変わったときだけ再構築）
  const fetcher = useMemo(
    () =>
      createTimelineDataFetcher({
        dailyRepo,
        incidentRepo: localIncidentRepository,
        ispRepo,
        handoffRepo,
      }),
    [dailyRepo, ispRepo, handoffRepo],
  );

  return (
    <UserTimelinePanel
      userId={userId}
      userName={user.FullName}
      fetcher={fetcher}
      users={users}
      onNavigate={navigate}
      onSourceCountsReady={onSourceCountsReady}
    />
  );
};
