/**
 * usePlanRole — PlanRole を解決する React hook
 *
 * P4: 既存の isAdmin フラグを PlanRole に変換し、
 * capability ベースの表示制御を可能にする。
 *
 * 責務:
 *  - resolvePlanRole の React ラッパー
 *  - memoized で安定な参照を返す
 *  - 将来の RBAC 接続ポイント
 */

import { useMemo } from 'react';
import { resolvePlanRole, hasCap, type PlanRole, type PlanCapability } from '../domain/planPermissions';

export type UsePlanRoleParams = {
  isAdmin: boolean;
  roleHint?: PlanRole;
};

export type UsePlanRoleReturn = {
  /** 解決済みのロール */
  role: PlanRole;
  /** capability 判定ショートカット */
  can: (cap: PlanCapability) => boolean;
  /** 後方互換: isAdmin 相当（planner 以上） */
  canEdit: boolean;
};

export function usePlanRole({ isAdmin, roleHint }: UsePlanRoleParams): UsePlanRoleReturn {
  return useMemo(() => {
    const role = resolvePlanRole({ isAdmin, roleHint });
    return {
      role,
      can: (cap: PlanCapability) => hasCap(role, cap),
      canEdit: role !== 'staff',
    };
  }, [isAdmin, roleHint]);
}
