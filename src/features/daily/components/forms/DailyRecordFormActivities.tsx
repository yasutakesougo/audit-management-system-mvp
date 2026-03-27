/**
 * DailyRecordFormActivities — AM/PM activity section
 *
 * Reusable component for both 午前 and 午後 activity sections.
 * Extracted from DailyRecordForm.tsx for single-responsibility.
 */

import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DeleteIcon from '@mui/icons-material/Delete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

// ─── Props ──────────────────────────────────────────────────────────────────

interface DailyRecordFormActivitiesProps {
  period: 'AM' | 'PM';
  activities: string[];
  notes: string;
  newActivity: string;
  onNewActivityChange: (value: string) => void;
  onAddActivity: () => void;
  onRemoveActivity: (index: number) => void;
  onNotesChange: (value: string) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

const LABELS = {
  AM: { title: '午前の活動', notesLabel: '午前の記録・メモ', notesPlaceholder: '午前中の様子や特記事項を記録' },
  PM: { title: '午後の活動', notesLabel: '午後の記録・メモ', notesPlaceholder: '午後の様子や特記事項を記録' },
} as const;

export function DailyRecordFormActivities({
  period,
  activities,
  notes,
  newActivity,
  onNewActivityChange,
  onAddActivity,
  onRemoveActivity,
  onNotesChange,
}: DailyRecordFormActivitiesProps) {
  const labels = LABELS[period];

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
        <AccessTimeIcon sx={{ mr: 1 }} />
        {labels.title}
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          <TextField
            size="small"
            placeholder="活動内容を入力"
            value={newActivity}
            onChange={(e) => onNewActivityChange(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') onAddActivity();
            }}
            sx={{ flexGrow: 1 }}
          />
          <Button
            variant="outlined"
            onClick={onAddActivity}
            disabled={!newActivity.trim()}
          >
            追加
          </Button>
        </Stack>

        <Stack direction="row" flexWrap="wrap" gap={0.5}>
          {activities.map((activity: string, index: number) => (
            <Chip
              key={index}
              label={activity}
              onDelete={() => onRemoveActivity(index)}
              deleteIcon={<DeleteIcon />}
              size="small"
            />
          ))}
        </Stack>
      </Box>

      <TextField
        fullWidth
        multiline
        rows={3}
        label={labels.notesLabel}
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder={labels.notesPlaceholder}
      />
    </Paper>
  );
}
