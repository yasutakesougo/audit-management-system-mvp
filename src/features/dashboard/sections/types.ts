/**
 * Dashboard Sections Layer (UI Layer 1: Contracts)
 * 
 * セクションの型定義を一元管理。
 * - DashboardSectionKey: セクションの ID（固定文字列）
 * - DashboardSectionDef: セクション定義（タイトル・anchorId・audience）
 * 
 * 利点：
 * ✓ anchor は ロール関わらず常に揃う（sectionIdByKey の undefined 参照ナシ）
 * ✓ audience で表示条件を宣言的に管理
 * ✓ Phase2 での section 実体移動が安全
 */

export type DashboardSectionKey =
  | 'safety'
  | 'attendance'
  | 'daily'
  | 'schedule'
  | 'handover'
  | 'stats'
  | 'adminOnly'
  | 'staffOnly';

/**
 * セクション定義の構造（A層=表示契約・audience 判定）
 * 
 * - key: ユニークな識別子（E2E テスト・ナビ向け）
 * - title: 画面上の見出し
 * - anchorId: HTML id（常に 8 個全部揃う）
 * - audience: 表示対象
 *   - 'both': admin / staff 両方
 *   - 'admin': admin のみ
 *   - 'staff': staff のみ
 * 
 * 重要：このオブジェクトは「非表示を含めて全セクション定義」を保持
 * → sectionIdByKey は常に Record<DashboardSectionKey, string> を満たす
 */
export type DashboardSectionDef = {
  key: DashboardSectionKey;
  title: string;
  anchorId: string;
  audience: 'both' | 'admin' | 'staff';
};

