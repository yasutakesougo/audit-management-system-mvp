/**
 * B層: ISP比較エディタ ステートフック
 * 状態管理・ロジック・イベントハンドラを集約
 */
import { useSP } from '@/lib/spClient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DiffSegment, GoalItem, ISPPlan } from '../data/ispRepo';
import {
    DOMAINS,
    MOCK_PREVIOUS,
    STATUS_STEPS,
    computeDiff,
    createEmptyCurrentPlan,
    fetchISPPlans,
    parseYmdLocal,
    upsertGoal,
} from '../data/ispRepo';

export interface DomainCoverage {
  id: string;
  label: string;
  color: string;
  bg: string;
  covered: boolean;
}

export interface ProgressInfo {
  steps: Array<{ key: string; label: string; done: boolean }>;
  pct: number;
}

export interface UseISPComparisonEditorOptions {
  userId?: string;
}

export function useISPComparisonEditor(options: UseISPComparisonEditorOptions = {}) {
  const { userId } = options;
  const sp = useSP();

  /* ── データフェッチ状態 ── */
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [previousPlan, setPreviousPlan] = useState<ISPPlan>(MOCK_PREVIOUS);

  const [currentPlan, setCurrentPlan] = useState(createEmptyCurrentPlan);

  /* ── SharePoint データ取得 ── */
  useEffect(() => {
    if (!userId || !sp?.listItems) {
      setLoading(false);
      return;
    }

    const abortController = new AbortController();
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchISPPlans(sp, userId, abortController.signal);

        if (cancelled) return;

        // SP からデータが取得できた場合はそれを使用、
        // おもけモード（空配列返却）の場合はモックにフォールバック
        if (result.previous) {
          setPreviousPlan(result.previous);
        }
        if (result.current) {
          setCurrentPlan(result.current);
        }
      } catch (e) {
        if (!cancelled) {
          console.warn('[ISP Editor] SP fetch failed, using mock data:', e);
          setError(e as Error);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [userId, sp]);
  const [showDiff, setShowDiff] = useState(true);
  const [showSmart, setShowSmart] = useState(false);
  const [activeGoalId, setActiveGoalId] = useState('g1');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  /* ── 改善3: setTimeout クリーンアップ ── */
  const resetTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    };
  }, []);

  /* ── 改善1: JST日付ズレ対策 ── */
  const daysRemaining = useMemo(() => {
    const expiry = parseYmdLocal(currentPlan.certExpiry);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }, [currentPlan.certExpiry]);

  /* ── Progress ── */
  const progress: ProgressInfo = useMemo(() => {
    const goals = currentPlan.goals;
    const filled = goals.filter((g) => g.text.trim().length > 0).length;
    const domainsCovered = new Set(goals.flatMap((g) => g.domains));
    const allDomainsCovered = DOMAINS.every((d) => domainsCovered.has(d.id));
    const hasLong = goals.some((g) => g.type === 'long' && g.text.trim());
    const hasShort = goals.some((g) => g.type === 'short' && g.text.trim());
    const hasSupport = goals.some((g) => g.type === 'support' && g.text.trim());
    return {
      steps: [
        { ...STATUS_STEPS[0], done: true },
        { ...STATUS_STEPS[1], done: hasLong && hasShort },
        { ...STATUS_STEPS[2], done: hasSupport },
        { ...STATUS_STEPS[3], done: allDomainsCovered },
        { ...STATUS_STEPS[4], done: filled === goals.length && allDomainsCovered },
      ],
      pct: Math.round((filled / goals.length) * 100),
    };
  }, [currentPlan.goals]);

  /* ── 改善2: activeゴールとprevを個別memo化 ── */
  const activeGoal: GoalItem | undefined = useMemo(
    () => currentPlan.goals.find((g) => g.id === activeGoalId),
    [currentPlan.goals, activeGoalId],
  );

  const prevGoal: GoalItem | undefined = useMemo(
    () => previousPlan.goals.find((p) => p.id === activeGoalId),
    [activeGoalId, previousPlan.goals],
  );

  /** 差分計算 — showDiff ON かつテキストがある場合のみ */
  const diff: DiffSegment[] | null = useMemo(() => {
    if (!showDiff || !prevGoal || !activeGoal?.text) return null;
    return computeDiff(prevGoal.text ?? '', activeGoal.text);
  }, [showDiff, prevGoal, activeGoal?.text]);

  /* ── 改善3: コピー + cleanupTimer ── */
  const copyFromPrevious = useCallback(
    (goalId: string) => {
      const prev = previousPlan.goals.find((g) => g.id === goalId);
      if (!prev) return;
      setCurrentPlan((p) => ({
        ...p,
        goals: p.goals.map((g) =>
          g.id === goalId ? { ...g, text: prev.text, domains: [...prev.domains] } : g,
        ),
      }));
      setCopiedId(goalId);
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = window.setTimeout(() => setCopiedId(null), 1500);
    },
    [previousPlan.goals],
  );

  const updateGoalText = useCallback((goalId: string, text: string) => {
    setCurrentPlan((p) => ({
      ...p,
      goals: p.goals.map((g) => (g.id === goalId ? { ...g, text } : g)),
    }));
  }, []);

  const toggleDomain = useCallback((goalId: string, domainId: string) => {
    setCurrentPlan((p) => ({
      ...p,
      goals: p.goals.map((g) => {
        if (g.id !== goalId) return g;
        const has = g.domains.includes(domainId);
        return {
          ...g,
          domains: has ? g.domains.filter((d) => d !== domainId) : [...g.domains, domainId],
        };
      }),
    }));
  }, []);

  const domainCoverage: DomainCoverage[] = useMemo(() => {
    const covered = new Set(currentPlan.goals.flatMap((g) => g.domains));
    return DOMAINS.map((d) => ({ ...d, covered: covered.has(d.id) }));
  }, [currentPlan.goals]);

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const toggleDiff = useCallback(() => setShowDiff((v) => !v), []);
  const toggleSmart = useCallback(() => setShowSmart((v) => !v), []);

  /* ── 保存 ── */
  const savePlan = useCallback(async () => {
    if (!userId || !sp?.spFetch) return;
    setSaving(true);
    try {
      const meta = {
        planPeriod: currentPlan.planPeriod,
        planStatus: currentPlan.status,
        certExpiry: currentPlan.certExpiry,
      };
      await Promise.all(
        currentPlan.goals.map((goal) => upsertGoal(sp, goal, userId, meta)),
      );
    } catch (e) {
      console.error('[ISP Editor] Save failed:', e);
      setError(e as Error);
    } finally {
      setSaving(false);
    }
  }, [userId, sp, currentPlan]);

  return {
    // state
    currentPlan,
    showDiff,
    showSmart,
    activeGoalId,
    copiedId,
    sidebarOpen,
    loading,
    error,
    saving,
    // derived
    daysRemaining,
    progress,
    activeGoal,
    prevGoal,
    diff,
    domainCoverage,
    previousPlan,
    // actions
    setActiveGoalId,
    copyFromPrevious,
    updateGoalText,
    toggleDomain,
    toggleSidebar,
    toggleDiff,
    toggleSmart,
    savePlan,
  };
}
