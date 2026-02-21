import { TESTIDS } from '@/testids';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { Theme } from '@mui/material/styles';
import React, { type FocusEventHandler } from 'react';
import { useNavigate } from 'react-router-dom';

type ViewMode = 'day' | 'week' | 'month' | 'org';
type ViewModeOption = ViewMode;

type Props = {
  mode: ViewMode;
  title?: string;
  subLabel: string;
  periodLabel: string;
  compact?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onPrimaryCreate?: () => void;
  children?: React.ReactNode;
  dayHref?: string;
  weekHref?: string;
  monthHref?: string;
  rangeLabelId?: string;
  rangeAriaLive?: 'polite' | 'assertive' | 'off';
  headingId?: string;
  titleTestId?: string;
  prevTestId?: string;
  nextTestId?: string;
  todayTestId?: string;
  primaryButtonTestId?: string;
  rangeTestId?: string;
  primaryActionLabel?: string;
  primaryActionAriaLabel?: string;
  showPrimaryAction?: boolean;
  prevButtonRef?: React.Ref<HTMLButtonElement>;
  nextButtonRef?: React.Ref<HTMLButtonElement>;
  todayButtonRef?: React.Ref<HTMLButtonElement>;
  primaryButtonRef?: React.Ref<HTMLButtonElement>;
  prevButtonOnBlur?: FocusEventHandler<HTMLButtonElement>;
  nextButtonOnBlur?: FocusEventHandler<HTMLButtonElement>;
  todayButtonOnBlur?: FocusEventHandler<HTMLButtonElement>;
  onPrimaryBlur?: FocusEventHandler<HTMLButtonElement>;
  tablistLabel?: string;
  prevButtonLabel?: string;
  nextButtonLabel?: string;
  todayButtonLabel?: string;
  modes?: ViewModeOption[];
};

export const SchedulesHeader: React.FC<Props> = ({
  mode,
  title = 'スケジュール',
  subLabel,
  periodLabel,
  compact = false,
  onPrev,
  onNext,
  onToday,
  onPrimaryCreate,
  children,
  dayHref = '/schedules/day',
  weekHref = '/schedules/week',
  monthHref = '/schedules/month',
  rangeLabelId,
  rangeAriaLive = 'polite',
  headingId,
  titleTestId,
  prevTestId,
  nextTestId,
  todayTestId,
  primaryButtonTestId,
  rangeTestId,
  primaryActionLabel = '新規作成',
  primaryActionAriaLabel,
  showPrimaryAction = true,
  prevButtonRef,
  nextButtonRef,
  todayButtonRef,
  primaryButtonRef,
  prevButtonOnBlur,
  nextButtonOnBlur,
  todayButtonOnBlur,
  onPrimaryBlur,
  tablistLabel = 'スケジュールビュー切り替え',
  prevButtonLabel = '前の期間',
  nextButtonLabel = '次の期間',
  todayButtonLabel = '今日へ移動',
  modes = ['day', 'week', 'month'],
}) => {
  const navigate = useNavigate();
  const isSmall = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'));
  const headerBottom = compact ? 0.5 : 0.75;
  const tabsMinHeight = compact ? 28 : 32;
  const tabMinHeight = compact ? 26 : 32;
  const tabMinWidth = compact ? 36 : 44;
  const tabPaddingX = compact ? 0.5 : 1;
  // Responsive button sizing: compact on desktop/tablet (minHeight 36px),
  // expanded on mobile coarse pointer devices (44px)
  const compactButtonSx = compact ? {
    px: 1,
    py: 0.5,
    minHeight: 36,
    '@media (pointer: coarse)': {
      minHeight: 44,
      minWidth: 44,
      py: 0.75,
    },
  } : undefined;

  const handleTabChange = (_: React.SyntheticEvent, value: ViewMode) => {
    if (value === mode) {
      return;
    }
    const nextHref = { day: dayHref, week: weekHref, month: monthHref, org: weekHref }[value];
    if (!nextHref) return;
    // Append tab parameter to maintain tab state in URL for E2E tests and history tracking
    const urlObj = new URL(nextHref, window.location.origin);
    urlObj.searchParams.set('tab', value);
    navigate(urlObj.pathname + urlObj.search);
  };

  return (
    <Stack
      direction={isSmall ? 'column' : 'row'}
      alignItems="center"
      spacing={0}
      justifyContent={isSmall ? 'flex-start' : 'space-between'}
      sx={{ mb: headerBottom }}
      data-testid={TESTIDS.SCHEDULES_HEADER_ROOT}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: '0 0 auto' }}>
        <Typography
          variant="h6"
          component="h1"
          sx={{ fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap' }}
          id={headingId}
          data-testid={titleTestId}
          data-page-heading="true"
        >
          {title}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: compact || isSmall ? 'none' : 'inline' }}
          noWrap
        >
          {subLabel}
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isSmall ? 'center' : 'flex-start',
          flex: '0 0 auto',
          width: isSmall ? '100%' : 'auto',
        }}
      >
        <Tabs
          value={mode}
          onChange={handleTabChange}
          aria-label={tablistLabel}
          sx={{ flexShrink: 0, minHeight: tabsMinHeight }}
          data-testid="schedules-view-tabs"
        >
          {modes.includes('day') && (
            <Tab
              label="日"
              value="day"
              sx={{ minHeight: tabMinHeight, minWidth: tabMinWidth, px: tabPaddingX }}
              data-testid="schedules-view-tab-day"
            />
          )}
          {modes.includes('week') && (
            <Tab
              label="週"
              value="week"
              sx={{ minHeight: tabMinHeight, minWidth: tabMinWidth, px: tabPaddingX }}
              data-testid="schedules-view-tab-week"
            />
          )}
          {modes.includes('month') && (
            <Tab
              label="月"
              value="month"
              sx={{ minHeight: tabMinHeight, minWidth: tabMinWidth, px: tabPaddingX }}
              data-testid="schedules-view-tab-month"
            />
          )}
          {modes.includes('org') && (
            <Tab
              label="組織"
              value="org"
              sx={{ minHeight: tabMinHeight, minWidth: tabMinWidth, px: tabPaddingX }}
              data-testid="schedule-tab-org"
            />
          )}
        </Tabs>
      </Box>

      <Typography
        variant={compact ? 'caption' : 'body2'}
        data-testid={rangeTestId ?? TESTIDS.SCHEDULES_RANGE_LABEL}
        id={rangeLabelId}
        aria-live={rangeAriaLive}
        sx={{ fontWeight: 600, flex: '0 0 auto', display: isSmall ? 'none' : 'block' }}
        noWrap
      >
        {periodLabel}
      </Typography>

      <Stack direction="row" spacing={compact ? 0.5 : 0.75} alignItems="center" sx={{ flex: '0 0 auto', display: isSmall ? 'none' : 'flex' }}>
        <Button
          size="small"
          variant="outlined"
          onClick={onToday}
          data-testid={todayTestId}
          ref={todayButtonRef}
          onBlur={todayButtonOnBlur}
          aria-label={todayButtonLabel}
          title={todayButtonLabel}
          sx={compactButtonSx}
        >
          今日
        </Button>
        <Button
          size="small"
          variant="text"
          onClick={onPrev}
          data-testid={prevTestId}
          ref={prevButtonRef}
          onBlur={prevButtonOnBlur}
          aria-label={prevButtonLabel}
          title={prevButtonLabel}
          sx={compactButtonSx}
        >
          &lt; 前
        </Button>
        <Button
          size="small"
          variant="text"
          onClick={onNext}
          data-testid={nextTestId}
          ref={nextButtonRef}
          onBlur={nextButtonOnBlur}
          aria-label={nextButtonLabel}
          title={nextButtonLabel}
          sx={compactButtonSx}
        >
          次 &gt;
        </Button>
      </Stack>

      <Stack direction="row" spacing={0.5} justifyContent="flex-end" sx={{ display: isSmall ? 'none' : 'flex', flex: '0 0 auto' }}>
        {showPrimaryAction && onPrimaryCreate ? (
          <Button
            variant="contained"
            size="small"
            onClick={onPrimaryCreate}
            data-testid={primaryButtonTestId ?? TESTIDS.SCHEDULES_HEADER_CREATE}
            startIcon={<span aria-hidden="true">＋</span>}
            ref={primaryButtonRef}
            onBlur={onPrimaryBlur}
            aria-label={primaryActionAriaLabel ?? primaryActionLabel}
            title={primaryActionAriaLabel ?? primaryActionLabel}
          >
            {primaryActionLabel}
          </Button>
        ) : null}
      </Stack>

      <Box sx={{ display: isSmall ? 'none' : 'flex', justifyContent: 'flex-end', flex: '1 1 auto', minWidth: 0 }}>{children}</Box>
    </Stack>
  );
};

export default SchedulesHeader;
