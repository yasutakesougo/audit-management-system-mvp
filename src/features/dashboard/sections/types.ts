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

/**
 * 朝会・ブリーフィング用アラート定義
 * 
 * 役割：
 * - 朝会時に「今、確認すべき重要情報」を優先度付して表示
 * - 各アラートはセクションへのナビゲーション用anchorIdを持つ
 * - severity に応じた視覚的強調（色・アイコン）
 * 
 * 使用例：
 * - 欠席が3件 → { type: 'absent', severity: 'error', count: 3 }
 * - 重要申し送り2件待ち → { type: 'urgent_handover', severity: 'warning', count: 2 }
 */
export type BriefingAlert = {
  id: string;  // 'absent' | 'late' | 'urgent_handover' | 'critical_safety'
  type: 'absent' | 'late' | 'urgent_handover' | 'critical_safety' | 'health_concern';
  severity: 'error' | 'warning' | 'info';
  label: string;  // 画面表示用ラベル（「本日欠席」など）
  count: number;  // 該当件数
  targetAnchorId: string;  // クリック時のジャンプ先（sec-attendance など）
  description?: string;  // 追加説明（「田中、山田」など）
};

