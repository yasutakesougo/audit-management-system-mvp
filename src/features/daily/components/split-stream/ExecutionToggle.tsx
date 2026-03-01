// ---------------------------------------------------------------------------
// ExecutionToggle — A-Layer inline toggle for execution status recording
//
// ✅ completed / ⚠️ triggered / ⏭️ skipped
// triggered 選択時のみメモ入力欄を表示
// ---------------------------------------------------------------------------
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import type React from 'react';
import { memo } from 'react';

import type { RecordStatus } from '../../domain/executionRecordTypes';
import { useExecutionRecord } from '../../hooks/useExecutionRecord';

interface ExecutionToggleProps {
  date: string;
  userId: string;
  scheduleItemId: string;
}

function ExecutionToggleInner({ date, userId, scheduleItemId }: ExecutionToggleProps) {
  const { record, setStatus, setMemo } = useExecutionRecord(date, userId, scheduleItemId);

  const handleStatusChange = (
    event: React.MouseEvent<HTMLElement>,
    newStatus: RecordStatus | null,
  ) => {
    event.stopPropagation(); // 親のListItem選択を防ぐ
    if (newStatus !== null) {
      setStatus(newStatus);
    }
  };

  const handleMemoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setMemo(event.target.value);
  };

  const currentStatus = record?.status === 'unrecorded' ? null : (record?.status ?? null);

  return (
    <Box
      sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      data-testid={`execution-toggle-${scheduleItemId}`}
    >
      <ToggleButtonGroup
        value={currentStatus}
        exclusive
        onChange={handleStatusChange}
        size="small"
        fullWidth
      >
        <Tooltip title="計画通り実施した" arrow placement="top">
          <ToggleButton value="completed" color="success" data-testid={`exec-btn-completed-${scheduleItemId}`}>
            <CheckCircleIcon fontSize="small" sx={{ mr: 0.5 }} /> 完了
          </ToggleButton>
        </Tooltip>
        <Tooltip title="行動が発生し対応した" arrow placement="top">
          <ToggleButton value="triggered" color="warning" data-testid={`exec-btn-triggered-${scheduleItemId}`}>
            <WarningAmberIcon fontSize="small" sx={{ mr: 0.5 }} /> 発動
          </ToggleButton>
        </Tooltip>
        <Tooltip title="この時間帯は未実施" arrow placement="top">
          <ToggleButton value="skipped" data-testid={`exec-btn-skipped-${scheduleItemId}`}>
            <SkipNextIcon fontSize="small" sx={{ mr: 0.5 }} /> スキップ
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>

      {/* ⚠️ 発動時のみメモ欄を表示 */}
      {record?.status === 'triggered' && (
        <TextField
          size="small"
          placeholder="発動メモ（例: イヤーマフで落ち着いた）"
          value={record.memo || ''}
          onChange={handleMemoChange}
          onClick={(e) => e.stopPropagation()}
          fullWidth
          variant="outlined"
          sx={{ mt: 0.5 }}
          data-testid={`exec-memo-${scheduleItemId}`}
          inputProps={{ 'aria-label': '発動メモ' }}
        />
      )}
    </Box>
  );
}

export const ExecutionToggle = memo(ExecutionToggleInner);
ExecutionToggle.displayName = 'ExecutionToggle';
