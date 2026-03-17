import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MuiRouterLink } from '@/lib/muiLink';

import { TESTIDS, tidWithSuffix } from '@/testids';

import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import type { IUserMaster } from '../types';
import {
    DEFAULT_TAB_KEY,
    menuSections,
    NON_TABBED_SECTIONS,
    QUICK_ACCESS_KEYS,
    TAB_SECTION_KEYS,
    TAB_SECTIONS,
} from './menuSections';
import { SectionDetailContent } from './SectionDetailContent';
import { MenuCardGrid } from './sections/MenuCardGrid';
import { TabPanelList } from './sections/TabPanelList';
import type { MenuSection } from './types';
import { UserDetailHeader } from './UserDetailHeader';

type BackLinkProps =
  | { label?: string; to: string }
  | { label?: string; onClick: () => void }
  | undefined;

type UserDetailSectionsProps = {
  user: IUserMaster;
  backLink?: BackLinkProps;
  variant?: 'page' | 'embedded';
  onEdit?: (user: IUserMaster) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const UserDetailSections: React.FC<UserDetailSectionsProps> = ({ user, backLink, variant = 'page', onEdit }) => {
  const [activeTab, setActiveTab] = useState<MenuSection['key']>(DEFAULT_TAB_KEY);
  const tabPanelRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  // ── タイムラインイベント件数（タブバッジ表示用） ──
  const [timelineCount, setTimelineCount] = useState<number | null>(null);
  const handleTimelineCountsReady = useCallback((counts: { total: number }) => {
    setTimelineCount(counts.total);
  }, []);

  const quickAccessSections = useMemo(
    () => menuSections.filter((section) => QUICK_ACCESS_KEYS.includes(section.key)),
    [],
  );

  const attendanceLabel = user.AttendanceDays?.length ? user.AttendanceDays.join('・') : '—';
  const supportLabel = user.IsHighIntensitySupportTarget ? '強度行動障害支援対象者' : '通常支援';
  const isActive = user.IsActive !== false;

  const handleCardNavigate = useCallback(
    (section: MenuSection) => {
      if (section.key === 'create-user') {
        navigate('/users', { state: { tab: 'create' } });
        return;
      }

      if (TAB_SECTION_KEYS.includes(section.key)) {
        setActiveTab(section.key);
        if (typeof window !== 'undefined') {
          window.requestAnimationFrame(() => {
            if (tabPanelRef.current) {
              tabPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });
        }
        return;
      }

      if (typeof document !== 'undefined') {
        const target = document.getElementById(section.anchor);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    },
    [navigate],
  );

  const backControl = useMemo(() => {
    if (!backLink) return null;
    if ('to' in backLink) {
      return (
        <Button
          component={MuiRouterLink}
          to={backLink.to}
          startIcon={<ArrowBackRoundedIcon />}
          variant="text"
          sx={{ alignSelf: 'flex-start' }}
        >
          {backLink.label ?? '一覧に戻る'}
        </Button>
      );
    }
    if ('onClick' in backLink) {
      return (
        <Button
          onClick={backLink.onClick}
          startIcon={<ArrowBackRoundedIcon />}
          variant="text"
          sx={{ alignSelf: 'flex-start' }}
        >
          {backLink.label ?? '一覧に戻る'}
        </Button>
      );
    }
    return null;
  }, [backLink]);

  const instructionText =
    '利用者一覧を確認するか、新規利用者登録・基本情報・個別支援計画書・支援手順兼記録・モニタリングシートを選択してください。';

  const isEmbedded = variant === 'embedded';

  return (
    <Stack spacing={isEmbedded ? 1.5 : 3} data-testid={TESTIDS['user-detail-sections']}>
      {backControl}

      <UserDetailHeader
        user={user}
        variant={variant}
        onEdit={onEdit}
        attendanceLabel={attendanceLabel}
        supportLabel={supportLabel}
        isActive={isActive}
      />

      {!isEmbedded && (
        <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3 }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                利用者メニュー
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {instructionText}
              </Typography>
            </Box>

            {/* ── Quick Access Bar ── */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap">
              {quickAccessSections.map((section) => (
                <Button
                  key={`quick-${section.key}`}
                  {...tidWithSuffix(TESTIDS['users-quick-prefix'], section.key)}
                  variant={section.key === 'create-user' ? 'contained' : 'outlined'}
                  color={section.key === 'create-user' ? 'primary' : 'inherit'}
                  size="small"
                  onClick={() => handleCardNavigate(section)}
                >
                  {section.title}
                </Button>
              ))}
            </Stack>

            {/* ── Menu Card Grid ── */}
            <MenuCardGrid
              sections={menuSections}
              user={user}
              tabSectionKeys={TAB_SECTION_KEYS}
              onNavigate={handleCardNavigate}
            />

            {/* ── Tab Bar ── */}
            <Tabs
              value={activeTab}
              onChange={(_, value) => setActiveTab(value as MenuSection['key'])}
              variant="scrollable"
              scrollButtons="auto"
              aria-label="利用者メニュータブ"
            >
              {TAB_SECTIONS.map((section) => {
                const IconComponent = section.icon;
                // タイムラインタブには件数バッジを表示
                const badge =
                  section.key === 'timeline' && timelineCount != null && timelineCount > 0
                    ? ` (${timelineCount})`
                    : '';
                return (
                  <Tab
                    key={section.key}
                    value={section.key}
                    label={`${section.title}${badge}`}
                    icon={<IconComponent fontSize="small" />}
                    iconPosition="start"
                    id={`user-menu-tab-${section.key}`}
                    aria-controls={`user-menu-tabpanel-${section.key}`}
                  />
                );
              })}
            </Tabs>

            {/* ── Tab Panels ── */}
            <TabPanelList
              sections={TAB_SECTIONS}
              user={user}
              attendanceLabel={attendanceLabel}
              activeTab={activeTab}
              tabPanelRef={tabPanelRef}
              onTimelineCountsReady={handleTimelineCountsReady}
            />
          </Stack>
        </Paper>
      )}

      {/* ── Non-tabbed sections (scrollable anchors) ── */}
      {NON_TABBED_SECTIONS.map((section) => {
        const IconComponent = section.icon;
        return (
          <Paper
            key={section.key}
            id={section.anchor}
            {...tidWithSuffix(TESTIDS['user-menu-section-prefix'], section.key)}
            variant="outlined"
            sx={{
              p: { xs: 2.5, md: 3 },
              borderRadius: 3,
              scrollMarginTop: 120,
            }}
          >
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar sx={{ bgcolor: section.avatarColor, color: '#fff', width: 48, height: 48 }}>
                  <IconComponent fontSize="medium" />
                </Avatar>
                <Box flex={1}>
                  <Typography variant="h5" component="h3" sx={{ fontWeight: 600 }}>
                    {section.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {section.description}
                  </Typography>
                </Box>
                {section.status === 'coming-soon' && (
                  <Chip label="準備中" size="small" variant="outlined" />
                )}
              </Stack>
              <Divider />
              <SectionDetailContent
                section={section}
                user={user}
                attendanceLabel={attendanceLabel}
              />
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
};

export {
    DEFAULT_TAB_KEY,
    menuSections,
    NON_TABBED_SECTIONS,
    QUICK_ACCESS_KEYS,
    TAB_SECTION_KEYS,
    TAB_SECTIONS
};
export type { MenuSection };
export default UserDetailSections;
