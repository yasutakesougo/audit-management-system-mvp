/**
 * MedicationRound.tsx — Orchestrator shell for the medication stock management page.
 *
 * Refactored in NR20. Responsibilities have been extracted to:
 * - medicationRoundTypes.ts    → domain types + seed data
 * - medicationRoundHelpers.ts  → pure helper functions
 * - useMedicationRound.ts      → all state and business logic
 * - MedicationRoundTable.tsx   → inventory table presentational component
 * - MedicationRoundDialog.tsx  → stock registration dialog
 */
import { TESTIDS } from '@/testids';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React from 'react';
import MedicationRoundDialog from './MedicationRoundDialog';
import MedicationRoundTable from './MedicationRoundTable';
import { useMedicationRound } from './useMedicationRound';

const MedicationRound: React.FC = () => {
  const {
    nurseUsers,
    filteredInventory,
    summary,
    selectedUser,
    selectedUserInfo,
    selectedUserName,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    dialogOpen,
    setDialogOpen,
    form,
    setForm,
    handleSubmit,
    resetForm,
    setSelectedUser,
    toast,
    setToast,
  } = useMedicationRound();

  return (
    <Box data-testid={TESTIDS.NURSE_MEDS_PAGE} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* ── Page header ── */}
      <Stack spacing={1}>
        <Typography variant="overline" color="primary">
          看護ワークスペース / 服薬管理
        </Typography>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          服薬ストック一覧
        </Typography>
        <Typography variant="body2" color="text.secondary">
          日次チェックではなく、施設で保管する予備薬・頓服・処方薬を管理します。処方医や使用条件、消費期限をまとめて把握できます。
        </Typography>
      </Stack>

      {/* ── Summary panel + Controls ── */}
      <Grid container spacing={2}>
        {/* Summary */}
        <Grid size={{ xs: 12, md: 4 }} data-testid={TESTIDS.NURSE_MEDS_GRID_SUMMARY}>
          <Stack
            sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
            spacing={1.5}
          >
            <Stack spacing={0.25}>
              <Typography variant="subtitle2" color="text.secondary">対象利用者</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{selectedUserName}</Typography>
              {selectedUserInfo?.furigana ? (
                <Typography variant="caption" color="text.secondary">{selectedUserInfo.furigana}</Typography>
              ) : null}
              {selectedUser ? (
                <Typography variant="caption" color="text.secondary">ID: {selectedUser}</Typography>
              ) : null}
            </Stack>
            <Typography variant="subtitle2" color="text.secondary">ストック状況</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h5" sx={{ fontWeight: 700 }}>{summary.total}件</Typography>
              <Chip label={`良好 ${summary.ok}`} color="success" size="small" />
              <Chip label={`30日以内 ${summary.expiring}`} color="warning" size="small" />
              <Chip label={`期限切れ ${summary.expired}`} color="error" size="small" />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              消費期限が近いものは週次で確認し、利用者・ご家族と共有してください。
            </Typography>
          </Stack>
        </Grid>

        {/* Controls */}
        <Grid size={{ xs: 12, md: 8 }} data-testid={TESTIDS.NURSE_MEDS_GRID_CONTROLS}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'flex-end' }}>
            <TextField
              select
              label="利用者"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              sx={{ minWidth: { xs: '100%', md: 200 } }}
              InputLabelProps={{ shrink: true }}
            >
              {nurseUsers.map((user) => (
                <MenuItem key={user.id} value={user.id}>
                  <Stack spacing={0.25}>
                    <Typography>{user.name}</Typography>
                    {user.furigana ? (
                      <Typography variant="caption" color="text.secondary">{user.furigana}</Typography>
                    ) : null}
                  </Stack>
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="薬品／処方医で検索"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              select
              label="期限ステータス"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="all">すべて</MenuItem>
              <MenuItem value="ok">良好（31日以上）</MenuItem>
              <MenuItem value="expiring">30日以内</MenuItem>
              <MenuItem value="expired">期限切れ</MenuItem>
            </TextField>
            <Button
              variant="contained"
              onClick={() => setDialogOpen(true)}
              data-testid={TESTIDS.NURSE_MEDS_SAVE}
              disabled={!selectedUser}
            >
              在庫を登録
            </Button>
          </Stack>
        </Grid>
      </Grid>

      {/* ── Inventory table ── */}
      <MedicationRoundTable entries={filteredInventory} />

      {/* ── Registration dialog ── */}
      <MedicationRoundDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        selectedUserName={selectedUserName}
        selectedUserInfo={selectedUserInfo}
        selectedUser={selectedUser}
        form={form}
        setForm={setForm}
        onSubmit={handleSubmit}
        onReset={resetForm}
      />

      {/* ── Toast ── */}
      <Snackbar
        open={toast != null}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setToast(null)}>
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MedicationRound;
