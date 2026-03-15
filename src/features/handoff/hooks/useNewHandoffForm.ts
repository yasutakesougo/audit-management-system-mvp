/**
 * useNewHandoffForm — CompactNewHandoffInput のフォーム状態管理 Hook
 *
 * Phase 2 (B-2): コンポーネントから状態管理を分離。
 * テスト容易性と再利用性を向上。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { IUserMaster } from '@/sharepoint/fields';
import type { HandoffCategory, HandoffSeverity } from '../handoffTypes';
import { getTimeBandPlaceholder, useCurrentTimeBand } from '../useCurrentTimeBand';
import { useHandoffTimeline } from '../useHandoffTimeline';

// ────────────────────────────────────────────────────────────

/** 送信成功フィードバック表示時間 (ms) */
const SUCCESS_DISPLAY_MS = 2500;

export type TargetOption = 'ALL' | IUserMaster;
export type FeedbackType = 'success' | 'error' | null;

// ────────────────────────────────────────────────────────────

export type UseNewHandoffFormReturn = {
  // Form state
  target: TargetOption;
  setTarget: (v: TargetOption) => void;
  category: HandoffCategory;
  setCategory: (v: HandoffCategory) => void;
  severity: HandoffSeverity;
  setSeverity: (v: HandoffSeverity) => void;
  message: string;
  setMessage: (v: string) => void;
  submitting: boolean;
  expanded: boolean;
  setExpanded: (v: boolean | ((prev: boolean) => boolean)) => void;

  // Feedback
  feedback: FeedbackType;
  clearFeedback: () => void;

  // Derived
  timeBand: string;
  placeholder: string;
  canSend: boolean;

  // Actions
  handleSubmit: () => Promise<void>;
  handleKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  handleFocus: () => void;
};

export function useNewHandoffForm(
  onSuccess?: () => void,
): UseNewHandoffFormReturn {
  const timeBand = useCurrentTimeBand();
  const { createHandoff } = useHandoffTimeline();

  // ── Form state ──
  const [target, setTarget] = useState<TargetOption>('ALL');
  const [category, setCategory] = useState<HandoffCategory>('体調');
  const [severity, setSeverity] = useState<HandoffSeverity>('通常');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // ── Feedback state ──
  const [feedback, setFeedback] = useState<FeedbackType>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const showFeedback = useCallback((type: 'success' | 'error') => {
    setFeedback(type);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setFeedback(null), SUCCESS_DISPLAY_MS);
  }, []);

  const clearFeedback = useCallback(() => setFeedback(null), []);

  const placeholder = useMemo(() => getTimeBandPlaceholder(timeBand), [timeBand]);

  // ── Handlers ──

  const handleSubmit = useCallback(async () => {
    const text = message.trim();
    if (!text || submitting) return;

    setSubmitting(true);
    setFeedback(null);
    try {
      const userCode = target === 'ALL' ? 'ALL' : target.UserID.toString();
      const userDisplayName = target === 'ALL' ? '全体' : target.FullName;

      await createHandoff({
        userCode,
        userDisplayName,
        category,
        severity,
        timeBand,
        message: text,
        title: `${userDisplayName} / ${category}`,
      });

      setMessage('');
      showFeedback('success');
      onSuccess?.();
    } catch {
      showFeedback('error');
    } finally {
      setSubmitting(false);
    }
  }, [message, submitting, target, category, severity, timeBand, createHandoff, showFeedback, onSuccess]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const canSend = message.trim().length > 0 && !submitting;

  const handleFocus = useCallback(() => {
    if (!expanded) setExpanded(true);
  }, [expanded]);

  return {
    target,
    setTarget,
    category,
    setCategory,
    severity,
    setSeverity,
    message,
    setMessage,
    submitting,
    expanded,
    setExpanded,
    feedback,
    clearFeedback,
    timeBand,
    placeholder,
    canSend,
    handleSubmit,
    handleKeyDown,
    handleFocus,
  };
}
