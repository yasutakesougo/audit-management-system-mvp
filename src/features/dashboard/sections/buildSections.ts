/**
 * Dashboard Sections Layer (UI Layer 2: Builder)
 *
 * 役割：
 * 1. DASHBOARD_SECTIONS: セクション定義の定数（全8個・非表示含む）
 * 2. buildDashboardSections(): ロール別の可視セクション配列
 * 3. getDashboardAnchorIdByKey(): 常に全キーの anchor 辞書
 *
 * 重要な分業：
 * ✓ buildDashboardSections() は「可視セクション」を返す → map 用
 * ✓ getDashboardAnchorIdByKey() は「全8個の anchor」を返す → スクロール参照用
 * 
 * これで sectionIdByKey[key] が undefined になることはない
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { DashboardSectionKey, DashboardSectionDef } from './types';

/**
 * ‼️ 重要：全セクション定義（ロール関わらず全部ここ）
 * 
 * `audience` の値：
 * - 'both': staff / admin 両方に表示
 * - 'admin': admin のみ表示
 * - 'staff': staff のみ表示
 * 
 * anchorId は固定（ロール関係なく解決）→ E2E や スクロール参照が安定
 */
export const DASHBOARD_SECTIONS: readonly DashboardSectionDef[] = [
  {
    key: 'safety',
    title: '安全インジケーター',
    anchorId: 'sec-safety',
    audience: 'both',
  },
  {
    key: 'attendance',
    title: '今日の通所 / 出勤状況',
    anchorId: 'sec-attendance',
    audience: 'both',
  },
  {
    key: 'daily',
    title: '日次記録状況',
    anchorId: 'sec-daily',
    audience: 'both',
  },
  {
    key: 'schedule',
    title: '今日の予定',
    anchorId: 'sec-schedule',
    audience: 'both',
  },
  {
    key: 'handover',
    title: '申し送りタイムライン',
    anchorId: 'sec-handover',
    audience: 'both',
  },
  {
    key: 'stats',
    title: '統計情報',
    anchorId: 'sec-stats',
    audience: 'both',
  },
  {
    key: 'adminOnly',
    title: '管理者ダッシュボード',
    anchorId: 'sec-admin',
    audience: 'admin',
  },
  {
    key: 'staffOnly',
    title: 'スタッフ情報',
    anchorId: 'sec-staff',
    audience: 'staff',
  },
] as const;

export type BuildSectionsArgs = {
  role: 'admin' | 'staff';
};

/**
 * ✅ ロール別の可視セクション配列を返す
 * 
 * 使用例：
 * ```ts
 * const sections = buildDashboardSections({ role: 'staff' });
 * // → staffOnly は含まれ、adminOnly は含まれない
 * sections.map(s => <MySection key={s.key} {...s} />)
 * ```
 */
export function buildDashboardSections(
  args: BuildSectionsArgs,
): DashboardSectionDef[] {
  const { role } = args;

  return DASHBOARD_SECTIONS.filter(
    (s) => s.audience === 'both' || s.audience === role,
  );
}

/**
 * ✅ 常に全 8 キーの anchor 辞書を返す
 * 
 * 重要：このメソッドは「ロール関係なく全セクション」の anchorId を提供する
 * → sectionIdByKey[any_key_that_exists_in_DashboardSectionKey] は undefined にならない
 * 
 * 使用例：
 * ```ts
 * const anchorIds = getDashboardAnchorIdByKey();
 * // {
 * //   safety: 'sec-safety',
 * //   attendance: 'sec-attendance',
 * //   ...
 * //   staffOnly: 'sec-staff', // ← admin ロールでも必ず存在
 * // }
 * ```
 */
export function getDashboardAnchorIdByKey(): Record<
  DashboardSectionKey,
  string
> {
  return Object.fromEntries(
    DASHBOARD_SECTIONS.map((s) => [s.key, s.anchorId]),
  ) as Record<DashboardSectionKey, string>;
}
