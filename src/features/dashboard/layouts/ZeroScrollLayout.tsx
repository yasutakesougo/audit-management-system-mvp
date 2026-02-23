/**
 * Zero-Scroll Dashboard Layout (Phase C-1)
 * 
 * 目的：「画面と目が合った瞬間に状況がわかる」ミッションコントロール UI
 * 
 * 設計思想：
 * - タブレット/PC 画面の高さを 100% 活用
 * - スクロールバーを各ペイン内に閉じ込める
 * - 左ペイン（40%）: 申し送りタイムライン
 * - 右ペイン（60%）: 状況把握タブ（利用者・職員・やること）
 * 
 * レスポンシブ対応：
 * - PC/タブレット横: 左右分割（4:6）
 * - スマホ/タブレット縦: タブのみ表示（申し送りは別ページ）
 */

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Badge from '@mui/material/Badge';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

/**
 * タブ定義
 */
export interface DashboardTab {
  /** タブラベル（例: "利用者"） */
  label: string;
  /** バッジに表示する件数（0の場合は非表示） */
  count: number;
  /** タブコンテンツ */
  component: React.ReactNode;
  /** テスト用 ID */
  id: string;
}

/**
 * ZeroScrollLayout Props
 */
export interface ZeroScrollLayoutProps {
  /** 左ペイン: 申し送りタイムライン */
  leftSection: React.ReactNode;
  /** 右ペイン上部: HUD やアラート表示 */
  rightHeader?: React.ReactNode;
  /** 右ペインのタブ定義 */
  tabs: DashboardTab[];
  /** 現在のアクティブタブ（外部制御用） */
  activeTab?: number;
  /** タブ変更時のコールバック */
  onTabChange?: (newTab: number) => void;
}

/**
 * ゼロ・スクロール・ダッシュボード・レイアウト
 * 
 * 画面を左右に分割し、各ペイン内でのみスクロール可能にすることで
 * 「スクロールなしで全体を俯瞰できる」UX を実現
 */
export const ZeroScrollLayout: React.FC<ZeroScrollLayoutProps> = ({
  leftSection,
  rightHeader,
  tabs,
  activeTab: controlledActiveTab,
  onTabChange,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [internalActiveTab, setInternalActiveTab] = useState(0);

  // 外部制御または内部制御
  const activeTab = controlledActiveTab ?? internalActiveTab;

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    if (onTabChange) {
      onTabChange(newValue);
    } else {
      setInternalActiveTab(newValue);
    }
  };

  // スマホの場合は右ペインのみ表示（申し送りは別ページで閲覧）
  if (isMobile) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 120px)',
          overflow: 'hidden',
          p: 1,
        }}
      >
        {rightHeader && (
          <Box sx={{ mb: 1, flexShrink: 0 }}>{rightHeader}</Box>
        )}
        <Box
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: 1,
            overflow: 'hidden',
          }}
        >
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}
          >
            {tabs.map((tab) => (
              <Tab
                key={tab.id}
                label={
                  tab.count > 0 ? (
                    <Badge
                      badgeContent={tab.count}
                      color="error"
                      sx={{
                        '& .MuiBadge-badge': {
                          right: -12,
                          top: 2,
                        },
                      }}
                    >
                      {tab.label}
                    </Badge>
                  ) : (
                    tab.label
                  )
                }
                data-testid={`tab-${tab.id}`}
              />
            ))}
          </Tabs>
          <Box
            sx={{
              flexGrow: 1,
              overflowY: 'auto',
              p: 2,
            }}
            data-testid={`tab-content-${tabs[activeTab]?.id}`}
          >
            {tabs[activeTab]?.component}
          </Box>
        </Box>
      </Box>
    );
  }

  // PC/タブレット横：左右分割レイアウト
  return (
    <Box
      sx={{
        display: 'flex',
        height: 'calc(100vh - 120px)', // ヘッダー・ナビゲーション分を除く
        overflow: 'hidden',
        gap: 2,
        p: 1,
      }}
      data-testid="zero-scroll-layout"
    >
      {/* 左ペイン：申し送りタイムライン（40%） */}
      <Box
        sx={{
          flex: '0 0 40%',
          height: '100%',
          overflowY: 'auto',
          bgcolor: 'background.paper',
          borderRadius: 2,
          boxShadow: 1,
          p: 2,
        }}
        data-testid="left-pane-handover"
      >
        {leftSection}
      </Box>

      {/* 右ペイン：インフォメーション・ハブ（60%） */}
      <Box
        sx={{
          flex: '1 1 60%',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          gap: 1,
        }}
        data-testid="right-pane-info-hub"
      >
        {/* HUD/ヘッダー固定 */}
        {rightHeader && (
          <Box sx={{ flexShrink: 0 }}>{rightHeader}</Box>
        )}

        {/* タブとコンテンツ */}
        <Box
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: 1,
            overflow: 'hidden',
          }}
        >
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              flexShrink: 0,
            }}
          >
            {tabs.map((tab) => (
              <Tab
                key={tab.id}
                label={
                  tab.count > 0 ? (
                    <Badge
                      badgeContent={tab.count}
                      color="error"
                      sx={{
                        '& .MuiBadge-badge': {
                          right: -12,
                          top: 2,
                        },
                      }}
                    >
                      {tab.label}
                    </Badge>
                  ) : (
                    tab.label
                  )
                }
                data-testid={`tab-${tab.id}`}
              />
            ))}
          </Tabs>
          <Box
            sx={{
              flexGrow: 1,
              overflowY: 'auto',
              p: 2,
            }}
            data-testid={`tab-content-${tabs[activeTab]?.id}`}
          >
            {tabs[activeTab]?.component}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
