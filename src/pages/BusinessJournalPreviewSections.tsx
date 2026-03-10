/**
 * Business Journal Preview — Cell Content & Detail Dialog
 *
 * Extracted UI sections from BusinessJournalPreviewPage.tsx:
 * - CellContent: compact cell rendering in the monthly grid
 * - DetailDialog: full detail view when a cell is clicked
 *
 * @module pages/BusinessJournalPreviewSections
 */

import { TESTIDS } from '@/testids';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link } from 'react-router-dom';

import {
    ATTENDANCE_COLORS,
    MEAL_SHORT,
    type JournalDayEntry,
} from './businessJournalPreviewHelpers';

// ============================================================================
// CellContent
// ============================================================================

export function CellContent({ entry }: { entry: JournalDayEntry }) {
  if (entry.attendance === '休日') {
    return (
      <Box sx={{ textAlign: 'center', color: 'text.disabled', fontSize: 10 }}>
        —
      </Box>
    );
  }

  if (entry.attendance === '欠席') {
    return (
      <Box sx={{ textAlign: 'center' }}>
        <Box
          component="span"
          sx={{
            display: 'inline-block',
            width: 16,
            height: 16,
            borderRadius: '50%',
            bgcolor: ATTENDANCE_COLORS['欠席'],
            lineHeight: '16px',
            fontSize: 9,
            color: '#fff',
            fontWeight: 700,
          }}
        >
          欠
        </Box>
      </Box>
    );
  }

  const hasFlags = entry.restraint || entry.selfHarm || entry.otherInjury;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
      {/* Attendance badge */}
      <Box
        component="span"
        sx={{
          display: 'inline-block',
          width: 14,
          height: 14,
          borderRadius: '50%',
          bgcolor: ATTENDANCE_COLORS[entry.attendance],
          lineHeight: '14px',
          fontSize: 8,
          color: '#fff',
          fontWeight: 700,
          textAlign: 'center',
        }}
      >
        {entry.attendance === '遅刻' ? '遅' : entry.attendance === '早退' ? '早' : '◯'}
      </Box>

      {/* Meal indicator */}
      {entry.mealAmount && (
        <Box sx={{ fontSize: 9, lineHeight: 1, color: 'text.secondary' }}>
          {MEAL_SHORT[entry.mealAmount]}
        </Box>
      )}

      {/* Flag icons row */}
      {(hasFlags || entry.hasAttachment || entry.specialNotes) && (
        <Box sx={{ display: 'flex', gap: '1px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {entry.restraint && (
            <Box component="span" sx={{ fontSize: 8, color: 'error.main', fontWeight: 700 }}>拘</Box>
          )}
          {(entry.selfHarm || entry.otherInjury) && (
            <WarningAmberIcon sx={{ fontSize: 10, color: 'warning.main' }} />
          )}
          {entry.hasAttachment && (
            <AttachFileIcon sx={{ fontSize: 10, color: 'info.main' }} />
          )}
          {entry.specialNotes && (
            <Box component="span" sx={{ fontSize: 8, color: 'info.main' }}>📝</Box>
          )}
        </Box>
      )}
    </Box>
  );
}

// ============================================================================
// DetailDialog
// ============================================================================

interface DetailDialogProps {
  open: boolean;
  onClose: () => void;
  userName: string;
  userId: string;
  entry: JournalDayEntry | null;
  /** YYYY-MM for deep-link */
  monthValue: string;
}

export function DetailDialog({ open, onClose, userName, userId, entry, monthValue }: DetailDialogProps) {
  if (!entry) return null;

  const personalJournalUrl = `/records/journal/personal?user=${encodeURIComponent(userId)}&month=${encodeURIComponent(monthValue)}`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      data-testid={TESTIDS['journal-preview-detail-dialog']}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" component="span">
          {userName} — {entry.date}
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label="閉じる">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">出欠</Typography>
            <Chip
              label={entry.attendance}
              size="small"
              sx={{ bgcolor: ATTENDANCE_COLORS[entry.attendance], color: '#fff', fontWeight: 600 }}
            />
          </Box>

          {entry.mealAmount && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">食事</Typography>
              <Typography>{entry.mealAmount}</Typography>
            </Box>
          )}

          {entry.amActivities.length > 0 && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">AM作業</Typography>
              <Typography>{entry.amActivities.join('、')}</Typography>
            </Box>
          )}

          {entry.pmActivities.length > 0 && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">PM作業</Typography>
              <Typography>{entry.pmActivities.join('、')}</Typography>
            </Box>
          )}

          {/* Compliance flags */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary">法的記録</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
              <Chip
                label="拘束"
                size="small"
                color={entry.restraint ? 'error' : 'default'}
                variant={entry.restraint ? 'filled' : 'outlined'}
              />
              <Chip
                label="自傷"
                size="small"
                color={entry.selfHarm ? 'warning' : 'default'}
                variant={entry.selfHarm ? 'filled' : 'outlined'}
              />
              <Chip
                label="他傷"
                size="small"
                color={entry.otherInjury ? 'warning' : 'default'}
                variant={entry.otherInjury ? 'filled' : 'outlined'}
              />
              <Chip
                label="別紙"
                size="small"
                color={entry.hasAttachment ? 'info' : 'default'}
                variant={entry.hasAttachment ? 'filled' : 'outlined'}
              />
            </Stack>
          </Box>

          {entry.specialNotes && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">様子・特記</Typography>
              <Typography variant="body2">{entry.specialNotes}</Typography>
            </Box>
          )}

          {/* Navigation to personal journal */}
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button
              component={Link}
              to={personalJournalUrl}
              variant="outlined"
              size="small"
              startIcon={<OpenInNewIcon />}
              fullWidth
              data-testid="journal-detail-personal-link"
            >
              👤 この利用者の月次ページを開く（印刷）
            </Button>
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
