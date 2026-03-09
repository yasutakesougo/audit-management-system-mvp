/**
 * Iceberg PDCA — Form & Item List Section
 *
 * Contains the PDCA create/edit form, item list with edit/delete actions,
 * delete confirmation dialog, and snackbar notifications.
 * Extracted from IcebergPdcaPage.tsx for maintainability.
 *
 * @module features/ibd/analysis/pdca/IcebergPdcaFormSection
 */

import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Snackbar,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import * as React from 'react';

import type { IcebergPdcaItem, IcebergPdcaPhase } from './types';

// ============================================================================
// Types
// ============================================================================

interface FormState {
  mode: 'create' | 'edit';
  id?: string;
  title: string;
  summary: string;
  phase: IcebergPdcaPhase;
}

export interface IcebergPdcaFormSectionProps {
  items: IcebergPdcaItem[];
  canWrite: boolean;
  selectedUserId: string | undefined;
  isMutating: boolean;
  formState: FormState;
  setFormState: React.Dispatch<React.SetStateAction<FormState>>;
  onSubmit: (event: React.FormEvent) => Promise<void>;
  onStartEdit: (item: IcebergPdcaItem) => void;
  onDelete: (item: IcebergPdcaItem) => void;
  deleteTarget: IcebergPdcaItem | null;
  onCloseDelete: () => void;
  onConfirmDelete: () => Promise<void>;
  isDeleting: boolean;
  snackbar: string | null;
  onCloseSnackbar: () => void;
  snapshotWarning: string | null;
  onCloseSnapshotWarning: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function IcebergPdcaFormSection({
  items,
  canWrite,
  selectedUserId,
  isMutating,
  formState,
  setFormState,
  onSubmit,
  onStartEdit,
  onDelete,
  deleteTarget,
  onCloseDelete,
  onConfirmDelete,
  isDeleting,
  snackbar,
  onCloseSnackbar,
  snapshotWarning,
  onCloseSnapshotWarning,
}: IcebergPdcaFormSectionProps) {
  return (
    <Box>
      {canWrite && selectedUserId && (
        <Paper sx={{ p: 2, mb: 2 }} variant="outlined" component="form" onSubmit={onSubmit}>
          <Stack spacing={1.5}>
            <Typography variant="subtitle1">
              {formState.mode === 'edit' ? 'PDCAを編集' : 'PDCAを新規作成'}
            </Typography>
            <TextField
              label="タイトル"
              size="small"
              value={formState.title}
              onChange={(e) => setFormState((prev) => ({ ...prev, title: e.target.value }))}
              required
            />
            <TextField
              label="概要"
              size="small"
              multiline
              minRows={2}
              value={formState.summary}
              onChange={(e) => setFormState((prev) => ({ ...prev, summary: e.target.value }))}
            />
            <FormControl size="small">
              <InputLabel id="pdca-phase-label">Phase</InputLabel>
              <Select
                labelId="pdca-phase-label"
                label="Phase"
                value={formState.phase}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, phase: e.target.value as IcebergPdcaPhase }))
                }
              >
                <MenuItem value="PLAN">PLAN</MenuItem>
                <MenuItem value="DO">DO</MenuItem>
                <MenuItem value="CHECK">CHECK</MenuItem>
                <MenuItem value="ACT">ACT</MenuItem>
              </Select>
            </FormControl>
            <Stack direction="row" spacing={1}>
              <Button
                type="submit"
                variant="contained"
                size="small"
                disabled={!selectedUserId || !formState.title.trim() || isMutating}
              >
                {formState.mode === 'edit' ? '保存' : '作成'}
              </Button>
              {formState.mode === 'edit' && (
                <Button
                  type="button"
                  variant="text"
                  size="small"
                  onClick={() => setFormState({ mode: 'create', title: '', summary: '', phase: 'PLAN' })}
                  disabled={isMutating}
                >
                  キャンセル
                </Button>
              )}
            </Stack>
          </Stack>
        </Paper>
      )}

      <Stack spacing={1.5}>
        {items.map((item) => (
          <Paper key={item.id} sx={{ p: 2 }} variant="outlined">
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  {item.title}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Phase: {item.phase} / 更新: {item.updatedAt}
                </Typography>
                {item.summary ? (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {item.summary}
                  </Typography>
                ) : null}
              </Box>
              {canWrite && (
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => onStartEdit(item)}
                    disabled={isMutating}
                  >
                    編集
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    onClick={() => onDelete(item)}
                    disabled={isMutating}
                  >
                    削除
                  </Button>
                </Stack>
              )}
            </Stack>
          </Paper>
        ))}
        {items.length === 0 && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            PDCA項目はまだありません。
          </Typography>
        )}
      </Stack>

      <Dialog open={Boolean(deleteTarget)} onClose={onCloseDelete} fullWidth maxWidth="xs">
        <DialogTitle>この記録を削除しますか？</DialogTitle>
        <DialogContent>
          <DialogContentText>削除すると元に戻せません。</DialogContentText>
          {deleteTarget ? (
            <Box sx={{ mt: 1.5 }}>
              <Typography variant="subtitle2">{deleteTarget.title}</Typography>
              {deleteTarget.summary ? (
                <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                  {deleteTarget.summary}
                </Typography>
              ) : null}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseDelete} disabled={isDeleting}>
            キャンセル
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={onConfirmDelete}
            disabled={!deleteTarget || isDeleting}
          >
            削除
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={4000}
        onClose={onCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={onCloseSnackbar} sx={{ width: '100%' }}>
          {snackbar}
        </Alert>
      </Snackbar>

      <Snackbar
        open={Boolean(snapshotWarning)}
        autoHideDuration={5000}
        onClose={onCloseSnapshotWarning}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="warning" onClose={onCloseSnapshotWarning} sx={{ width: '100%' }}>
          {snapshotWarning}
        </Alert>
      </Snackbar>
    </Box>
  );
}
