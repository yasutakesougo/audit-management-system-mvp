import { useAnnounce } from '@/a11y/LiveAnnouncer';
import { useRouteFocusManager } from '@/a11y/useRouteFocusManager';
import { getComposedWeek, isScheduleFixturesMode, type ScheduleEvent } from '@/features/schedule/api/schedulesClient';
import { FOCUS_GUARD_MS } from '@/features/schedule/focusGuard';
import { shouldSkipLogin } from '@/lib/env';
import { ensureMsalSignedIn, getSharePointScopes } from '@/lib/msal';
import { TESTIDS } from '@/testids';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
// Icons for navigation tabs
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import TodayRoundedIcon from '@mui/icons-material/TodayRounded';
// Additional MUI components
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';

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

const WEEK_PARAM_FORMAT = 'YYYY-MM-DD';
const WEEK_KEY_THROTTLE_MS = 180;
const URL_WRITE_GUARD_MS = 30_000;

function formatWeekParam(anchor: dayjs.Dayjs) {
  return anchor.format(WEEK_PARAM_FORMAT);
}

function parseWeekParam(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = dayjs(value, WEEK_PARAM_FORMAT, true);
  if (!parsed.isValid()) {
    return null;
  }
  return startOfWeek(parsed);
}

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) {
    return false;
  }
  if (element.isContentEditable) {
    return true;
  }
  const tag = element.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    return true;
  }
  return element.getAttribute('role') === 'textbox';
}

type FocusDbg = {
  events: string[];
  attempts: string[];
  active: string | null;
};

function ensureFocusDbg(): FocusDbg | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const scope = window as typeof window & { __focusDbg__?: FocusDbg };
  if (!scope.__focusDbg__) {
    scope.__focusDbg__ = { events: [], attempts: [], active: null };
  }
  return scope.__focusDbg__ ?? null;
}

function recordFocusEvent(message: string): void {
  const dbg = ensureFocusDbg();
  if (!dbg) {
    return;
  }
  dbg.events = [...dbg.events, message].slice(-200);
}

function recordFocusAttempt(message: string): void {
  const dbg = ensureFocusDbg();
  if (!dbg) {
    return;
  }
  dbg.attempts = [...dbg.attempts, message].slice(-200);
}

function setFocusActive(descriptor: string | null): void {
  const dbg = ensureFocusDbg();
  if (!dbg) {
    return;
  }
  dbg.active = descriptor;
}

// Persist the last announced week across component remounts triggered by query param updates.
let lastAnnouncedLabel: string | null = null;
export default function SchedulesWeekPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState(() => {
    const initial = parseWeekParam(searchParams.get('week'));
    return initial ?? startOfWeek();
  });
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [status, setStatus] = useState<Status>('idle');

  const announce = useAnnounce();
  const lastWeekKeyAtRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const prevButtonRef = useRef<HTMLButtonElement | null>(null);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastWeekParamRef = useRef<string | null>(null);
  const prevLabelRef = useRef<string | null>(null);
  const lastNavDirRef = useRef<-1 | 0 | 1>(0);
  const pendingFocusDirRef = useRef<-1 | 0 | 1>(0);
  const pendingFocusBootstrapRef = useRef(false);
  const focusGuardUntilRef = useRef<number>(0);
  const urlAdoptLockAtRef = useRef<number>(0);
  const URL_ADOPT_LOCK_MS = 5_000;
  const lastIntentWeekRef = useRef<string>(formatWeekParam(anchor));
  const urlWriteGuardRef = useRef<{ until: number; intended: string } | null>(null);
  const skipAnchorSyncRef = useRef(true);
  const allowExternalWeekRef = useRef(false);
  const hasInitialSyncRef = useRef(false);
  const NEXT_BUTTON_TEST_ID = TESTIDS['schedules-next'];
  const PREV_BUTTON_TEST_ID = TESTIDS['schedules-prev'];

  const getButtonByTestId = useCallback(
    (testId: string | null) => {
      if (testId === NEXT_BUTTON_TEST_ID) {
        return nextButtonRef.current;
      }
      if (testId === PREV_BUTTON_TEST_ID) {
        return prevButtonRef.current;
      }
      return null;
    },
    [NEXT_BUTTON_TEST_ID, PREV_BUTTON_TEST_ID],
  );

  const queueButtonRefocus = useCallback(
    (testId: string | null, origin: string, fallback?: HTMLButtonElement | null) => {
      if (typeof window === 'undefined') {
        return;
      }
      const direction: -1 | 0 | 1 = testId === NEXT_BUTTON_TEST_ID ? 1 : testId === PREV_BUTTON_TEST_ID ? -1 : 0;
      if (direction !== 0) {
        pendingFocusDirRef.current = direction;
        lastNavDirRef.current = direction;
        const dirScope = window as typeof window & { __pendingWeekFocus__?: -1 | 0 | 1 };
        dirScope.__pendingWeekFocus__ = direction;
      }
      const describe = (node: HTMLElement | null | undefined) =>
        node?.getAttribute('data-testid') ?? node?.id ?? node?.tagName ?? (node === null ? 'null' : 'unknown');

      const log = (label: string, attempt: number, target: HTMLElement | null, extra?: string) => {
        const descriptor = describe(target ?? null);
        const message = `${label}:${origin}:${attempt}:${descriptor}${extra ? `:${extra}` : ''}`;
        recordFocusEvent(message);
        recordFocusAttempt(message);
      };

      const schedule = (delay: number, attempt: number) => {
        window.setTimeout(() => {
          if (Date.now() > focusGuardUntilRef.current) {
            log('guard-expired', attempt, null);
            return;
          }
          const preferred = getButtonByTestId(testId);
          const queried =
            typeof document !== 'undefined' && testId
              ? (document.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement | null)
              : null;
          const candidateFallback = fallback && fallback.isConnected ? fallback : null;
          const target = preferred ?? queried ?? nextButtonRef.current ?? prevButtonRef.current ?? candidateFallback;
          if (!target || !target.isConnected || target.disabled) {
            const extra = `preferred=${describe(preferred ?? null)}|queried=${describe(queried)}|next=${describe(nextButtonRef.current)}|prev=${describe(prevButtonRef.current)}|fallback=${describe(candidateFallback)}`;
            log('unavailable', attempt, target ?? null, extra);
            return;
          }
          target.focus({ preventScroll: true });
          const active = describe(document.activeElement as HTMLElement | null);
          log('focus', attempt, target, `active=${active}`);
          setFocusActive(active);
        }, delay);
      };

      const delays = [0, 35, 80, 160, 320, 650, 1300, 2600, 5200];
      delays.forEach((delay, index) => schedule(delay, index));
    },
    [getButtonByTestId],
  );

  if (!pendingFocusBootstrapRef.current && typeof window !== 'undefined') {
    const scope = window as typeof window & { __pendingWeekFocus__?: -1 | 0 | 1 };
    const pendingDir = scope.__pendingWeekFocus__ ?? 0;
    if (pendingDir !== 0) {
      pendingFocusDirRef.current = pendingDir;
      lastNavDirRef.current = pendingDir;
      scope.__pendingWeekFocus__ = 0;
    }
    pendingFocusBootstrapRef.current = true;
  }
  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const handlePopState = () => {
      allowExternalWeekRef.current = true;
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }
    const handler = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      const descriptor = target?.getAttribute('data-testid') ?? target?.id ?? target?.tagName ?? 'unknown';
      const stamp = typeof performance !== 'undefined' ? performance.now().toFixed(1) : Date.now().toString();
      recordFocusEvent(`focusin:${stamp}:${descriptor}`);
    };
    document.addEventListener('focusin', handler);
    return () => {
      document.removeEventListener('focusin', handler);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }
    const handleFocusOut = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      const next = event.relatedTarget as HTMLElement | null;
      const stamp = typeof performance !== 'undefined' ? performance.now().toFixed(1) : Date.now().toString();
      const currentId = target?.getAttribute('data-testid') ?? target?.id ?? target?.tagName ?? 'unknown';
      const nextId = next?.getAttribute('data-testid') ?? next?.id ?? next?.tagName ?? 'null';
      recordFocusEvent(`focusout:${stamp}:${currentId}->${nextId}`);
    };
    document.addEventListener('focusout', handleFocusOut, true);
    const handleWindowBlur = () => {
      const stamp = typeof performance !== 'undefined' ? performance.now().toFixed(1) : Date.now().toString();
      recordFocusEvent(`window-blur:${stamp}`);
    };
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      document.removeEventListener('focusout', handleFocusOut, true);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined' || typeof performance === 'undefined') {
      return undefined;
    }
    const baseline = performance.now();
    const interval = window.setInterval(() => {
      const active = document.activeElement as HTMLElement | null;
      const descriptor = active?.getAttribute('data-testid') ?? active?.id ?? active?.tagName ?? 'unknown';
      const stamp = (performance.now() - baseline).toFixed(1);
      const hasWindowFocus = typeof document.hasFocus === 'function' ? (document.hasFocus() ? '1' : '0') : 'u';
      recordFocusEvent(`timeline:${stamp}:${descriptor}:${hasWindowFocus}`);
    }, 100);
    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const range = useMemo<WeekRange>(() => {
    const from = startOfWeek(anchor);
    const to = endOfWeek(anchor);
    return {
      fromISO: from.toDate().toISOString(),
      toISO: to.toDate().toISOString(),
      label: `${from.format('YYYY/MM/DD')} – ${to.format('YYYY/MM/DD')}`,
    };
  }, [anchor]);

  useRouteFocusManager({
    fallbackTestId: TESTIDS['schedules-next'],
    announce,
    getHeadingMessage: () => `週間スケジュール（${range.label}）に移動`,
  });

  useEffect(() => {
    const rawWeekParam = searchParams.get('week');
    const currentWeekParam = formatWeekParam(anchor);
    const matchesIntent = rawWeekParam === lastIntentWeekRef.current;
    if (rawWeekParam === lastWeekParamRef.current || rawWeekParam === currentWeekParam) {
      hasInitialSyncRef.current = true;
      if (rawWeekParam ?? currentWeekParam) {
        lastWeekParamRef.current = rawWeekParam ?? currentWeekParam;
      }
      return;
    }

    if (Date.now() - urlAdoptLockAtRef.current < URL_ADOPT_LOCK_MS) {
      if (typeof window !== 'undefined') {
        const scope = window as typeof window & { __anchorParamIgnored__?: string[]; __anchorDebug__?: string[] };
        scope.__anchorParamIgnored__ = [...(scope.__anchorParamIgnored__ ?? []), rawWeekParam ?? ''];
        scope.__anchorDebug__ = [
          ...(scope.__anchorDebug__ ?? []),
          `ignore(raw:${rawWeekParam ?? 'null'}|current:${currentWeekParam}|lock:${Date.now() - urlAdoptLockAtRef.current}ms)`,
        ];
      }
      return;
    }

    const guard = urlWriteGuardRef.current;
    const allowExternal = allowExternalWeekRef.current;
    const guardActive = guard && Date.now() < guard.until;
    const shouldAdopt = !hasInitialSyncRef.current || allowExternal || matchesIntent;

    if (!shouldAdopt && rawWeekParam && rawWeekParam !== currentWeekParam) {
      if (typeof window !== 'undefined') {
        const scope = window as typeof window & { __anchorParamIgnored__?: string[] };
        scope.__anchorParamIgnored__ = [...(scope.__anchorParamIgnored__ ?? []), rawWeekParam, `(kept:${currentWeekParam})`];
      }
      if (!hasInitialSyncRef.current) {
        hasInitialSyncRef.current = true;
        lastWeekParamRef.current = currentWeekParam;
        return;
      }
      const fallbackParams = new URLSearchParams(searchParams);
      fallbackParams.set('week', currentWeekParam);
      urlWriteGuardRef.current = { until: Date.now() + URL_WRITE_GUARD_MS, intended: currentWeekParam };
      setSearchParams(fallbackParams, { replace: true });
      lastWeekParamRef.current = currentWeekParam;
      return;
    }

    if (allowExternalWeekRef.current) {
      allowExternalWeekRef.current = false;
      urlWriteGuardRef.current = null;
    }

    if (!rawWeekParam) {
      hasInitialSyncRef.current = true;
      if (currentWeekParam) {
        const fallbackParams = new URLSearchParams(searchParams);
        fallbackParams.set('week', currentWeekParam);
        urlWriteGuardRef.current = { until: Date.now() + URL_WRITE_GUARD_MS, intended: currentWeekParam };
        setSearchParams(fallbackParams, { replace: true });
        lastWeekParamRef.current = currentWeekParam;
      }
      return;
    }

    if (!allowExternal && guardActive && rawWeekParam !== guard?.intended) {
      if (typeof window !== 'undefined') {
        const scope = window as typeof window & { __anchorParamIgnored__?: string[] };
        scope.__anchorParamIgnored__ = [...(scope.__anchorParamIgnored__ ?? []), rawWeekParam, '(guard)'];
      }
      const fallbackParams = new URLSearchParams(searchParams);
      fallbackParams.set('week', currentWeekParam);
      urlWriteGuardRef.current = { until: Date.now() + URL_WRITE_GUARD_MS, intended: currentWeekParam };
      setSearchParams(fallbackParams, { replace: true });
      lastWeekParamRef.current = currentWeekParam;
      return;
    }

    hasInitialSyncRef.current = true;
    lastWeekParamRef.current = rawWeekParam;
    const parsed = parseWeekParam(rawWeekParam);
    if (!parsed) {
      return;
    }

    if (typeof window !== 'undefined') {
      const scope = window as typeof window & { __anchorFromParams__?: string[] };
      scope.__anchorFromParams__ = [...(scope.__anchorFromParams__ ?? []), parsed.format('YYYY-MM-DD')];
    }

    setAnchor((current) => {
      const next = current.isSame(parsed, 'day') ? current : parsed;
      if (typeof window !== 'undefined') {
        const scope = window as typeof window & { __anchorParamSet__?: string[] };
        scope.__anchorParamSet__ = [...(scope.__anchorParamSet__ ?? []), next.format('YYYY-MM-DD')];
      }
      lastIntentWeekRef.current = formatWeekParam(next);
      return next;
    });
  }, [searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        setStatus('loading');
        const skipAuth = isScheduleFixturesMode() || shouldSkipLogin();
        if (!skipAuth) {
          const scopes = getSharePointScopes();
          await ensureMsalSignedIn(scopes);
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
      }
    })();

    return () => {
      controller.abort();
    };
  }, [range.fromISO, range.toISO]);

  useEffect(() => {
    if (prevLabelRef.current === null) {
      prevLabelRef.current = range.label;
      lastAnnouncedLabel = range.label;
      lastNavDirRef.current = 0;
      return;
    }

    if (prevLabelRef.current !== range.label) {
      prevLabelRef.current = range.label;
      if (lastAnnouncedLabel !== range.label) {
        announce(`週間スケジュール（${range.label}）に移動`);
        lastAnnouncedLabel = range.label;
      }
    }
  }, [announce, range.label]);

  useEffect(() => {
    const direction = pendingFocusDirRef.current;
    if (direction === 0) {
      return;
    }

    if (status === 'loading') {
      return;
    }

    const timers: number[] = [];

    const resolveTarget = () =>
      direction > 0 ? nextButtonRef.current : direction < 0 ? prevButtonRef.current : null;

    const attemptFocus = () => {
      const liveTarget = resolveTarget();
      if (!liveTarget || liveTarget.disabled || !liveTarget.isConnected) {
        return false;
      }
      liveTarget.focus({ preventScroll: true });
      const active = document.activeElement as HTMLElement | null;
      const descriptor = active?.getAttribute('data-testid') ?? active?.id ?? active?.tagName ?? 'unknown';
      const targetId = liveTarget.getAttribute('data-testid') ?? 'unknown';
      recordFocusAttempt(`${Date.now()}:${targetId}:${descriptor}`);
      setFocusActive(targetId);
      return true;
    };

    const reinforceFocus = (delay: number) => {
      if (typeof window === 'undefined') {
        return;
      }
      const handle = window.setTimeout(() => {
        const liveTarget = resolveTarget();
        if (!liveTarget || liveTarget.disabled || !liveTarget.isConnected) {
          reinforceFocus(150);
          return;
        }
        const active = document.activeElement as HTMLElement | null;
        if (active !== liveTarget) {
          attemptFocus();
        }
      }, delay);
      timers.push(handle);
    };

    const scheduleDefaultReinforcement = () => {
      reinforceFocus(200);
      reinforceFocus(600);
      reinforceFocus(1200);
      reinforceFocus(2000);
      reinforceFocus(3200);
      reinforceFocus(5000);
      reinforceFocus(8000);
    };

    if (typeof document !== 'undefined' && typeof window !== 'undefined') {
      const gridReady = Boolean(
        document.querySelector(`[data-testid="${TESTIDS['schedules-week-grid']}"]`) ??
          document.querySelector(`[data-testid="${TESTIDS['schedules-empty']}"]`),
      );
      if (gridReady && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            if (Date.now() <= focusGuardUntilRef.current) {
              recordFocusEvent('raf-focus:attempt');
              attemptFocus();
            }
          });
        });
      }
    }

    const initialSuccess = attemptFocus();
    if (!initialSuccess) {
      reinforceFocus(50);
      reinforceFocus(150);
      reinforceFocus(300);
      scheduleDefaultReinforcement();
    } else {
      scheduleDefaultReinforcement();
    }

    if (typeof window !== 'undefined') {
      const handle = window.setInterval(() => {
        const liveTarget = resolveTarget();
        if (!liveTarget || liveTarget.disabled || !liveTarget.isConnected) {
          return;
        }
        if (Date.now() > focusGuardUntilRef.current) {
          window.clearInterval(handle);
          pendingFocusDirRef.current = 0;
          lastNavDirRef.current = 0;
          return;
        }
        const active = document.activeElement as HTMLElement | null;
        if (active !== liveTarget) {
          attemptFocus();
        }
      }, 250);
      timers.push(handle);
    }

    return () => {
      if (typeof window !== 'undefined') {
        timers.forEach((handle) => window.clearTimeout(handle));
      }
    };
  }, [range.fromISO, range.toISO, status]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as typeof window & { __anchorLabel__?: string }).__anchorLabel__ = range.label;
    }
  }, [range.label]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as typeof window & { __anchorState__?: string }).__anchorState__ = anchor.format('YYYY-MM-DD');
    }
  }, [anchor]);

  useEffect(
    () => () => {
      lastWeekKeyAtRef.current = 0;
      lastNavDirRef.current = 0;
      pendingFocusDirRef.current = 0;
    },
    [],
  );

  useEffect(() => {
    const nextWeekParam = formatWeekParam(anchor);
    if (skipAnchorSyncRef.current) {
      skipAnchorSyncRef.current = false;
      if (searchParams.get('week') === nextWeekParam) {
        lastWeekParamRef.current = nextWeekParam;
      }
      return;
    }
    if (searchParams.get('week') === nextWeekParam) {
      lastWeekParamRef.current = nextWeekParam;
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('week', nextWeekParam);
    urlAdoptLockAtRef.current = Date.now();
    lastIntentWeekRef.current = nextWeekParam;
    urlWriteGuardRef.current = { until: Date.now() + URL_WRITE_GUARD_MS, intended: nextWeekParam };
    setSearchParams(nextParams, { replace: true });

    if (typeof window !== 'undefined') {
      const scope = window as typeof window & { __anchorParamSetLog__?: string[] };
      scope.__anchorParamSetLog__ = [...(scope.__anchorParamSetLog__ ?? []), nextWeekParam];
    }
  }, [anchor, searchParams, setSearchParams]);

  const navigateWeek = useCallback(
    (direction: -1 | 1) => {
      lastWeekKeyAtRef.current = Date.now();
      lastNavDirRef.current = direction;
      urlAdoptLockAtRef.current = Date.now();
      pendingFocusDirRef.current = direction;
  focusGuardUntilRef.current = Date.now() + FOCUS_GUARD_MS;
      if (typeof window !== 'undefined') {
        const scope = window as typeof window & {
          __pendingWeekFocus__?: -1 | 0 | 1;
          __skipRouteHeadingFocus__?: boolean;
          __suppressRouteReset__?: boolean;
        };
        scope.__pendingWeekFocus__ = direction;
        scope.__skipRouteHeadingFocus__ = true;
        scope.__suppressRouteReset__ = true;
      }
      const immediateTarget = direction > 0 ? nextButtonRef.current : direction < 0 ? prevButtonRef.current : null;
      if (immediateTarget && !immediateTarget.disabled) {
        immediateTarget.focus({ preventScroll: true });
        if (typeof document !== 'undefined' && typeof window !== 'undefined') {
          const scope = window as typeof window & { __focusImmediate__?: string | null };
          scope.__focusImmediate__ = document.activeElement?.getAttribute?.('data-testid') ?? null;
        }
      }

      setAnchor((current) => {
        const next = current.add(direction, 'week');
        urlWriteGuardRef.current = { until: Date.now() + URL_WRITE_GUARD_MS, intended: next.format(WEEK_PARAM_FORMAT) };
        lastIntentWeekRef.current = next.format(WEEK_PARAM_FORMAT);
        if (typeof window !== 'undefined') {
          const from = startOfWeek(next);
          const to = endOfWeek(next);
          const label = `${from.format('YYYY/MM/DD')} – ${to.format('YYYY/MM/DD')}`;
          (window as typeof window & { __anchorLabel__?: string }).__anchorLabel__ = label;
        }
        if (typeof window !== 'undefined') {
          const scope = window as typeof window & { __anchorLog__?: string[]; __navCount__?: number };
          scope.__anchorLog__ = [
            ...(scope.__anchorLog__ ?? []),
            `${current.format('YYYY-MM-DD')}->${next.format('YYYY-MM-DD')} (same:${current === next})`,
          ];
          scope.__navCount__ = (scope.__navCount__ ?? 0) + 1;
        }
        return next;
      });
    },
    [],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      if (typeof window !== 'undefined') {
        const scope = window as typeof window & { __weekKeydown__?: number };
        scope.__weekKeydown__ = (scope.__weekKeydown__ ?? 0) + 1;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        event.stopPropagation();

        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        const now = Date.now();
        if (now - lastWeekKeyAtRef.current < WEEK_KEY_THROTTLE_MS) {
          return;
        }
        lastWeekKeyAtRef.current = now;
        navigateWeek(direction);
      }
    },
    [navigateWeek],
  );

  const goPrev = useCallback(() => {
    navigateWeek(-1);
  }, [navigateWeek]);

  const goNext = useCallback(() => {
    navigateWeek(1);
  }, [navigateWeek]);

  const handleButtonBlur = useCallback(
    (event: React.FocusEvent<HTMLButtonElement>) => {
      const now = Date.now();
      const testId = event.currentTarget.getAttribute('data-testid');
      const active =
        document.activeElement?.getAttribute?.('data-testid') ??
        document.activeElement?.tagName ??
        'unknown';
      recordFocusEvent(
        `react-blur:${now}:${testId}:guard${now <= focusGuardUntilRef.current}:related:${Boolean(event.relatedTarget)}:active:${active}`,
      );
      if (now > focusGuardUntilRef.current) {
        return;
      }
      if (event.relatedTarget) {
        return;
      }
      queueButtonRefocus(testId, 'react-blur', event.currentTarget);
    },
    [queueButtonRefocus],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const next = nextButtonRef.current;
    const prev = prevButtonRef.current;
    if (!next && !prev) {
      return undefined;
    }
    const nativeHandler = (event: FocusEvent) => {
      const now = Date.now();
      if (now > focusGuardUntilRef.current) {
        return;
      }
      if (event.relatedTarget) {
        return;
      }
      const target = event.currentTarget as HTMLButtonElement;
      const testId = target.getAttribute('data-testid');
      recordFocusEvent(`native-blur:${now}:${testId}`);
      queueButtonRefocus(testId, 'native-blur', target);
    };
    next?.addEventListener('blur', nativeHandler);
    prev?.addEventListener('blur', nativeHandler);
    return () => {
      next?.removeEventListener('blur', nativeHandler);
      prev?.removeEventListener('blur', nativeHandler);
    };
  }, [range.fromISO, range.toISO, status]);

  return (
    <Container
      data-testid={TESTIDS['schedules-week-page']}
      tabIndex={0}
      aria-label="週間スケジュールページ"
      onKeyDown={handleKeyDown}
      ref={containerRef}
    >
      <Typography
        variant="h5"
        component="h1"
        data-testid="schedules-week-heading"
        data-page-heading="true"
        id="schedules-week-heading"
      >
        週間スケジュール（{range.label}）
      </Typography>

      {/* Navigation Tabs and Actions */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', my: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Tabs value="week" aria-label="スケジュールビュー切り替え">
            <Tab
              label="週間"
              value="week"
              icon={<Box component="span">📅</Box>}
              iconPosition="start"
              sx={{ textTransform: 'none' }}
            />
            <Tab
              label="月間"
              value="month"
              icon={<CalendarMonthRoundedIcon />}
              iconPosition="start"
              sx={{ textTransform: 'none' }}
              onClick={() => navigate('/schedules/month')}
            />
            <Tab
              label="日間"
              value="day"
              icon={<TodayRoundedIcon />}
              iconPosition="start"
              sx={{ textTransform: 'none' }}
              onClick={() => navigate('/schedules/day')}
            />
          </Tabs>

          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => navigate('/schedules/create')}
            sx={{ ml: 2 }}
          >
            新規作成
          </Button>
        </Stack>
      </Box>

      <Stack direction="row" spacing={1} sx={{ my: 1 }}>
        <Button
          ref={prevButtonRef}
          data-testid={TESTIDS['schedules-prev']}
          onClick={goPrev}
          onBlur={handleButtonBlur}
          variant="outlined"
          aria-label="前の週へ"
        >
          前の週
        </Button>
        <Button
          ref={nextButtonRef}
          data-testid={TESTIDS['schedules-next']}
          onClick={goNext}
          onBlur={handleButtonBlur}
          variant="outlined"
          aria-label="次の週へ"
        >
          次の週
        </Button>
      </Stack>

      <Box component="section" role="region" aria-labelledby="schedules-week-heading" sx={{ mt: 2 }}>
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
      </Box>
    </Container>
  );
}
