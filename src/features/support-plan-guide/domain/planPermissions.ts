/**
 * planPermissions — 支援計画ガイドの権限モデル（P4）
 *
 * 権限境界を pure 関数で定義し、UIコンポーネントが直接
 * isAdmin を判定する代わりに capability ベースで制御する。
 *
 * 階層: staff ⊂ planner ⊂ admin
 *
 * 設計意図:
 *  - pure 関数なのでテストしやすい
 *  - 後で RBAC や Graph 接続に差し替えやすい
 *  - isAdmin: boolean から段階的に移行できる
 */

// ────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────

/** 支援計画ガイドのロール（staff ⊂ planner ⊂ admin） */
export type PlanRole = 'staff' | 'planner' | 'admin';

/**
 * 機能ごとの capability（ドット記法で名前空間を分離）
 *
 * 命名規則: <feature>.<action>
 *  - view: 表示権限
 *  - decide: 採否判断
 *  - promote: 目標昇格
 *  - act: 操作権限（汎用）
 *  - manage: 設定変更
 */
export type PlanCapability =
  // ── フォーム ──
  | 'form.edit'              // フォーム入力・編集
  | 'form.save'              // 保存
  // ── 提案 ──
  | 'suggestions.view'       // 提案UIの表示
  | 'suggestions.decide'     // 採否判断（accept/dismiss）
  | 'suggestions.promote'    // 目標昇格
  // ── 改善メモ ──
  | 'memo.view'              // 改善メモセクションの表示
  | 'memo.act'               // noted/deferred/promoted 操作
  // ── メトリクス ──
  | 'metrics.view'           // メトリクスバッジの表示
  | 'ruleMetrics.view'       // ルール別評価パネルの表示
  // ── 制度HUD ──
  | 'regulatoryHud.view'     // 制度状態HUDの表示
  // ── Planner Assist ──
  | 'plannerAssist.view'     // Next Action Panel の表示
  // ── 設定 ──
  | 'settings.manage'        // 全設定変更
  // ── コンプライアンス ──
  | 'compliance.approve';    // 承認操作

// ────────────────────────────────────────────
// ロール → capability マッピング（SSOT）
// ────────────────────────────────────────────

const ROLE_CAPABILITIES: Record<PlanRole, ReadonlySet<PlanCapability>> = {
  staff: new Set<PlanCapability>([
    'form.edit',
    'form.save',
  ]),

  planner: new Set<PlanCapability>([
    // staff capabilities
    'form.edit',
    'form.save',
    // 提案
    'suggestions.view',
    'suggestions.decide',
    'suggestions.promote',
    // 改善メモ
    'memo.view',
    'memo.act',
    // メトリクス
    'metrics.view',
    // Planner Assist
    'plannerAssist.view',
    // コンプライアンス
    'compliance.approve',
  ]),

  admin: new Set<PlanCapability>([
    // planner capabilities
    'form.edit',
    'form.save',
    'suggestions.view',
    'suggestions.decide',
    'suggestions.promote',
    'memo.view',
    'memo.act',
    'metrics.view',
    'plannerAssist.view',
    'compliance.approve',
    // admin-only
    'ruleMetrics.view',
    'regulatoryHud.view',
    'settings.manage',
  ]),
};

// ────────────────────────────────────────────
// 判定関数
// ────────────────────────────────────────────

/** 指定した capability を持つか判定 */
export function hasCap(role: PlanRole, cap: PlanCapability): boolean {
  return ROLE_CAPABILITIES[role]?.has(cap) ?? false;
}

/**
 * ロールに対する全 capability を列挙
 * （デバッグ・テスト用途）
 */
export function getCapabilities(role: PlanRole): ReadonlySet<PlanCapability> {
  return ROLE_CAPABILITIES[role] ?? new Set();
}

// ────────────────────────────────────────────
// ロール解決（pure）
// ────────────────────────────────────────────

export type ResolvePlanRoleParams = {
  /** 既存の isAdmin フラグ */
  isAdmin: boolean;
  /**
   * 将来拡張: ユーザーの roleHint
   * 例: Graph API や RBAC から取得した role 情報
   */
  roleHint?: PlanRole;
};

/**
 * 現在のコンテキストから PlanRole を導出する pure 関数。
 *
 * 移行期は isAdmin → PlanRole のマッピングとして機能。
 * 将来は roleHint や外部 RBAC に切り替え可能。
 *
 * 現時点の導出ロジック:
 *  - roleHint があればそれを優先
 *  - isAdmin === true → 'admin'
 *  - isAdmin === false → 'staff'
 *
 * Note: 'planner' は将来 roleHint で解決する想定。
 * 今は isAdmin=true の場合に admin として、全機能を開放する。
 */
export function resolvePlanRole({ isAdmin, roleHint }: ResolvePlanRoleParams): PlanRole {
  if (roleHint) return roleHint;
  return isAdmin ? 'admin' : 'staff';
}

// ────────────────────────────────────────────
// ロール比較ヘルパー
// ────────────────────────────────────────────

const ROLE_LEVEL: Record<PlanRole, number> = {
  staff: 0,
  planner: 1,
  admin: 2,
};

/** role が requiredRole 以上かどうか */
export function isAtLeast(role: PlanRole, requiredRole: PlanRole): boolean {
  return ROLE_LEVEL[role] >= ROLE_LEVEL[requiredRole];
}
