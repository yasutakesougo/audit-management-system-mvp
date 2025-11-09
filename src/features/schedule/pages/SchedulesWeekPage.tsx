import React, { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import dayjs from 'dayjs';
import { getComposedWeek, isScheduleFixturesMode, type ScheduleEvent } from '@/features/schedule/api/schedulesClient';
import { ensureMsalSignedIn, getSharePointScopes } from '@/lib/msal';
import { shouldSkipLogin } from '@/lib/env';

type Status = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

type WeekRange = {
  fromISO: string;
  toISO: string;
  label: string;
};

function startOfWeek(base = dayjs()) {
  return base.startOf('week').add(1, 'day');
}

function endOfWeek(start: dayjs.Dayjs) {
  return start.endOf('week');
}

export default function SchedulesWeekPage(): JSX.Element {
  const [anchor, setAnchor] = useState(() => startOfWeek());
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const sharePointScopes = useMemo(() => getSharePointScopes(), []);

  const range = useMemo<WeekRange>(() => {
    const from = startOfWeek(anchor);
    const to = endOfWeek(anchor);
    return {
      fromISO: from.toDate().toISOString(),
      toISO: to.toDate().toISOString(),
      label: `${from.format('YYYY/MM/DD')} – ${to.format('YYYY/MM/DD')}`,
    };
  }, [anchor]);

  useEffect(() => {
    const controller = new AbortController();
    let focusTimeout: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        setStatus('loading');
        const skipAuth = isScheduleFixturesMode() || shouldSkipLogin();
        if (!skipAuth) {
          await ensureMsalSignedIn(sharePointScopes);
        }
        if (controller.signal.aborted) {
          return;
        }
        const data = await getComposedWeek(
          { fromISO: range.fromISO, toISO: range.toISO },
          { signal: controller.signal },
        );
        setEvents(data);
        setStatus(data.length ? 'ready' : 'empty');
  } catch {
        if (!controller.signal.aborted) {
          setStatus('error');
        }
      } finally {
        focusTimeout = setTimeout(() => headingRef.current?.focus(), 0);
      }
    })();

    return () => {
      controller.abort();
      if (focusTimeout !== undefined) {
        clearTimeout(focusTimeout);
      }
    };
  }, [range.fromISO, range.toISO, sharePointScopes]);

  const goPrev = () => setAnchor((current) => current.add(-1, 'week'));
  const goNext = () => setAnchor((current) => current.add(1, 'week'));

  return (
    <Container data-testid="schedules-week-page">
      <Typography
        variant="h5"
        component="h1"
        tabIndex={-1}
        ref={headingRef}
        data-testid="schedules-week-heading"
        aria-live="polite"
      >
        週間予定（{range.label}）
      </Typography>

      <Stack direction="row" spacing={1} sx={{ my: 1 }}>
        <Button data-testid="schedules-week-prev" onClick={goPrev} variant="outlined">
          前の週
        </Button>
        <Button data-testid="schedules-week-next" onClick={goNext} variant="outlined">
          次の週
        </Button>
      </Stack>

      {status === 'loading' && (
        <Stack data-testid="schedules-week-skeleton" aria-busy="true">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} height={48} />
          ))}
        </Stack>
      )}

      {status === 'ready' && (
        <Box
          role="list"
          data-testid="schedules-week-grid"
          aria-label="週間予定一覧"
          sx={{ display: 'grid', gap: 8, my: 1 }}
        >
          {events.map((event) => (
            <Box
              key={`${event.category}-${event.id}`}
              role="listitem"
              data-testid="schedule-item"
              sx={{
                p: 1.25,
                border: '1px solid #e5e7eb',
                borderRadius: 2,
              }}
              aria-label={`${event.title} ${dayjs(event.start).format('MM/DD HH:mm')} - ${dayjs(event.end).format('HH:mm')}`}
            >
              <Typography variant="subtitle2">{event.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {dayjs(event.start).format('MM/DD HH:mm')} – {dayjs(event.end).format('HH:mm')}
                {'　'}[{event.category}]
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {status === 'empty' && (
        <Box
          data-testid="schedules-empty"
          role="status"
          aria-live="polite"
          sx={{ p: 2, color: 'text.secondary' }}
        >
          この週の予定はありません。
        </Box>
      )}

      {status === 'error' && (
        <Box role="alert" sx={{ p: 2, color: 'error.main' }}>
          予定の取得に失敗しました。時間をおいて再度お試しください。
        </Box>
      )}
    </Container>
  );
}
