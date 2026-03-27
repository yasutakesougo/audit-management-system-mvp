/**
 * DailyRecordFormBehavior — Problem behavior & seizure record sections
 *
 * Extracted from DailyRecordForm.tsx for single-responsibility.
 */

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { ProblemBehaviorSuggestion } from './dailyRecordFormLogic';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProblemBehavior {
  selfHarm?: boolean;
  otherInjury?: boolean;
  loudVoice?: boolean;
  pica?: boolean;
  other?: boolean;
  otherDetail?: string;
}

interface SeizureRecord {
  occurred?: boolean;
  time?: string;
  duration?: string;
  severity?: string;
  notes?: string;
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface DailyRecordFormBehaviorProps {
  problemBehavior?: ProblemBehavior;
  seizureRecord?: SeizureRecord;
  onProblemBehaviorChange: (field: string, value: boolean | string) => void;
  onSeizureRecordChange: (field: string, value: boolean | string) => void;
  // Problem suggestion props
  showSuggestion: boolean;
  problemSuggestion?: ProblemBehaviorSuggestion | null;
  onApplySuggestion: () => void;
}

// ─── Problem Behavior Suggestion Banner ─────────────────────────────────────

function ProblemSuggestionBanner({
  suggestion,
  onApply,
}: {
  suggestion: ProblemBehaviorSuggestion;
  onApply: () => void;
}) {
  return (
    <Alert severity="info" sx={{ p: 2 }}>
      <Stack spacing={1}>
        <Typography variant="subtitle2">
          💡 申し送りの内容から、問題行動の候補があります
        </Typography>
        <Typography variant="body2">
          必要であれば「提案を反映」を押すと、自傷・他傷・大声・異食などのチェックを
          自動でオンにします。不要な項目は後から外すことができます。
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {suggestion.selfHarm && <Chip label="自傷（候補）" size="small" />}
          {suggestion.otherInjury && <Chip label="他傷（候補）" size="small" />}
          {suggestion.loudVoice && <Chip label="大声（候補）" size="small" />}
          {suggestion.pica && <Chip label="異食（候補）" size="small" />}
          {suggestion.other && <Chip label="その他（候補）" size="small" />}
        </Stack>
        <Box>
          <Button variant="outlined" size="small" onClick={onApply}>
            提案を反映
          </Button>
        </Box>
      </Stack>
    </Alert>
  );
}

// ─── Problem Behavior Section ───────────────────────────────────────────────

function ProblemBehaviorSection({
  problemBehavior,
  onChange,
}: {
  problemBehavior?: ProblemBehavior;
  onChange: (field: string, value: boolean | string) => void;
}) {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle1" sx={{ mb: 2 }}>
        問題行動
      </Typography>

      <Stack direction="row" flexWrap="wrap" spacing={1} sx={{ mb: 2 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={problemBehavior?.selfHarm || false}
              onChange={(e) => onChange('selfHarm', e.target.checked)}
            />
          }
          label="自傷"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={problemBehavior?.otherInjury || false}
              onChange={(e) => onChange('otherInjury', e.target.checked)}
            />
          }
          label="他傷"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={problemBehavior?.loudVoice || false}
              onChange={(e) => onChange('loudVoice', e.target.checked)}
            />
          }
          label="大声"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={problemBehavior?.pica || false}
              onChange={(e) => onChange('pica', e.target.checked)}
            />
          }
          label="異食"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={problemBehavior?.other || false}
              onChange={(e) => onChange('other', e.target.checked)}
            />
          }
          label="その他"
        />
      </Stack>

      {problemBehavior?.other && (
        <TextField
          fullWidth
          label="その他詳細"
          value={problemBehavior?.otherDetail || ''}
          onChange={(e) => onChange('otherDetail', e.target.value)}
          multiline
          rows={2}
          sx={{ mt: 2 }}
        />
      )}
    </Paper>
  );
}

// ─── Seizure Record Section ─────────────────────────────────────────────────

function SeizureRecordSection({
  seizureRecord,
  onChange,
}: {
  seizureRecord?: SeizureRecord;
  onChange: (field: string, value: boolean | string) => void;
}) {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle1" sx={{ mb: 2 }}>
        発作記録
      </Typography>

      <FormControlLabel
        control={
          <Checkbox
            checked={seizureRecord?.occurred || false}
            onChange={(e) => onChange('occurred', e.target.checked)}
          />
        }
        label="発作あり"
        sx={{ mb: 2 }}
      />

      {seizureRecord?.occurred && (
        <Stack spacing={2}>
          <TextField
            label="発作時刻"
            type="time"
            value={seizureRecord?.time || ''}
            onChange={(e) => onChange('time', e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="持続時間"
            placeholder="例：約5分"
            value={seizureRecord?.duration || ''}
            onChange={(e) => onChange('duration', e.target.value)}
          />
          <FormControl>
            <InputLabel>重症度</InputLabel>
            <Select
              name="seizureSeverity"
              value={seizureRecord?.severity || ''}
              onChange={(e) => onChange('severity', e.target.value)}
              label="重症度"
            >
              <MenuItem value="軽度">軽度</MenuItem>
              <MenuItem value="中等度">中等度</MenuItem>
              <MenuItem value="重度">重度</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="発作メモ"
            multiline
            rows={2}
            value={seizureRecord?.notes || ''}
            onChange={(e) => onChange('notes', e.target.value)}
          />
        </Stack>
      )}
    </Paper>
  );
}

// ─── Composed Export ────────────────────────────────────────────────────────

export function DailyRecordFormBehavior({
  problemBehavior,
  seizureRecord,
  onProblemBehaviorChange,
  onSeizureRecordChange,
  showSuggestion,
  problemSuggestion,
  onApplySuggestion,
}: DailyRecordFormBehaviorProps) {
  return (
    <>
      {showSuggestion && problemSuggestion && (
        <ProblemSuggestionBanner
          suggestion={problemSuggestion}
          onApply={onApplySuggestion}
        />
      )}
      <ProblemBehaviorSection
        problemBehavior={problemBehavior}
        onChange={onProblemBehaviorChange}
      />
      <SeizureRecordSection
        seizureRecord={seizureRecord}
        onChange={onSeizureRecordChange}
      />
    </>
  );
}
