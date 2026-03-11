/**
 * MedicationRoundDialog.tsx — Medication stock registration dialog.
 *
 * Extracted from MedicationRound.tsx (L445-553).
 * Stateless: form state and handlers are passed as props from useMedicationRound.
 */
import type { NurseUser } from '@/features/nurse/users';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React from 'react';
import type { MedicationFormState } from './useMedicationRound';

type Props = {
  open: boolean;
  onClose: () => void;
  selectedUserName: string;
  selectedUserInfo?: NurseUser;
  selectedUser: string;
  form: MedicationFormState;
  setForm: React.Dispatch<React.SetStateAction<MedicationFormState>>;
  onSubmit: (event: React.FormEvent) => void;
  onReset: () => void;
};

const MedicationRoundDialog: React.FC<Props> = ({
  open,
  onClose,
  selectedUserName,
  selectedUserInfo,
  selectedUser,
  form,
  setForm,
  onSubmit,
  onReset,
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <form onSubmit={onSubmit}>
      <DialogTitle>服薬ストックを登録</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
        {/* 対象利用者表示 */}
        <Stack
          spacing={0.25}
          sx={{ p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}
        >
          <Typography variant="caption" color="text.secondary">対象利用者</Typography>
          <Typography fontWeight={600}>{selectedUserName}</Typography>
          {selectedUserInfo?.furigana ? (
            <Typography variant="caption" color="text.secondary">
              {selectedUserInfo.furigana}
            </Typography>
          ) : null}
          {selectedUser ? (
            <Typography variant="caption" color="text.secondary">
              ID: {selectedUser}
            </Typography>
          ) : null}
        </Stack>

        <TextField
          select
          label="区分"
          value={form.category}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              category: e.target.value as MedicationFormState['category'],
            }))
          }
          required
        >
          <MenuItem value="予備薬">予備薬</MenuItem>
          <MenuItem value="頓服">頓服</MenuItem>
          <MenuItem value="定期">定期</MenuItem>
          <MenuItem value="その他">その他</MenuItem>
        </TextField>

        <TextField
          label="薬剤名"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          required
        />

        <TextField
          label="用法・指示"
          value={form.dosage}
          onChange={(e) => setForm((prev) => ({ ...prev, dosage: e.target.value }))}
          placeholder="例）発熱時 1回2錠 最大1日3回"
        />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            type="number"
            label="在庫数"
            value={form.stock}
            onChange={(e) => setForm((prev) => ({ ...prev, stock: Number(e.target.value) }))}
            required
            inputProps={{ min: 0 }}
            sx={{ flex: 1 }}
          />
          <TextField
            label="単位"
            value={form.unit}
            onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
            sx={{ width: { xs: '100%', sm: 120 } }}
            required
          />
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            type="date"
            label="消費期限"
            value={form.expirationDate}
            onChange={(e) => setForm((prev) => ({ ...prev, expirationDate: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            required
            sx={{ flex: 1 }}
          />
          <TextField
            label="保管場所"
            value={form.storage}
            onChange={(e) => setForm((prev) => ({ ...prev, storage: e.target.value }))}
            required
            sx={{ flex: 1 }}
          />
        </Stack>

        <TextField
          label="処方医・医療機関"
          value={form.prescribedBy}
          onChange={(e) => setForm((prev) => ({ ...prev, prescribedBy: e.target.value }))}
          required
        />

        <TextField
          label="備考"
          value={form.notes}
          onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          multiline
          minRows={2}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { onClose(); onReset(); }}>キャンセル</Button>
        <Button type="submit" variant="contained">登録する</Button>
      </DialogActions>
    </form>
  </Dialog>
);

export default MedicationRoundDialog;
