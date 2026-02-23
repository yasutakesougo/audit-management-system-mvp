import { useEffect, useMemo } from 'react';
import { canAccessDashboardAudience, isDashboardAudience } from '@/features/auth/store';
import type { BriefingAlert } from '@/features/dashboard/sections/types';

// NOTE:
// - DashboardPage.tsx の「ロール判定・セクション構成・サマリー生成」を段階的にここへ移します。
// - まずは"既存の値を受けて整形して返す"だけの最小版。次パッチで中身を移植します。

export type DashboardRole = 'admin' | 'staff';

/**
 * 現在の時間帯を示すコンテキスト
 * - morning: 8:00-12:00
 * - afternoon: 12:00-17:00
 * - evening: 17:00-翌8:00
 */
export type DashboardTimeContext = 'morning' | 'afternoon' | 'evening';

/**
 * 朝会・夕会の実行状態
 * - isBriefingTime: true なら朝会/夕会の時間帯
 * - briefingType: 'morning' | 'evening' | undefined
 */
export type DashboardContextInfo = {
  timeContext: DashboardTimeContext;
  isBriefingTime: boolean;
  briefingType?: 'morning' | 'evening';
};

// IMPORTANT:
// Dashboard のセクションはここでキーを固定する。
// 追加したら DashboardPage の renderSection switch も更新され、漏れは TS が検出する。
export type DashboardSectionKey =
  | 'safety'
  | 'attendance'
  | 'daily'
  | 'schedule'
  | 'handover'
  | 'stats'
  | 'adminOnly'
  | 'staffOnly';

export type DashboardSection = {
  key: DashboardSectionKey;
  // 任意：見出しや表示条件など、Page側に散っているものをここに集約していく
  title?: string;
  enabled?: boolean;
};

export type DashboardBriefingChip = {
  key: 'attention' | 'pending' | 'absence' | 'late' | 'out-staff';
  label: string;
  count: number;
  kind: 'default' | 'info' | 'warning' | 'error';
};

export type DashboardViewModel<TSummary = unknown> = {
  role: DashboardRole;
  summary: TSummary;
  sections: DashboardSection[];
  briefingChips: DashboardBriefingChip[];
  // ✨ Phase A 拡張: 時間帯別レイアウト
  contextInfo: DashboardContextInfo;
  orderedSections: DashboardSection[];  // 時間帯に応じて再順序されたセクション
  briefingAlerts: BriefingAlert[];  // 朝会用アラート
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
  // Page側に既に「表示する順序/キー配列」があるなら、最初はそれを渡すだけでOK
  sectionKeys?: DashboardSectionKey[];
};

export function useDashboardViewModel<TSummary = unknown>(
  params: UseDashboardViewModelParams<TSummary>,
): DashboardViewModel<TSummary> {
  const { role, summary, sectionKeys } = params;

  const sections = useMemo<DashboardSection[]>(() => {
    const defaults: DashboardSection[] = [
      { key: 'safety', title: '安全インジケーター', enabled: true },
      { key: 'attendance', title: '今日の通所 / 出勤状況', enabled: true },
      { key: 'schedule', title: '今日の予定', enabled: true },
      { key: 'handover', title: '申し送りタイムライン', enabled: true },
      { key: 'stats', enabled: true },
      { key: 'adminOnly', title: '管理者ダッシュボード', enabled: canAccessDashboardAudience(role, 'admin') },
      { key: 'staffOnly', title: 'スタッフダッシュボード', enabled: isDashboardAudience(role, 'staff') },
      { key: 'daily', title: '日次記録状況', enabled: true },
    ];

    if (!sectionKeys || sectionKeys.length === 0) {
      return defaults;
    }

    return sectionKeys.map((key) => {
      const found = defaults.find((entry) => entry.key === key);
      return found ?? { key, enabled: true };
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

    const outStaff = summaryInfo?.attendanceSummary?.outStaff ?? 0;
    if (outStaff > 0) {
      chips.push({
        key: 'out-staff',
        label: `外出スタッフ ${outStaff}`,
        count: outStaff,
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

  // ✨ 時間帯コンテキストの計算
  const contextInfo = useMemo<DashboardContextInfo>(() => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    // 時間帯判定
    let timeContext: DashboardTimeContext;
    if (hour >= 8 && hour < 12) {
      timeContext = 'morning';
    } else if (hour >= 12 && hour < 17) {
      timeContext = 'afternoon';
    } else {
      timeContext = 'evening';
    }

    // 朝会・夕会の時間帯判定
    const isBriefingTime =
      (hour === 8 && minute < 30) ||  // 朝会：8:00-8:30
      (hour === 17);  // 夕会：17:00-

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

  // ✨ セクションの時間帯別再順序
  const orderedSections = useMemo<DashboardSection[]>(() => {
    const priorityMap: Record<DashboardTimeContext, Record<DashboardSectionKey, number>> = {
      morning: {
        // 朝は「欠席」「申し送り」「今日の予定」が最優先
        attendance: 0,  // 👥 欠席・遅刻確認
        handover: 1,    // 📢 申し送り
        schedule: 2,    // 📅 今日の予定
        daily: 3,       // 📝 記録状況
        safety: 4,      // ⚠️ 安全指標
        stats: 5,
        adminOnly: 6,
        staffOnly: 7,
      },
      afternoon: {
        // 昼は「現在の状況」と「記録の進捗」
        daily: 0,
        attendance: 1,
        safety: 2,
        handover: 3,
        schedule: 4,
        stats: 5,
        adminOnly: 6,
        staffOnly: 7,
      },
      evening: {
        // 夕会は「1日のまとめ」と「問題行動集計」
        daily: 0,
        safety: 1,
        stats: 2,
        attendance: 3,
        handover: 4,
        schedule: 5,
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

  // ✨ BriefingAlert の集約
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
      contextInfo,      // ✨ 新規
      orderedSections,  // ✨ 新規
      briefingAlerts,   // ✨ 新規
    }),
    [role, summary, sections, briefingChips, contextInfo, orderedSections, briefingAlerts],
  );
}
