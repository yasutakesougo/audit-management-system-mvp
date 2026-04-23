import type { TransportAssignmentSaveStatus } from '@/features/transport-assignments/hooks/useTransportAssignmentSave';
import type { TransportDirection } from '@/features/today/transport/transportTypes';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import {
  getSaveStatusText,
  type WeekDateOption,
} from './TransportAssignmentPage.logic';

type TransportAssignmentControlSectionProps = {
  targetDate: string;
  direction: TransportDirection;
  weekRangeLabel: string;
  weekDateOptions: WeekDateOption[];
  hasWeekdayDefaultSuggestion: boolean;
  saveStatus: TransportAssignmentSaveStatus;
  dirty: boolean;
  lastSavedAt: string | null;
  effectivePayloadCount: number;
  canSave: boolean;
  onTargetDateChange: (nextDateValue: string) => void;
  onChangeWeek: (offsetDays: number) => void;
  onDirectionChange: (nextDirection: TransportDirection) => void;
  onWeekdayChange: (nextDate: string) => void;
  onApplyWeekdayDefault: () => void;
  onApplyWeekBulkDefault: () => void;
  onRefresh: () => void;
  onSave: () => void;
};

export function TransportAssignmentControlSection({
  targetDate,
  direction,
  weekRangeLabel,
  weekDateOptions,
  hasWeekdayDefaultSuggestion,
  saveStatus,
  dirty,
  lastSavedAt,
  effectivePayloadCount,
  canSave,
  onTargetDateChange,
  onChangeWeek,
  onDirectionChange,
  onWeekdayChange,
  onApplyWeekdayDefault,
  onApplyWeekBulkDefault,
  onRefresh,
  onSave,
}: TransportAssignmentControlSectionProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
        <TextField
          label="対象日"
          type="date"
          size="small"
          value={targetDate}
          onChange={(event) => onTargetDateChange(event.target.value)}
          inputProps={{ 'data-testid': 'transport-assignment-date' }}
          sx={{ width: { xs: '100%', md: 220 } }}
        />
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            size="small"
            variant="outlined"
            onClick={() => onChangeWeek(-7)}
            data-testid="transport-assignment-week-prev"
          >
            前週
          </Button>
          <Chip
            size="small"
            label={`週 ${weekRangeLabel}`}
            data-testid="transport-assignment-week-range"
          />
          <Button
            size="small"
            variant="outlined"
            onClick={() => onChangeWeek(7)}
            data-testid="transport-assignment-week-next"
          >
            次週
          </Button>
        </Stack>
        <ToggleButtonGroup
          size="small"
          color="primary"
          exclusive
          value={direction}
          onChange={(_, value: TransportDirection | null) => {
            if (value) onDirectionChange(value);
          }}
          data-testid="transport-assignment-direction"
        >
          <ToggleButton value="to">迎え</ToggleButton>
          <ToggleButton value="from">送り</ToggleButton>
        </ToggleButtonGroup>
        <ToggleButtonGroup
          size="small"
          color="primary"
          exclusive
          value={targetDate}
          onChange={(_, value: string | null) => {
            if (value) onWeekdayChange(value);
          }}
          data-testid="transport-assignment-weekdays"
          sx={{ flexWrap: 'wrap' }}
        >
          {weekDateOptions.map((option) => (
            <ToggleButton
              key={option.date}
              value={option.date}
              data-testid={`transport-assignment-weekday-${option.date}`}
            >
              {option.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {hasWeekdayDefaultSuggestion ? (
          <Button
            size="small"
            variant="outlined"
            onClick={onApplyWeekdayDefault}
            data-testid="transport-assignment-apply-weekday-default"
            disabled={saveStatus === 'saving'}
          >
            同曜日デフォルト適用
          </Button>
        ) : null}
        <Button
          size="small"
          variant="outlined"
          onClick={onApplyWeekBulkDefault}
          data-testid="transport-assignment-apply-week-bulk-default"
          disabled={saveStatus === 'saving'}
        >
          今週に一括適用
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={onRefresh}
          data-testid="transport-assignment-refresh-button"
          disabled={saveStatus === 'saving'}
        >
          最新の情報を取得
        </Button>
        <Typography variant="body2" color="text.secondary" sx={{ ml: { md: 'auto' } }}>
          {getSaveStatusText({
            saveStatus,
            dirty,
            lastSavedAt,
          })}
        </Typography>
        <Chip
          size="small"
          color={effectivePayloadCount > 0 ? 'warning' : 'default'}
          label={`更新予定 ${effectivePayloadCount}件`}
          data-testid="transport-assignment-payload-count"
        />
        <Button
          variant="contained"
          disabled={!canSave}
          onClick={onSave}
          data-testid="transport-assignment-save-button"
        >
          {saveStatus === 'saving' ? '保存中…' : '保存'}
        </Button>
      </Stack>
    </Paper>
  );
}
