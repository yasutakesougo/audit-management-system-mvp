/**
 * RecordInputStep — Step 3: 行動記録 (Do) 入力
 *
 * 選択された時間帯の記録フォームを表示。
 * 保存後は Step 2 (Plan) に戻って次の時間帯を選択（連続入力フロー）。
 *
 * Phase C: 戦略チップのトグルで「実施した戦略」を記録に含める。
 *
 * NOTE: ヘッダーはコンパクトに1行で表示し、縦スペースを最大化。
 */
import type { ReferencedStrategy, StrategyCategory } from '@/domain/behavior';
import type { ScheduleItem } from '@/features/daily/components/split-stream/ProcedurePanel';
import { RecordPanel, type RecordPanelLockState } from '@/features/daily/components/split-stream/RecordPanel';
import type { ABCRecord } from '@/domain/behavior';
import { getScheduleKey } from '@/features/daily/domain/builders/getScheduleKey';
import { useLinkedStrategies } from '@/features/daily/hooks/legacy/useLinkedStrategies';
import {
  StrategyChipBar,
  type StrategyChipKey,
  type AppliedStrategies,
} from './StrategyChipBar';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useDefaultStrategies } from '@/features/daily/hooks/legacy/useDefaultStrategies';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';

export type RecordInputStepProps = {
  /** 選択ユーザー名 */
  userName: string;
  /** 選択スロットキー (getScheduleKey format) */
  selectedSlotKey: string;
  /** ロック状態 */
  lockState: RecordPanelLockState;
  /** 記録送信ハンドラ */
  onSubmit: (data: Omit<ABCRecord, 'id' | 'userId'>) => Promise<void> | void;
  /** スケジュールリスト（スロットセレクタ用） */
  schedule: ScheduleItem[];
  /** 記録日 */
  recordDate: Date;
  /** 保存後コールバック — Step 2 に戻る */
  onAfterSubmit: () => void;
  /** スロット変更コールバック（チップクリック時） */
  onSlotChange?: (next: string) => void;
  /** 戻るボタン — Step 2 へ */
  onBack: () => void;
  /** 利用者ID（戦略参照用） */
  userId?: string;
  /** ABC記録への導線（slotId 付きで遷移） */
  onAbcRecord?: () => void;
};

// ── Helper: ChipKey → ReferencedStrategy ──

function parseChipKey(key: StrategyChipKey): { strategyKey: StrategyCategory; strategyText: string } {
  const colonIdx = key.indexOf(':');
  return {
    strategyKey: key.slice(0, colonIdx) as StrategyCategory,
    strategyText: key.slice(colonIdx + 1),
  };
}

function buildReferencedStrategies(applied: AppliedStrategies): ReferencedStrategy[] {
  return Array.from(applied).map((key) => ({
    ...parseChipKey(key),
    applied: true,
  }));
}

export const RecordInputStep: React.FC<RecordInputStepProps> = memo(({
  userName,
  selectedSlotKey,
  lockState,
  onSubmit,
  schedule,
  recordDate,
  onAfterSubmit,
  onSlotChange,
  onBack,
  userId,
  onAbcRecord,
}) => {
  // ── 参照戦略の取得 ──
  const linkedStrategies = useLinkedStrategies(userId);

  // ── 直近記録からの初期選択 (Step B) ──
  const { defaultKeys, sourceLabel, resolved } = useDefaultStrategies(userId);

  // ── 実施済み戦略の選択状態 (Phase C) ──
  const [appliedStrategies, setAppliedStrategies] = useState<AppliedStrategies>(new Set());
  const initialAppliedRef = useRef(false);

  // resolved 時に初期値を適用（1回のみ、ユーザーが未操作の場合）
  useEffect(() => {
    if (resolved && defaultKeys.size > 0 && !initialAppliedRef.current) {
      initialAppliedRef.current = true;
      setAppliedStrategies(defaultKeys);
    }
  }, [resolved, defaultKeys]);

  const handleToggleStrategy = useCallback((key: StrategyChipKey) => {
    setAppliedStrategies(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // スロット名を表示用に解決 — getScheduleKey フォーマットで照合
  const slotLabel = schedule.find(
    (s) => getScheduleKey(s.time, s.activity) === selectedSlotKey,
  );

  // ── 保存ハンドラのラップ: referencedStrategies を合流 ──
  const handleSubmitWithStrategies = useCallback(
    async (data: Omit<ABCRecord, 'id' | 'userId'>) => {
      const strategies = buildReferencedStrategies(appliedStrategies);
      await onSubmit({
        ...data,
        ...(strategies.length > 0 ? { referencedStrategies: strategies } : {}),
      });
      // リセット（次のスロット入力のため）
      setAppliedStrategies(new Set());
      initialAppliedRef.current = false; // 次スロットで再度初期適用を許可
    },
    [appliedStrategies, onSubmit],
  );

  const handleAfterSubmit = useCallback(() => {
    onAfterSubmit();
  }, [onAfterSubmit]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ── Compact header: [←] ユーザー名 | 09:15 持ち物整理 ── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: 0.5,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          minHeight: 40,
        }}
      >
        <IconButton onClick={onBack} size="small" aria-label="Plan へ戻る">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="subtitle2" fontWeight={600} noWrap>
          {userName}
        </Typography>
        {slotLabel && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mx: 0.5 }}>
              ›
            </Typography>
            <Typography variant="subtitle2" color="primary.main" fontWeight={600} noWrap>
              {slotLabel.time}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap sx={{ flex: 1, minWidth: 0 }}>
              {slotLabel.activity}
            </Typography>
          </>
        )}
        {/* ── ABC 記録へ ── */}
        {onAbcRecord && (
          <Button
            size="small"
            variant="outlined"
            color="warning"
            startIcon={<AssignmentRoundedIcon />}
            onClick={onAbcRecord}
            sx={{ ml: 'auto', flexShrink: 0, fontSize: '0.75rem', whiteSpace: 'nowrap' }}
          >
            ABC記録へ
          </Button>
        )}
      </Box>

      {/* ── 由来ラベル (Step B) ── */}
      {sourceLabel && appliedStrategies.size > 0 && (
        <Box
          sx={{
            px: 1.5,
            pt: 0.5,
            pb: 0,
            bgcolor: 'grey.50',
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontSize: '0.65rem', fontStyle: 'italic' }}
          >
            💡 {sourceLabel}
          </Typography>
        </Box>
      )}

      {/* ── Strategy chips (Phase B+C: toggleable) ── */}
      <StrategyChipBar
        strategies={linkedStrategies}
        appliedStrategies={appliedStrategies}
        onToggle={handleToggleStrategy}
      />

      {/* ── Record form (RecordPanel compact mode) ── */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <RecordPanel
          lockState={lockState}
          onSubmit={handleSubmitWithStrategies}
          schedule={schedule}
          selectedSlotKey={selectedSlotKey}
          onSlotChange={onSlotChange}
          onAfterSubmit={handleAfterSubmit}
          recordDate={recordDate}
          compact
        />
      </Box>
    </Box>
  );
});

RecordInputStep.displayName = 'RecordInputStep';
