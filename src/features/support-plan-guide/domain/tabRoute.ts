/**
 * tabRoute — Support Plan Guide のタブルーティング SSOT
 *
 * P1.5: group.sub 形式でタブ遷移を正規化し、
 * URL / 内部 state / UI 表示の一元的な真実源を提供する。
 *
 * 設計原則:
 *  - 純粋関数のみ（React 非依存）
 *  - SectionKey との後方互換を維持
 *  - 旧 ?tab=monitoring → 新 operations.monitoring の段階移行
 */

import type { SectionKey } from '../types';

// ────────────────────────────────────────────
// Group / Route 型定義
// ────────────────────────────────────────────

export type TabGroupKey = 'assessment' | 'isp' | 'monitoring' | 'ibd' | 'output';

export type SupportPlanTabRoute = {
  group: TabGroupKey;
  sub: SectionKey;
};

// ────────────────────────────────────────────
// Group → Sub マッピング（SSOT）
// ────────────────────────────────────────────

export type TabGroupDef = {
  readonly key: TabGroupKey;
  readonly label: string;
  readonly subs: readonly SectionKey[];
  readonly dependsOn?: TabGroupKey;
};

export const TAB_GROUPS: readonly TabGroupDef[] = [
  { key: 'assessment', label: '1. アセスメント',   subs: ['assessment'] },
  { key: 'isp',        label: '2. 個別支援計画 (ISP)',   subs: ['overview', 'smart', 'supports', 'safety', 'decision'], dependsOn: 'assessment' },
  { key: 'monitoring', label: '3. モニタリング',   subs: ['monitoring'], dependsOn: 'isp' },
  { key: 'ibd',        label: '4. 強度行動障害支援計画シート',   subs: ['risk', 'excellence'], dependsOn: 'assessment' },
  { key: 'output',     label: '5. 同意・プレビュー',   subs: ['compliance', 'preview'], dependsOn: 'isp' },
] as const;




// ── 逆引きインデックス: SectionKey → TabGroupKey ──
const SUB_TO_GROUP: ReadonlyMap<SectionKey, TabGroupKey> = (() => {
  const map = new Map<SectionKey, TabGroupKey>();
  for (const group of TAB_GROUPS) {
    for (const sub of group.subs) {
      map.set(sub, group.key);
    }
  }
  return map;
})();

// ── 全 SectionKey セット（バリデーション用） ──
const ALL_SUBS: ReadonlySet<SectionKey> = new Set(SUB_TO_GROUP.keys());

// ── 全 TabGroupKey セット ──
const ALL_GROUPS: ReadonlySet<TabGroupKey> = new Set(TAB_GROUPS.map((g) => g.key));

// ────────────────────────────────────────────
// ユーティリティ関数
// ────────────────────────────────────────────

/**
 * SectionKey → SupportPlanTabRoute に変換する。
 * マッピングに存在しない key の場合は undefined を返す。
 */
export function resolveTabRoute(sub: SectionKey): SupportPlanTabRoute | undefined {
  const group = SUB_TO_GROUP.get(sub);
  if (!group) return undefined;
  return { group, sub };
}

/**
 * SupportPlanTabRoute → URL param 文字列 (`operations.monitoring`) を生成する。
 */
export function serializeTabRoute(route: SupportPlanTabRoute): string {
  return `${route.group}.${route.sub}`;
}

/**
 * URL param 文字列 → SupportPlanTabRoute をパースする。
 *
 * 有効な形式:
 *   - `operations.monitoring` (新形式 group.sub)
 *   - `monitoring` (旧形式 SectionKey のみ — レガシー互換)
 *
 * 無効な場合は undefined を返す。
 */
export function parseTabRoute(param: string | null): SupportPlanTabRoute | undefined {
  if (!param) return undefined;

  const trimmed = param.trim();
  if (!trimmed) return undefined;

  // 新形式: group.sub
  const dotIndex = trimmed.indexOf('.');
  if (dotIndex > 0) {
    const groupPart = trimmed.slice(0, dotIndex);
    const subPart = trimmed.slice(dotIndex + 1);

    if (ALL_GROUPS.has(groupPart as TabGroupKey) && ALL_SUBS.has(subPart as SectionKey)) {
      const expectedGroup = SUB_TO_GROUP.get(subPart as SectionKey);
      // group と sub の整合性を検証
      if (expectedGroup === groupPart) {
        return { group: groupPart as TabGroupKey, sub: subPart as SectionKey };
      }
    }
    return undefined;
  }

  // レガシー形式: sub のみ → resolveLegacyTabParam にフォールバック
  return resolveLegacyTabParam(trimmed);
}

/**
 * 旧形式の tab パラメータ (例: `monitoring`) を新形式 Route に変換する。
 * 旧 `?tab=monitoring` の URL をそのまま吸収するためのアダプター。
 *
 * 無効な値の場合は undefined を返す（呼び出し元で 'overview' へフォールバック）。
 */
export function resolveLegacyTabParam(param: string): SupportPlanTabRoute | undefined {
  if (!param) return undefined;
  const trimmed = param.trim();
  if (!ALL_SUBS.has(trimmed as SectionKey)) return undefined;
  return resolveTabRoute(trimmed as SectionKey);
}

// ────────────────────────────────────────────
// ヘルパー: グループ情報の取得
// ────────────────────────────────────────────

/**
 * TabGroupKey からグループ定義を取得する。
 */
export function findGroupDef(groupKey: TabGroupKey): TabGroupDef | undefined {
  return TAB_GROUPS.find((g) => g.key === groupKey);
}

/**
 * SectionKey が属するグループの最初の sub を取得する。
 * グループ内ナビゲーションのデフォルト遷移先として使用。
 */
export function getGroupDefaultSub(groupKey: TabGroupKey): SectionKey | undefined {
  const group = findGroupDef(groupKey);
  return group?.subs[0];
}

/**
 * 全 SectionKey をフラット順で返す（TAB_ORDER 互換）。
 */
export function getAllSubsFlat(): SectionKey[] {
  return TAB_GROUPS.flatMap((g) => [...g.subs]);
}
