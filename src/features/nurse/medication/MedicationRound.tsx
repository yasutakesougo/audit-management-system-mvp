import { NURSE_USERS, type NurseUser } from '@/features/nurse/users';
import { TESTIDS } from '@/testids';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { useMemo, useState } from 'react';

type MedicationInventoryEntry = {
  id: number;
  category: '予備薬' | '頓服' | '定期' | 'その他';
  name: string;
  dosage: string;
  stock: number;
  unit: string;
  expirationDate: string;
  prescribedBy: string;
  storage: string;
  notes?: string;
};

const DEFAULT_INVENTORY_SEED: Readonly<Record<string, MedicationInventoryEntry[]>> = Object.freeze({
  I022: [
    {
      id: 1,
      category: '予備薬',
      name: 'セフカペンピボキシル塩酸塩錠 100mg',
      dosage: '発熱時 1回2錠（最大1日3回）',
      stock: 12,
      unit: '錠',
      expirationDate: '2026-02-15',
      prescribedBy: '○○内科クリニック / 佐藤医師',
      storage: '医務室：救急ロッカー 2段目',
      notes: '体温38℃以上で使用。使用後は医師へ報告。',
    },
  ],
  I015: [
    {
      id: 1,
      category: '頓服',
      name: 'ロキソプロフェンナトリウム錠 60mg',
      dosage: '頭痛時 1錠（8時間以上間隔）',
      stock: 8,
      unit: '錠',
      expirationDate: '2025-12-01',
      prescribedBy: '□□病院 ペインクリニック',
      storage: '医務室：頓服トレイ',
      notes: '胃薬（レバミピド）と併用。',
    },
    {
      id: 2,
      category: 'その他',
      name: '消毒用エタノール（500ml）',
      dosage: '創部処置時に使用',
      stock: 1,
      unit: '本',
      expirationDate: '2025-04-30',
      prescribedBy: '施設備蓄',
      storage: '衛生備品棚',
      notes: '開封日：2024-11-01。揮発に注意。',
    },
  ],
});

type MedicationSeed = {
  users?: NurseUser[];
  inventory?: Record<string, MedicationInventoryEntry[]>;
};

declare global {
  interface Window {
    __NURSE_MEDS_SEED__?: MedicationSeed;
  }
}

const createDefaultInventoryByUser = (users: NurseUser[]): Record<string, MedicationInventoryEntry[]> => {
  const result: Record<string, MedicationInventoryEntry[]> = {};
  for (const user of users) {
    const template = DEFAULT_INVENTORY_SEED[user.id];
    result[user.id] = template ? template.map((entry) => ({ ...entry })) : [];
  }
  return result;
};

const mergeInventory = (
  base: Record<string, MedicationInventoryEntry[]>,
  overrides?: Record<string, MedicationInventoryEntry[]>,
): Record<string, MedicationInventoryEntry[]> => {
  const merged: Record<string, MedicationInventoryEntry[]> = {};
  const ids = new Set([...Object.keys(base), ...(overrides ? Object.keys(overrides) : [])]);
  ids.forEach((id) => {
    const overrideEntries = overrides?.[id];
    if (overrideEntries?.length) {
      merged[id] = overrideEntries.map((entry, index) => ({
        ...entry,
        id: entry.id ?? index + 1,
      }));
    } else {
      merged[id] = base[id] ? base[id].map((entry) => ({ ...entry })) : [];
    }
  });
  return merged;
};
type StatusFilter = 'all' | 'ok' | 'expiring' | 'expired';

const statusColorMap: Record<StatusFilter, 'default' | 'warning' | 'error' | 'success'> = {
  all: 'default',
  ok: 'success',
  expiring: 'warning',
  expired: 'error',
};

const categorizeStatus = (entry: MedicationInventoryEntry): StatusFilter => {
  const today = new Date();
  const exp = new Date(entry.expirationDate);
  const diffMs = exp.getTime() - today.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'expired';
  if (diffDays <= 30) return 'expiring';
  return 'ok';
};

const statusLabel = (status: StatusFilter) => {
  if (status === 'ok') return '良好';
  if (status === 'expiring') return '30日以内';
  if (status === 'expired') return '期限切れ';
  return 'すべて';
};

const MedicationRound: React.FC = () => {
  const medicationSeed = useMemo<MedicationSeed | undefined>(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    return window.__NURSE_MEDS_SEED__;
  }, []);

  const nurseUsers = useMemo<NurseUser[]>(() => {
    if (medicationSeed?.users?.length) {
      return medicationSeed.users;
    }
    return NURSE_USERS;
  }, [medicationSeed]);

  const defaultInventory = useMemo(
    () => createDefaultInventoryByUser(nurseUsers),
    [nurseUsers],
  );

  const initialInventory = useMemo(
    () => mergeInventory(defaultInventory, medicationSeed?.inventory),
    [defaultInventory, medicationSeed],
  );

  const [inventoryByUser, setInventoryByUser] = useState<Record<string, MedicationInventoryEntry[]>>(() => initialInventory);
  const [selectedUser, setSelectedUser] = useState(nurseUsers[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<Omit<MedicationInventoryEntry, 'id'>>({
    category: '予備薬',
    name: '',
    dosage: '',
    stock: 0,
    unit: '錠',
    expirationDate: new Date().toISOString().slice(0, 10),
    prescribedBy: '',
    storage: '',
    notes: '',
  });
  const [toast, setToast] = useState<string | null>(null);

  const inventory = useMemo<MedicationInventoryEntry[]>(
    () => inventoryByUser[selectedUser] ?? [],
    [inventoryByUser, selectedUser],
  );

  const selectedUserInfo = useMemo(
    () => nurseUsers.find((user) => user.id === selectedUser),
    [nurseUsers, selectedUser],
  );
  const selectedUserName = selectedUserInfo?.name ?? '対象者未選択';

  const summary = useMemo(
    () => inventory.reduce<{ total: number; expiring: number; expired: number; ok: number }>((acc, entry) => {
      const status = categorizeStatus(entry);
      if (status === 'expired') acc.expired += 1;
      else if (status === 'expiring') acc.expiring += 1;
      else acc.ok += 1;
      acc.total += 1;
      return acc;
    }, {
      total: 0,
      expiring: 0,
      expired: 0,
      ok: 0,
    }),
    [inventory],
  );

  const filteredInventory = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return inventory.filter((entry) => {
      const status = categorizeStatus(entry);
      if (statusFilter !== 'all' && status !== statusFilter) {
        return false;
      }
      if (!normalized) return true;
      const haystack = [entry.name, entry.dosage, entry.prescribedBy, entry.storage, entry.notes ?? '']
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [inventory, search, statusFilter]);

  const resetForm = () => {
    setForm({
      category: '予備薬',
      name: '',
      dosage: '',
      stock: 0,
      unit: '錠',
      expirationDate: new Date().toISOString().slice(0, 10),
      prescribedBy: '',
      storage: '',
      notes: '',
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedUser) {
      setToast('利用者を選択してください');
      return;
    }
    const nextId = Math.max(0, ...inventory.map((item) => item.id)) + 1;
    setInventoryByUser((prev) => {
      const current = prev[selectedUser] ?? [];
      return {
        ...prev,
        [selectedUser]: [...current, { id: nextId, ...form }],
      };
    });
    setDialogOpen(false);
    resetForm();
    const toastMessage = selectedUserName === '対象者未選択'
      ? '在庫を登録しました'
      : `${selectedUserName} さんの在庫を登録しました`;
    setToast(toastMessage);
  };

  return (
    <Box data-testid={TESTIDS.NURSE_MEDS_PAGE} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
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

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }} data-testid={TESTIDS.NURSE_MEDS_GRID_SUMMARY}>
          <Stack
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
            }}
            spacing={1.5}
          >
            <Stack spacing={0.25}>
              <Typography variant="subtitle2" color="text.secondary">
                対象利用者
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {selectedUserName}
              </Typography>
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
            <Typography variant="subtitle2" color="text.secondary">
              ストック状況
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {summary.total}件
              </Typography>
              <Chip label={`良好 ${summary.ok}`} color="success" size="small" />
              <Chip label={`30日以内 ${summary.expiring}`} color="warning" size="small" />
              <Chip label={`期限切れ ${summary.expired}`} color="error" size="small" />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              消費期限が近いものは週次で確認し、利用者・ご家族と共有してください。
            </Typography>
          </Stack>
        </Grid>
  <Grid size={{ xs: 12, md: 8 }} data-testid={TESTIDS.NURSE_MEDS_GRID_CONTROLS}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'flex-end' }}>
            <TextField
              select
              label="利用者"
              value={selectedUser}
              onChange={(event) => setSelectedUser(event.target.value)}
              sx={{ minWidth: { xs: '100%', md: 200 } }}
              InputLabelProps={{ shrink: true }}
            >
              {nurseUsers.map((user) => (
                <MenuItem key={user.id} value={user.id}>
                  <Stack spacing={0.25}>
                    <Typography>{user.name}</Typography>
                    {user.furigana ? (
                      <Typography variant="caption" color="text.secondary">
                        {user.furigana}
                      </Typography>
                    ) : null}
                  </Stack>
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="薬品／処方医で検索"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              select
              label="期限ステータス"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
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

      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 96 }}>区分</TableCell>
              <TableCell>薬剤名・用法</TableCell>
              <TableCell sx={{ width: 120 }}>在庫</TableCell>
              <TableCell sx={{ width: 160 }}>消費期限</TableCell>
              <TableCell>処方元</TableCell>
              <TableCell>保管場所</TableCell>
              <TableCell>備考</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredInventory.map((entry) => {
              const status = categorizeStatus(entry);
              return (
                <TableRow key={entry.id} hover>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography fontWeight={600}>{entry.category}</Typography>
                      <Chip size="small" label={statusLabel(status)} color={statusColorMap[status]} variant="outlined" />
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight={600}>{entry.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {entry.dosage}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight={600}>{entry.stock} {entry.unit}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography>{entry.expirationDate}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography>{entry.prescribedBy}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography>{entry.storage}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {entry.notes || '—'}
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredInventory.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} sx={{ textAlign: 'center', py: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    条件に合致する在庫がありません。検索条件やステータスを調整してください。
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>服薬ストックを登録</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Stack
              spacing={0.25}
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: 'action.hover',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                対象利用者
              </Typography>
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
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value as MedicationInventoryEntry['category'] }))}
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
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
            <TextField
              label="用法・指示"
              value={form.dosage}
              onChange={(event) => setForm((prev) => ({ ...prev, dosage: event.target.value }))}
              placeholder="例）発熱時 1回2錠 最大1日3回"
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                type="number"
                label="在庫数"
                value={form.stock}
                onChange={(event) => setForm((prev) => ({ ...prev, stock: Number(event.target.value) }))}
                required
                inputProps={{ min: 0 }}
                sx={{ flex: 1 }}
              />
              <TextField
                label="単位"
                value={form.unit}
                onChange={(event) => setForm((prev) => ({ ...prev, unit: event.target.value }))}
                sx={{ width: { xs: '100%', sm: 120 } }}
                required
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                type="date"
                label="消費期限"
                value={form.expirationDate}
                onChange={(event) => setForm((prev) => ({ ...prev, expirationDate: event.target.value }))}
                InputLabelProps={{ shrink: true }}
                required
                sx={{ flex: 1 }}
              />
              <TextField
                label="保管場所"
                value={form.storage}
                onChange={(event) => setForm((prev) => ({ ...prev, storage: event.target.value }))}
                required
                sx={{ flex: 1 }}
              />
            </Stack>
            <TextField
              label="処方医・医療機関"
              value={form.prescribedBy}
              onChange={(event) => setForm((prev) => ({ ...prev, prescribedBy: event.target.value }))}
              required
            />
            <TextField
              label="備考"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              multiline
              minRows={2}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setDialogOpen(false); resetForm(); }}>キャンセル</Button>
            <Button type="submit" variant="contained">
              登録する
            </Button>
          </DialogActions>
        </form>
      </Dialog>

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
