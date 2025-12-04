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

type ViewMode = 'day' | 'week' | 'month';

type Props = {
  mode: ViewMode;
  title?: string;
  subLabel: string;
  periodLabel: string;
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
};

export const SchedulesHeader: React.FC<Props> = ({
  mode,
  title = 'スケジュール',
  subLabel,
  periodLabel,
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
}) => {
  const navigate = useNavigate();
  const isSmall = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'));

  const handleTabChange = (_: React.SyntheticEvent, value: ViewMode) => {
    if (value === mode) {
      return;
    }
    const nextHref = { day: dayHref, week: weekHref, month: monthHref }[value];
    navigate(nextHref);
  };

  return (
    <Stack spacing={1.5} sx={{ mb: 2 }} data-testid={TESTIDS.SCHEDULES_HEADER_ROOT}>
      <Stack
        direction={isSmall ? 'column' : 'row'}
        alignItems={isSmall ? 'flex-start' : 'center'}
        spacing={isSmall ? 1 : 2}
        justifyContent={isSmall ? 'flex-start' : 'space-between'}
        sx={{ mb: isSmall ? 1 : 0 }}
      >
        <Box>
          <Typography
            variant="h5"
            component="h1"
            sx={{ fontWeight: 700 }}
            id={headingId}
            data-testid={titleTestId}
            data-page-heading="true"
          >
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {subLabel}
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isSmall ? 'center' : 'flex-start',
            width: isSmall ? '100%' : 'auto',
          }}
        >
          <Tabs value={mode} onChange={handleTabChange} aria-label={tablistLabel} sx={{ flexShrink: 0 }}>
            <Tab label="日" value="day" sx={{ minHeight: 40 }} />
            <Tab label="週" value="week" sx={{ minHeight: 40 }} />
            <Tab label="月" value="month" sx={{ minHeight: 40 }} />
          </Tabs>
        </Box>

        <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ display: isSmall ? 'none' : 'flex' }}>
          {!isSmall && showPrimaryAction && onPrimaryCreate ? (
            <Button
              variant="contained"
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
      </Stack>

      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} flexWrap="wrap">
        <Stack direction="column" spacing={0.5} sx={{ minWidth: 200 }}>
          <Typography
            variant="subtitle1"
            data-testid={rangeTestId ?? TESTIDS.SCHEDULES_RANGE_LABEL}
            id={rangeLabelId}
            aria-live={rangeAriaLive}
          >
            {periodLabel}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={onToday}
            sx={{ width: 'fit-content' }}
            data-testid={todayTestId}
            ref={todayButtonRef}
            onBlur={todayButtonOnBlur}
            aria-label={todayButtonLabel}
            title={todayButtonLabel}
          >
            今日
          </Button>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ flexGrow: 1 }} justifyContent="center">
          <Button
            variant="text"
            onClick={onPrev}
            data-testid={prevTestId}
            ref={prevButtonRef}
            onBlur={prevButtonOnBlur}
            aria-label={prevButtonLabel}
            title={prevButtonLabel}
          >
            &lt; 前
          </Button>
          <Button
            variant="text"
            onClick={onNext}
            data-testid={nextTestId}
            ref={nextButtonRef}
            onBlur={nextButtonOnBlur}
            aria-label={nextButtonLabel}
            title={nextButtonLabel}
          >
            次 &gt;
          </Button>
        </Stack>

        <Box sx={{ minWidth: 260, display: 'flex', justifyContent: 'flex-end', flex: '1 1 auto' }}>{children}</Box>
      </Stack>
    </Stack>
  );
};

export default SchedulesHeader;
