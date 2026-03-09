/**
 * RecordInputStep — Step 3: 行動記録 (Do) 入力
 *
 * 選択された時間帯の記録フォームを表示。
 * 保存後は Step 2 (Plan) に戻って次の時間帯を選択（連続入力フロー）。
 *
 * NOTE: ヘッダーはコンパクトに1行で表示し、縦スペースを最大化。
 */
import type { ScheduleItem } from '@/features/daily/components/split-stream/ProcedurePanel';
import { RecordPanel, type RecordPanelLockState } from '@/features/daily/components/split-stream/RecordPanel';
import type { BehaviorObservation } from '@/features/daily/domain/daily/types';
import { getScheduleKey } from '@/features/daily/domain/getScheduleKey';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
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
      </Box>

      {/* ── Record form (RecordPanel compact mode) ── */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <RecordPanel
          lockState={lockState}
          onSubmit={onSubmit}
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
