/**
 * RecordInputStep — Step 3: 行動記録 (Do) 入力
 *
 * 選択された時間帯の記録フォームを表示。
 * 保存後は Step 2 (Plan) に戻って次の時間帯を選択（連続入力フロー）。
 */
import type { ScheduleItem } from '@/features/daily/components/split-stream/ProcedurePanel';
import { RecordPanel, type RecordPanelLockState } from '@/features/daily/components/split-stream/RecordPanel';
import type { BehaviorObservation } from '@/features/daily/domain/daily/types';
import { getScheduleKey } from '@/features/daily/domain/getScheduleKey';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import React, { memo, useCallback } from 'react';

export type RecordInputStepProps = {
  /** 選択ユーザー名 */
  userName: string;
  /** 選択スロットキー (getScheduleKey format) */
  selectedSlotKey: string;
  /** ロック状態 */
  lockState: RecordPanelLockState;
  /** 記録送信ハンドラ */
  onSubmit: (data: Omit<BehaviorObservation, 'id' | 'userId'>) => Promise<void> | void;
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
};

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
}) => {
  // スロット名を表示用に解決 — getScheduleKey フォーマットで照合
  const slotLabel = schedule.find(
    (s) => getScheduleKey(s.time, s.activity) === selectedSlotKey,
  );

  const handleAfterSubmit = useCallback(() => {
    onAfterSubmit();
  }, [onAfterSubmit]);

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
          size="small"
          sx={{ textTransform: 'none' }}
        >
          Plan へ戻る
        </Button>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" fontWeight={600}>
            {userName} 様
          </Typography>
          {slotLabel && (
            <Typography variant="caption" color="text.secondary">
              {slotLabel.time} — {slotLabel.activity}
            </Typography>
          )}
        </Box>
      </Box>

      {/* ── Record form (既存コンポーネント再利用) ── */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <RecordPanel
          lockState={lockState}
          onSubmit={onSubmit}
          schedule={schedule}
          selectedSlotKey={selectedSlotKey}
          onSlotChange={onSlotChange}
          onAfterSubmit={handleAfterSubmit}
          recordDate={recordDate}
        />
      </Box>
    </Box>
  );
});

RecordInputStep.displayName = 'RecordInputStep';
