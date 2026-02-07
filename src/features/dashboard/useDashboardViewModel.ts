import { useEffect, useMemo } from 'react';

// NOTE:
// - DashboardPage.tsx の「ロール判定・セクション構成・サマリー生成」を段階的にここへ移します。
// - まずは“既存の値を受けて整形して返す”だけの最小版。次パッチで中身を移植します。

export type DashboardRole = 'admin' | 'staff';

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

export type DashboardViewModel<TSummary = unknown> = {
  role: DashboardRole;
  summary: TSummary;
  sections: DashboardSection[];
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
      { key: 'adminOnly', title: '管理者ダッシュボード', enabled: role === 'admin' },
      { key: 'staffOnly', title: 'スタッフダッシュボード', enabled: role === 'staff' },
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

  return useMemo(
    () => ({
      role,
      summary,
      sections,
    }),
    [role, summary, sections],
  );
}