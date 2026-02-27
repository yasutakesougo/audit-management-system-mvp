/**
 * B層: ISP比較エディタ ステートフック
 * 状態管理・ロジック・イベントハンドラを集約
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { GoalItem, DiffSegment } from '../data/ispRepo';
import {
  DOMAINS,
  STATUS_STEPS,
  MOCK_PREVIOUS,
  createEmptyCurrentPlan,
  parseYmdLocal,
  computeDiff,
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

export function useISPComparisonEditor() {
  const [currentPlan, setCurrentPlan] = useState(createEmptyCurrentPlan);
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
    () => MOCK_PREVIOUS.goals.find((p) => p.id === activeGoalId),
    [activeGoalId],
  );

  /** 差分計算 — showDiff ON かつテキストがある場合のみ */
  const diff: DiffSegment[] | null = useMemo(() => {
    if (!showDiff || !prevGoal || !activeGoal?.text) return null;
    return computeDiff(prevGoal.text ?? '', activeGoal.text);
  }, [showDiff, prevGoal, activeGoal?.text]);

  /* ── 改善3: コピー + cleanupTimer ── */
  const copyFromPrevious = useCallback(
    (goalId: string) => {
      const prev = MOCK_PREVIOUS.goals.find((g) => g.id === goalId);
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
    [],
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

  return {
    // state
    currentPlan,
    showDiff,
    showSmart,
    activeGoalId,
    copiedId,
    sidebarOpen,
    // derived
    daysRemaining,
    progress,
    activeGoal,
    prevGoal,
    diff,
    domainCoverage,
    previousPlan: MOCK_PREVIOUS,
    // actions
    setActiveGoalId,
    copyFromPrevious,
    updateGoalText,
    toggleDomain,
    toggleSidebar,
    toggleDiff,
    toggleSmart,
  };
}
