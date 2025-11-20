import { HYDRATION_FEATURES, estimatePayloadSize, startFeatureSpan } from '@/hydration/features';
import Alert from '@mui/material/Alert';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { useCallback, useEffect, useMemo, useState, type MouseEventHandler } from 'react';
// Icons
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import NavigateBeforeRoundedIcon from '@mui/icons-material/NavigateBeforeRounded';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';
import TodayRoundedIcon from '@mui/icons-material/TodayRounded';

import { getMonthlySchedule } from '@/features/schedule/spClient.schedule';
import { getScheduleColorTokens, type ScheduleColorSource } from '@/features/schedule/serviceColors';
import { getAppConfig } from '@/lib/env';
import { useSP } from '@/lib/spClient';
import { useSchedules } from '@/stores/useSchedules';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek } from 'date-fns';
import { ja } from 'date-fns/locale';

type RawSchedule = {
  id?: string | number;
  title?: string | null;
  start?: string | null;
  startUtc?: string | null;
  startLocal?: string | null;
  end?: string | null;
  endUtc?: string | null;
  endLocal?: string | null;
  dayKey?: string | null;
  serviceType?: string | null;
  category?: string | null;
  personType?: string | null;
  personName?: string | null;
  userName?: string | null;
  notes?: string | null;
  location?: string | null;
  billingFlags?: string[] | null;
};

type MonthEntry = ScheduleColorSource & {
  id: string;
  title: string;
  startIso: string;
  endIso?: string | null;
  dayKey: string;
  serviceType?: string | null;
  category?: string | null;
  personType?: string | null;
  personName?: string | null;
  userName?: string | null;
  notes?: string | null;
  location?: string | null;
  billingFlags?: string[] | null;
};

type MonthViewState = {
  entries: MonthEntry[];
  loading: boolean;
  error: string | null;
};

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

type MonthViewProps = {
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: MonthEntry) => void;
};

const sanitizeIso = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const timestamp = Date.parse(trimmed);
  if (Number.isNaN(timestamp)) return null;
  return new Date(timestamp).toISOString();
};

const cleanString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const normalizeDayKey = (value: string | null | undefined, fallbackIso: string | null): string | null => {
  if (typeof value === 'string' && value.trim()) {
    const digits = value.replace(/[^0-9]/g, '');
    if (/^\d{8}$/.test(digits)) {
      return digits;
    }
  }
  if (!fallbackIso) return null;
  return fallbackIso.slice(0, 10).replace(/-/g, '');
};

const toMonthEntries = (input: readonly RawSchedule[] | null | undefined): MonthEntry[] => {
  if (!input?.length) return [];
  return input
    .map((item, index): MonthEntry | undefined => {
      const iso = sanitizeIso(item.start ?? item.startLocal ?? item.startUtc);
      const endIso = sanitizeIso(item.end ?? item.endLocal ?? item.endUtc);
      const dayKey = normalizeDayKey(item.dayKey ?? null, iso);
      if (!iso || !dayKey) {
        return undefined;
      }
      const id = item.id ?? `anon-${index}`;
      const rawTitle = cleanString(item.title) ?? '';
      return {
        id: String(id),
        title: rawTitle || '予定',
        startIso: iso,
        endIso: endIso ?? undefined,
        dayKey,
        serviceType: cleanString(item.serviceType) ?? undefined,
        category: cleanString(item.category) ?? undefined,
        personType: cleanString(item.personType) ?? undefined,
        personName: cleanString(item.personName) ?? cleanString(item.userName) ?? undefined,
        userName: cleanString(item.userName) ?? undefined,
        notes: cleanString(item.notes) ?? undefined,
        location: cleanString(item.location) ?? undefined,
        billingFlags: Array.isArray(item.billingFlags)
          ? item.billingFlags.filter((flag): flag is string => typeof flag === 'string')
          : undefined,
      };
    })
    .filter((entry): entry is MonthEntry => Boolean(entry));
};

const groupByDayKey = (entries: readonly MonthEntry[]): Record<string, MonthEntry[]> =>
  entries.reduce<Record<string, MonthEntry[]>>((acc, entry) => {
    if (!acc[entry.dayKey]) {
      acc[entry.dayKey] = [entry];
    } else {
      acc[entry.dayKey]!.push(entry);
    }
    return acc;
  }, {});

const extractDemoEntries = (raw: unknown): MonthEntry[] => {
  if (!Array.isArray(raw)) return [];
  return toMonthEntries(raw as RawSchedule[]);
};

export default function MonthView({ onDateClick, onEventClick }: MonthViewProps = {}) {
  const theme = useTheme();
  const sp = useSP();
  const { data: demoSchedules } = useSchedules();
  const fallbackEntries = useMemo(() => extractDemoEntries(demoSchedules ?? []), [demoSchedules]);
  const [referenceDate, setReferenceDate] = useState<Date>(() => startOfMonth(new Date()));
  const [{ entries, loading, error }, setState] = useState<MonthViewState>({
    entries: fallbackEntries,
    loading: false,
    error: null,
  });

  // fallbackEntries の初期化は useState で行い、useEffect は削除

  const load = useCallback(
    async (target: Date) => {
      const { isDev: isDevelopment } = getAppConfig();
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const rows = await getMonthlySchedule(sp, {
          year: target.getFullYear(),
          month: target.getMonth() + 1,
        });
        const nextEntries = toMonthEntries(rows as unknown as RawSchedule[]);
        setState({ entries: nextEntries, loading: false, error: null });
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : '予定の取得に失敗しました';
        console.warn('MonthView SharePoint API エラー:', message);

        // 開発環境ではSharePointエラーを無視してfallbackEntriesを使用
        if (isDevelopment) {
          console.info('開発環境: MonthView SharePoint接続エラーのためモックデータを使用します');
          setState({
            entries: fallbackEntries,
            loading: false,
            error: null // 開発環境ではエラーを表示せず
          });
        } else {
          setState({
            entries: fallbackEntries,
            loading: false,
            error: message
          });
        }
      }
    },
    [sp] // fallbackEntriesへの依存を削除
  );

  useEffect(() => {
    const loadData = async () => {
      try {
        await load(referenceDate);
      } catch (error) {
        // エラーは load 内で処理済み
        console.warn('MonthView load error:', error);

        // 開発環境でSharePointエラーの場合、再試行を避ける
        if (getAppConfig().isDev) {
          console.info('開発環境: MonthView エラー発生のため、再試行をスキップします');
        }
      }
    };

    loadData();
  }, [referenceDate.getTime(), sp]); // loadへの依存を削除し、referenceDateのtimeを使用

  const calendarDays = useMemo(() => {
    const span = startFeatureSpan(HYDRATION_FEATURES.schedules.recompute, {
      view: 'month',
      entryCount: entries.length,
      bytes: estimatePayloadSize(entries),
    });
    try {
      const monthStart = startOfMonth(referenceDate);
      const monthEnd = endOfMonth(referenceDate);
      const rangeStart = startOfWeek(monthStart, { locale: ja });
      const rangeEnd = endOfWeek(monthEnd, { locale: ja });
      const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
      const grouped = groupByDayKey(entries);

      const mapped = days.map((date) => {
        const key = format(date, 'yyyyMMdd');
        return {
          date,
          key,
          isCurrentMonth: isSameMonth(date, referenceDate),
          entries: grouped[key] ?? [],
        };
      });

      span({ meta: { status: 'ok', dayCount: mapped.length, bytes: estimatePayloadSize(mapped) } });
      return mapped;
    } catch (error) {
      span({
        meta: { status: 'error' },
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }, [entries, referenceDate]);

  const monthLabel = useMemo(() => format(referenceDate, 'yyyy年 M月', { locale: ja }), [referenceDate]);

  return (
    <Box>
      {/* Header with navigation */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h6" component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CalendarMonthRoundedIcon />
          {monthLabel}
        </Typography>

        <Stack direction="row" spacing={1}>
          <IconButton
            onClick={() => setReferenceDate((prev) => addMonths(prev, -1))}
            aria-label="前の月へ移動"
            size="small"
          >
            <NavigateBeforeRoundedIcon />
          </IconButton>

          <Button
            variant="outlined"
            size="small"
            onClick={() => setReferenceDate(startOfMonth(new Date()))}
            aria-label="今月に移動"
            startIcon={<TodayRoundedIcon />}
          >
            今月
          </Button>

          <IconButton
            onClick={() => setReferenceDate((prev) => addMonths(prev, 1))}
            aria-label="次の月へ移動"
            size="small"
          >
            <NavigateNextRoundedIcon />
          </IconButton>
        </Stack>
      </Stack>

      {error && <Alert severity="warning" sx={{ mb: 3 }}>{error}</Alert>}

      {/* Weekday Headers */}
      <Paper elevation={0} sx={{ mb: 2, borderRadius: 1 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {WEEKDAY_LABELS.map((label) => (
            <Box key={label} sx={{ p: 1, textAlign: 'center', borderRight: 1, borderColor: 'divider', '&:last-child': { borderRight: 'none' } }}>
              <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">
                {label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      {/* Calendar Grid */}
      <Paper elevation={0} sx={{ borderRadius: 1, overflow: 'hidden' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, p: 1 }}>
          {calendarDays.map(({ date, key, isCurrentMonth, entries: dayEntries }) => (
            <Card
              key={key}
              variant={isCurrentMonth ? "outlined" : "elevation"}
              elevation={isCurrentMonth ? 0 : 1}
              onClick={() => onDateClick?.(date)}
              sx={{
                minHeight: 120,
                bgcolor: isCurrentMonth ? 'background.paper' : 'action.hover',
                borderColor: isCurrentMonth ? 'divider' : 'transparent',
                opacity: isCurrentMonth ? 1 : 0.6,
                cursor: onDateClick ? 'pointer' : 'default',
                '&:hover': {
                  elevation: 2,
                  transform: 'translateY(-1px)',
                  transition: 'all 0.2s ease-in-out',
                  bgcolor: onDateClick && isCurrentMonth ? 'action.hover' : undefined
                }
              }}
            >
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                {/* Date Header */}
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                  <Typography
                    variant="body2"
                    fontWeight="bold"
                    color={isCurrentMonth ? 'text.primary' : 'text.secondary'}
                    sx={{
                      backgroundColor: isToday(date) ? 'primary.main' : 'transparent',
                      color: isToday(date) ? 'primary.contrastText' : 'inherit',
                      borderRadius: '50%',
                      width: 24,
                      height: 24,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem'
                    }}
                  >
                    {format(date, 'd')}
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    {format(date, 'EEE', { locale: ja })}
                  </Typography>
                </Stack>

                {/* Events */}
                <Box sx={{ minHeight: 60 }}>
                  {loading ? (
                    <Skeleton variant="rectangular" height={12} sx={{ mt: 1 }} />
                  ) : dayEntries.length > 0 ? (
                    <Stack spacing={0.5}>
                      {dayEntries.slice(0, 3).map((item) => {
                        const colorTokens = getScheduleColorTokens(theme, item);
                        const hoverBg = alpha(
                          colorTokens.accent,
                          theme.palette.mode === 'dark' ? 0.28 : 0.14
                        );

                        const primaryLabel = item.personName ?? item.userName ?? item.title ?? '（名称未設定）';

                        const serviceLabel = item.serviceType ?? item.category ?? '';

                        const timeLabel = item.startIso
                          ? new Date(item.startIso).toLocaleTimeString('ja-JP', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '';

                        const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
                          event.stopPropagation();
                          onEventClick?.(item);
                        };

                        return (
                          <Box
                            key={`${item.id}-${item.startIso}`}
                            component="button"
                            type="button"
                            onClick={handleClick}
                            sx={{
                              width: '100%',
                              textAlign: 'left',
                              display: 'flex',
                              alignItems: 'stretch',
                              gap: 0.75,
                              px: 0.75,
                              py: 0.4,
                              borderRadius: 1.5,
                              border: '1px solid',
                              borderColor: colorTokens.border,
                              backgroundColor: colorTokens.bg,
                              cursor: onEventClick ? 'pointer' : 'default',
                              boxShadow: '0 1px 3px rgba(15,23,42,0.08)',
                              transition: 'background-color 120ms ease, box-shadow 150ms ease, transform 120ms ease',
                              '&:hover': onEventClick
                                ? {
                                    backgroundColor: hoverBg,
                                    boxShadow: '0 3px 8px rgba(15,23,42,0.20)',
                                  }
                                : undefined,
                              '&:focus-visible': {
                                outline: `2px solid ${colorTokens.accent}`,
                                outlineOffset: 2,
                              },
                            }}
                          >
                            <Box
                              sx={{
                                width: 3,
                                alignSelf: 'stretch',
                                borderRadius: 999,
                                bgcolor: colorTokens.accent,
                                mt: 0.25,
                                mb: 0.25,
                              }}
                            />

                            <Box
                              sx={{
                                flex: 1,
                                minWidth: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 0.25,
                              }}
                            >
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.5,
                                  minWidth: 0,
                                }}
                              >
                                {timeLabel && (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {timeLabel}
                                  </Typography>
                                )}

                                {serviceLabel && (
                                  <Box
                                    component="span"
                                    sx={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      px: 0.75,
                                      py: 0.1,
                                      borderRadius: 999,
                                      fontSize: '0.7rem',
                                      lineHeight: 1.4,
                                      fontWeight: 600,
                                      backgroundColor: colorTokens.pillBg,
                                      color: colorTokens.pillText,
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      maxWidth: '100%',
                                    }}
                                  >
                                    {serviceLabel}
                                  </Box>
                                )}
                              </Box>

                              <Typography
                                variant="body2"
                                sx={{
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {primaryLabel}
                              </Typography>
                            </Box>
                          </Box>
                        );
                      })}

                      {dayEntries.length > 3 && (
                        <Badge badgeContent={dayEntries.length - 3} color="secondary">
                          <Typography variant="caption" color="text.secondary">
                            他の予定
                          </Typography>
                        </Badge>
                      )}
                    </Stack>
                  ) : (
                    <Typography variant="caption" color="text.disabled" sx={{ mt: 2, display: 'block' }}>
                      予定なし
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Paper>
    </Box>
  );
}
