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

import Tooltip from '@mui/material/Tooltip';
import LockRoundedIcon from '@mui/icons-material/LockRounded';

import Stack from '@mui/material/Stack';

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
  /** グループごとのロック・ステータス (progress/isVisible付き) */
  groupStatus: Record<TabGroupKey, { isLocked: boolean; reason?: string; progress: number; isVisible: boolean }>;
}

// ────────────────────────────────────────────
// Component
// ────────────────────────────────────────────

const SupportPlanTabHeader: React.FC<SupportPlanTabHeaderProps> = ({
  activeTab,
  onTabChange,
  groupStatus,
}) => {
  // ── activeTab → 現在のグループを導出 ──
  const currentRoute = resolveTabRoute(activeTab);
  const activeGroupKey: TabGroupKey = currentRoute?.group ?? 'isp';
  const activeGroupDef = findGroupDef(activeGroupKey);

  // 表示対象のグループのみをフィルタ (Point A)
  const visibleGroups = TAB_GROUPS.filter(g => groupStatus[g.key]?.isVisible);

  // ── グループタブクリック → グループのデフォルト sub に遷移 ──
  const handleGroupChange = React.useCallback(
    (_event: React.SyntheticEvent, newGroupKey: TabGroupKey) => {
      const status = groupStatus[newGroupKey];
      if (status?.isLocked) return;

      const defaultSub = getGroupDefaultSub(newGroupKey);
      if (defaultSub) {
        onTabChange(defaultSub);
      }
    },
    [onTabChange, groupStatus],
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
          minHeight: 48,
          '& .MuiTab-root': {
            minHeight: 48,
            fontWeight: 600,
            fontSize: '0.85rem',
            transition: 'all 0.2s ease',
            color: 'text.secondary',
          },
          '& .Mui-selected': {
            color: 'primary.main',
          },
          '& .Mui-disabled': {
            opacity: 0.5,
            color: 'text.disabled',
          },
        }}
      >
        {visibleGroups.map((group) => {
          const status = groupStatus[group.key];
          const label = (
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ display: 'flex' }}>
              <span>{group.label}</span>
              {!status?.isLocked && (status?.progress ?? 0) > 0 && (
                <Box
                  sx={{
                    fontSize: '0.65rem',
                    bgcolor: status?.progress === 100 ? 'success.light' : 'action.selected',
                    color: status?.progress === 100 ? 'success.contrastText' : 'text.secondary',
                    px: 0.5,
                    borderRadius: 1,
                    ml: 'auto',
                  }}
                >
                  {status.progress}%
                </Box>
              )}
            </Stack>
          );

          const tabElement = (
            <Tab
              key={group.key}
              value={group.key}
              label={label}
              disabled={status?.isLocked}
              icon={status?.isLocked ? <LockRoundedIcon sx={{ fontSize: '1rem !important' }} /> : undefined}
              iconPosition="start"
              id={`sp-group-tab-${group.key}`}
              aria-controls={`sp-group-panel-${group.key}`}
              sx={{
                '&.Mui-disabled': {
                  cursor: 'not-allowed',
                  pointerEvents: 'auto',
                },
              }}
            />
          );

          if (status?.isLocked && status.reason) {
            return (
              <Tooltip
                key={group.key}
                title={
                  <Box sx={{ p: 0.5, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {status.reason}
                  </Box>
                }
                arrow
                placement="top"
              >
                <span>{tabElement}</span>
              </Tooltip>
            );
          }

          return tabElement;
        })}
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
