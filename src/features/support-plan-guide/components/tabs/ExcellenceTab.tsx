/**
 * ExcellenceTab — 改善メモ・連携タブ
 *
 * SectionKey: 'excellence'
 *
 * Issue #10 Phase 2: ISPCandidateImportSection を組み込み、
 * 行動パターンから生成された ISP 候補を improvementIdeas に取り込む。
 * Issue #11: AdoptionMetricsPanel で提案採用状況を表示。
 *
 * P3-C: SuggestionMemoSection を追加し、
 * 目標候補を改善メモの視点で検討できるワークスペースを提供する。
 * UX パターンは MonitoringTab のエビデンス引用と統一。
 */
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useCallback } from 'react';

import type { SupportPlanBundle } from '@/domain/isp/schema';
import type { GoalItem } from '@/features/shared/goal/goalTypes';
import { suggestionToGoalItem } from '../../domain/suggestedGoals';
import { useSuggestionMemo } from '../../hooks/useSuggestionMemo';
import type { ToastState } from '../../types';
import { findSection } from '../../utils/helpers';
import AdoptionMetricsPanel from './AdoptionMetricsPanel';
import FieldCard from './FieldCard';
import ISPCandidateImportSection from './ISPCandidateImportSection';
import SuggestionMemoSection from '../suggested-goals/SuggestionMemoSection';
import type { SectionTabProps } from './tabProps';

/** ExcellenceTab 固有の Props（MonitoringTab と同じパターン） */
export type ExcellenceTabProps = SectionTabProps & {
  /** 対象利用者の ID（ISP 候補取り込みに必要） */
  userId?: number | string | null;
  /** Toast 表示ハンドラ */
  setToast: (toast: ToastState) => void;
  /** SupportPlanBundle（P3-C: 提案候補のデータソース） */
  memoBundle?: SupportPlanBundle | null;
  /** 目標に昇格するハンドラ（P3-C） */
  onPromoteToGoal?: (goal: GoalItem) => void;
};

const ExcellenceTab: React.FC<ExcellenceTabProps> = ({
  userId,
  setToast,
  memoBundle,
  onPromoteToGoal,
  ...sectionProps
}) => {
  const section = findSection('excellence');
  if (!section) return null;

  // ── P3-C: 改善メモ提案候補 ──
  const {
    suggestions,
    pendingSuggestions,
    deferredSuggestions,
    metrics,
    noteToMemo,
    defer,
    promote,
    undoAction,
    hasSuggestions,
  } = useSuggestionMemo(memoBundle ?? null, sectionProps.form);

  // 「メモに追記」ハンドラ
  const handleNoteToMemo = useCallback(
    (id: string) => {
      const text = noteToMemo(id);
      if (text) {
        const currentIdeas = sectionProps.form.improvementIdeas;
        const separator = currentIdeas && !currentIdeas.endsWith('\n') ? '\n\n' : '';
        sectionProps.onFieldChange('improvementIdeas', currentIdeas + separator + text);
        setToast({
          open: true,
          message: '提案を改善メモに追記しました',
          severity: 'success',
        });
      }
    },
    [noteToMemo, sectionProps, setToast],
  );

  // 「目標に昇格」ハンドラ
  const handlePromote = useCallback(
    (id: string) => {
      const suggestion = promote(id);
      if (suggestion && onPromoteToGoal) {
        const goal = suggestionToGoalItem(suggestion);
        onPromoteToGoal(goal);
        setToast({
          open: true,
          message: '提案を目標に昇格しました（Smartタブで確認できます）',
          severity: 'success',
        });
      }
    },
    [promote, onPromoteToGoal, setToast],
  );

  return (
    <Stack spacing={2}>
      {section.description ? (
        <Typography variant="subtitle1" component="span" sx={{ color: 'text.secondary' }}>
          {section.description}
        </Typography>
      ) : null}

      {/* P3-C: 提案候補ワークスペース */}
      {sectionProps.isAdmin && hasSuggestions && (
        <SuggestionMemoSection
          suggestions={suggestions}
          pendingSuggestions={pendingSuggestions}
          deferredSuggestions={deferredSuggestions}
          metrics={metrics}
          onNoteToMemo={handleNoteToMemo}
          onDefer={defer}
          onPromote={handlePromote}
          onUndo={undoAction}
        />
      )}

      {/* Issue #10 Phase 2: ISP 候補取り込みセクション */}
      {userId != null && (
        <ISPCandidateImportSection
          userId={String(userId)}
          currentImprovementIdeas={sectionProps.form.improvementIdeas}
          onFieldChange={sectionProps.onFieldChange}
          isAdmin={sectionProps.isAdmin}
          setToast={setToast}
        />
      )}

      {/* Issue #11: 提案採用状況パネル */}
      {userId != null && (
        <AdoptionMetricsPanel
          userId={String(userId)}
          improvementIdeas={sectionProps.form.improvementIdeas}
        />
      )}

      <Stack spacing={2}>
        {section.fields.map((field) => (
          <FieldCard key={field.key} field={field} {...sectionProps} />
        ))}
      </Stack>
    </Stack>
  );
};

export default React.memo(ExcellenceTab);
