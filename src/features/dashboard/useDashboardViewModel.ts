import { canAccessDashboardAudience, isDashboardAudience } from '@/features/auth/store';
import type { BriefingAlert } from '@/features/dashboard/sections/types';
import { useEffect, useMemo } from 'react';
import { DASHBOARD_SECTIONS } from './sections/buildSections';

// ── 型の正本は sections/types.ts。ここでは re-export のみ ──
export type {
  DashboardRole,
  DashboardSection,
  DashboardSectionKey,
} from '@/features/dashboard/sections/types';
import type {
  DashboardRole,
  DashboardSection,
  DashboardSectionKey,
} from '@/features/dashboard/sections/types';

/**
 * 現在の時間帯を示すコンテキスト
 */
export type DashboardTimeContext = 'morning' | 'afternoon' | 'evening';

/**
 * 朝会・夕会の実行状態
 */
export type DashboardContextInfo = {
  timeContext: DashboardTimeContext;
  isBriefingTime: boolean;
  briefingType?: 'morning' | 'evening';
};

export type DashboardBriefingChip = {
  key: 'attention' | 'pending' | 'absence' | 'late';
  label: string;
  count: number;
  kind: 'default' | 'info' | 'warning' | 'error';
};

export type DashboardViewModel<TSummary = unknown> = {
  role: DashboardRole;
  summary: TSummary;
  sections: DashboardSection[];
  briefingChips: DashboardBriefingChip[];
  contextInfo: DashboardContextInfo;
  orderedSections: DashboardSection[];
  briefingAlerts: BriefingAlert[];
};

type DashboardSummaryInfo = {
  handoff?: {
    byStatus?: Record<string, number>;
    critical?: number;
  };
  attendanceSummary?: {
    absenceCount?: number;
    lateOrEarlyLeave?: number;
    outStaff?: number;
  };
};

export type UseDashboardViewModelParams<TSummary = unknown> = {
  role: DashboardRole;
  summary: TSummary;
  sectionKeys?: DashboardSectionKey[];
};

export function useDashboardViewModel<TSummary = unknown>(
  params: UseDashboardViewModelParams<TSummary>,
): DashboardViewModel<TSummary> {
  const { role, summary, sectionKeys } = params;

  const sections = useMemo<DashboardSection[]>(() => {
    const defaults: DashboardSection[] = DASHBOARD_SECTIONS.map(def => ({
      ...def,
      enabled: def.audience === 'both' || (def.audience === 'admin' && canAccessDashboardAudience(role, 'admin')) || (def.audience === 'staff' && isDashboardAudience(role, 'staff')),
    }));

    if (!sectionKeys || sectionKeys.length === 0) {
      return defaults;
    }

    return sectionKeys.map((key) => {
      const found = defaults.find((entry) => entry.key === key);
      return found ?? { ...DASHBOARD_SECTIONS.find(s => s.key === key)!, enabled: true };
    });
  }, [role, sectionKeys]);

  const briefingChips = useMemo<DashboardBriefingChip[]>(() => {
    const summaryInfo = summary as DashboardSummaryInfo;
    const chips: DashboardBriefingChip[] = [];

    const critical = summaryInfo?.handoff?.critical ?? 0;
    if (critical > 0) {
      chips.push({
        key: 'attention',
        label: `注意 ${critical}`,
        count: critical,
        kind: 'error',
      });
    }

    const pending = summaryInfo?.handoff?.byStatus?.['未対応'] ?? 0;
    if (pending > 0) {
      chips.push({
        key: 'pending',
        label: `未対応 ${pending}`,
        count: pending,
        kind: 'warning',
      });
    }

    const absence = summaryInfo?.attendanceSummary?.absenceCount ?? 0;
    if (absence > 0) {
      chips.push({
        key: 'absence',
        label: `欠席 ${absence}`,
        count: absence,
        kind: 'default',
      });
    }

    const late = summaryInfo?.attendanceSummary?.lateOrEarlyLeave ?? 0;
    if (late > 0) {
      chips.push({
        key: 'late',
        label: `遅刻・早退 ${late}`,
        count: late,
        kind: 'info',
      });
    }

    return chips;
  }, [summary]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const keys = sections.map((section) => section.key);
    const seen = new Set<DashboardSectionKey>();
    const duplicates = new Set<DashboardSectionKey>();
    for (const key of keys) {
      if (seen.has(key)) {
        duplicates.add(key);
      }
      seen.add(key);
    }
    if (duplicates.size > 0) {
      // eslint-disable-next-line no-console
      console.warn('[dashboard] duplicate section keys detected:', Array.from(duplicates));
    }
  }, [sections]);

  const contextInfo = useMemo<DashboardContextInfo>(() => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    let timeContext: DashboardTimeContext;
    if (hour >= 8 && hour < 12) {
      timeContext = 'morning';
    } else if (hour >= 12 && hour < 17) {
      timeContext = 'afternoon';
    } else {
      timeContext = 'evening';
    }

    const isBriefingTime = (hour === 8 && minute < 30) || (hour === 17);

    const briefingType = isBriefingTime
      ? timeContext === 'morning'
        ? 'morning'
        : 'evening'
      : undefined;

    return {
      timeContext,
      isBriefingTime,
      briefingType,
    };
  }, []);

  const orderedSections = useMemo<DashboardSection[]>(() => {
    const priorityMap: Record<DashboardTimeContext, Record<DashboardSectionKey, number>> = {
      morning: {
        attendance: 0,
        schedule: 1,
        safety: 2,
        daily: 3,
        handover: 4,
        stats: 5,
        adminOnly: 6,
        staffOnly: 7,
      },
      afternoon: {
        schedule: 0,
        daily: 1,
        safety: 2,
        attendance: 3,
        handover: 4,
        stats: 5,
        adminOnly: 6,
        staffOnly: 7,
      },
      evening: {
        schedule: 0,
        daily: 1,
        safety: 2,
        attendance: 3,
        handover: 4,
        stats: 5,
        adminOnly: 6,
        staffOnly: 7,
      },
    };

    const priorities = priorityMap[contextInfo.timeContext] ?? priorityMap.afternoon;

    return [...sections].sort((a, b) => {
      const priorityA = priorities[a.key] ?? 999;
      const priorityB = priorities[b.key] ?? 999;
      return priorityA - priorityB;
    });
  }, [sections, contextInfo.timeContext]);

  const briefingAlerts = useMemo<BriefingAlert[]>(() => {
    const summaryInfo = summary as DashboardSummaryInfo & { briefingAlerts?: BriefingAlert[] };
    return summaryInfo?.briefingAlerts ?? [];
  }, [summary]);

  return useMemo(
    () => ({
      role,
      summary,
      sections,
      briefingChips,
      contextInfo,
      orderedSections,
      briefingAlerts,
    }),
    [role, summary, sections, briefingChips, contextInfo, orderedSections, briefingAlerts],
  );
}
