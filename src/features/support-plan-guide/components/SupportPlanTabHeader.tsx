/**
 * SupportPlanTabHeader — 5グループ × サブタブの2段タブヘッダー
 *
 * P1-B: 10タブのフラット構造を group/sub の2段構造に再編。
 *
 * 設計:
 *  - 上段: 5グループタブ（基本情報/計画策定/運用・実行/制度適合/出力）
 *  - 下段: グループ内サブタブ（subs が2+ の場合のみ表示）
 *  - 内部 state は増やさない: activeTab: SectionKey から group を導出
 */
import type { SectionKey } from '@/features/support-plan-guide/types';
import {
  TAB_GROUPS,
  type TabGroupKey,
} from '@/features/support-plan-guide/domain/tabRoute';
import {
  resolveTabRoute,
  getGroupDefaultSub,
  findGroupDef,
} from '@/features/support-plan-guide/domain/tabRoute';
import { SECTIONS } from '@/features/support-plan-guide/utils/helpers';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Box from '@mui/material/Box';
import React from 'react';

// ── サブタブラベル逆引き ──
const SUB_LABELS: ReadonlyMap<SectionKey, string> = new Map(
  SECTIONS.map((s) => [s.key, s.label]),
);

// ────────────────────────────────────────────
// Props
// ────────────────────────────────────────────

export interface SupportPlanTabHeaderProps {
  /** 現在アクティブな SectionKey */
  activeTab: SectionKey;
  /** タブ変更コールバック（SectionKey を直接渡す） */
  onTabChange: (tab: SectionKey) => void;
}

// ────────────────────────────────────────────
// Component
// ────────────────────────────────────────────

const SupportPlanTabHeader: React.FC<SupportPlanTabHeaderProps> = ({
  activeTab,
  onTabChange,
}) => {
  // ── activeTab → 現在のグループを導出 ──
  const currentRoute = resolveTabRoute(activeTab);
  const activeGroupKey: TabGroupKey = currentRoute?.group ?? 'basic';
  const activeGroupDef = findGroupDef(activeGroupKey);

  // ── グループタブクリック → グループのデフォルト sub に遷移 ──
  const handleGroupChange = React.useCallback(
    (_event: React.SyntheticEvent, newGroupKey: TabGroupKey) => {
      const defaultSub = getGroupDefaultSub(newGroupKey);
      if (defaultSub) {
        onTabChange(defaultSub);
      }
    },
    [onTabChange],
  );

  // ── サブタブクリック → そのまま sub を渡す ──
  const handleSubChange = React.useCallback(
    (_event: React.SyntheticEvent, newSub: SectionKey) => {
      onTabChange(newSub);
    },
    [onTabChange],
  );

  return (
    <Box>
      {/* ── 上段: グループタブ ── */}
      <Tabs
        value={activeGroupKey}
        onChange={handleGroupChange}
        variant="fullWidth"
        aria-label="支援計画セクショングループ"
        sx={{
          minHeight: 42,
          '& .MuiTab-root': {
            minHeight: 42,
            fontWeight: 600,
            fontSize: '0.85rem',
          },
        }}
      >
        {TAB_GROUPS.map((group) => (
          <Tab
            key={group.key}
            value={group.key}
            label={group.label}
            id={`sp-group-tab-${group.key}`}
            aria-controls={`sp-group-panel-${group.key}`}
          />
        ))}
      </Tabs>

      {/* ── 下段: サブタブ（2+ subs のグループのみ） ── */}
      {activeGroupDef && activeGroupDef.subs.length > 1 && (
        <Tabs
          value={activeTab}
          onChange={handleSubChange}
          variant="scrollable"
          scrollButtons="auto"
          aria-label={`${activeGroupDef.label}セクション切り替え`}
          sx={{
            minHeight: 36,
            borderTop: 1,
            borderColor: 'divider',
            '& .MuiTab-root': {
              minHeight: 36,
              fontSize: '0.8rem',
              textTransform: 'none',
            },
          }}
        >
          {activeGroupDef.subs.map((sub) => (
            <Tab
              key={sub}
              value={sub}
              label={SUB_LABELS.get(sub) ?? sub}
              id={`sp-sub-tab-${sub}`}
              aria-controls={`support-plan-tabpanel-${sub}`}
            />
          ))}
        </Tabs>
      )}
    </Box>
  );
};

export default SupportPlanTabHeader;
