import { useMemo, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useUsersStore } from '@/features/users/store';
import type { IcebergPdcaItem, IcebergPdcaPhase } from './types';
import { mockPdcaItems } from './mockPdcaItems';

const PHASE_LABEL: Record<IcebergPdcaPhase, string> = {
  PLAN: 'PLAN（計画）',
  DO: 'DO（実行）',
  CHECK: 'CHECK（評価）',
  ACT: 'ACT（改善）',
};

const phaseColor = (phase: IcebergPdcaPhase): 'default' | 'primary' | 'success' | 'warning' | 'secondary' => {
  switch (phase) {
    case 'PLAN':
      return 'primary';
    case 'DO':
      return 'success';
    case 'CHECK':
      return 'warning';
    case 'ACT':
      return 'secondary';
    default:
      return 'default';
  }
};

const formatJpDateTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  return d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const IcebergPdcaPage: FC = () => {
  const navigate = useNavigate();
  const { data: users = [] } = useUsersStore();
  const [items, setItems] = useState<IcebergPdcaItem[]>(() => mockPdcaItems);
  const [selectedUserId, setSelectedUserId] = useState<'ALL' | string>('ALL');
  const [editingItem, setEditingItem] = useState<IcebergPdcaItem | null>(null);
  const [isDialogOpen, setDialogOpen] = useState(false);

  const resolveUserId = (user: unknown): string | undefined => {
    if (typeof user !== 'object' || user === null) return undefined;
    const candidate = (user as Record<string, unknown>).UserID
      ?? (user as Record<string, unknown>).userId
      ?? (user as Record<string, unknown>).userCode;
    return typeof candidate === 'string' ? candidate : undefined;
  };

  const resolveUserName = (user: unknown): string | undefined => {
    if (typeof user !== 'object' || user === null) return undefined;
    const record = user as Record<string, unknown>;
    const candidate = record.FullName ?? record.fullName ?? record.displayName ?? record.shortName;
    return typeof candidate === 'string' ? candidate : undefined;
  };

  const getUserDisplayName = (userId: string): string => {
    const user = users.find((u) => resolveUserId(u) === userId);
    if (!user) {
      return `利用者ID: ${userId}`;
    }
    const name = resolveUserName(user);
    return name ?? `利用者ID: ${userId}`;
  };

  const userOptions = useMemo(() => {
    const mapped = users.map((u) => {
      const id = resolveUserId(u) ?? 'unknown';
      const label = resolveUserName(u) ?? `利用者ID: ${id}`;
      return { value: id, label };
    });
    return [{ value: 'ALL', label: 'すべての利用者' }, ...mapped];
  }, [users]);

  const filteredItems = useMemo(
    () => (selectedUserId === 'ALL' ? items : items.filter((item) => item.userId === selectedUserId)),
    [items, selectedUserId]
  );

  const isEditingExisting = Boolean(editingItem && items.some((i) => i.id === editingItem.id));

  const handleOpenNew = (): void => {
    const nowIso = new Date().toISOString();
    const defaultUser = selectedUserId !== 'ALL' ? selectedUserId : userOptions[1]?.value ?? 'U001';
    const draft: IcebergPdcaItem = {
      id: `pdca-${Date.now()}`,
      userId: defaultUser,
      title: '',
      phase: 'PLAN',
      summary: '',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    setEditingItem(draft);
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: IcebergPdcaItem): void => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleOpenIceberg = (userId: string): void => {
    const params = new URLSearchParams({ userId });
    navigate(`/iceberg?${params.toString()}`);
  };

  const handleOpenDailySupport = (item: IcebergPdcaItem): void => {
    const params = new URLSearchParams();
    params.set('user', item.userId);

    if (item.createdAt) {
      const ymd = item.createdAt.slice(0, 10);
      params.set('recordDate', ymd);
    }

    navigate(`/daily/support?${params.toString()}`);
  };

  const handleCloseDialog = (): void => {
    setDialogOpen(false);
    setEditingItem(null);
  };

  const handleChangeField = <K extends keyof IcebergPdcaItem>(key: K, value: IcebergPdcaItem[K]): void => {
    setEditingItem((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = (): void => {
    if (!editingItem) return;
    const nowIso = new Date().toISOString();
    const next: IcebergPdcaItem = { ...editingItem, updatedAt: nowIso };

    setItems((prev) => {
      const exists = prev.some((i) => i.id === next.id);
      if (exists) {
        return prev.map((i) => (i.id === next.id ? next : i));
      }
      return [...prev, next];
    });

    setDialogOpen(false);
    setEditingItem(null);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={2}>
        {/* ヘッダー */}
        <Box>
          <Typography variant="h4" gutterBottom>
            氷山 PDCA（プレビュー）
          </Typography>
          <Typography variant="body2" color="text.secondary">
            生活介護事業所の支援場面を「氷山モデル」で整理しながら、PLAN / DO / CHECK / ACT のサイクルで
            振り返るための試験的な画面です。現時点ではモックデータのみを表示しています。
          </Typography>
        </Box>

        {/* 絞り込み */}
        <Box>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="pdca-user-filter-label">利用者で絞り込み</InputLabel>
            <Select
              labelId="pdca-user-filter-label"
              label="利用者で絞り込み"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              {userOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button variant="contained" onClick={handleOpenNew} sx={{ ml: 2 }}>
            PDCA を追加
          </Button>
        </Box>

        <Divider />

        {/* PDCA カードリスト */}
        <Stack spacing={2}>
          {filteredItems.map((item) => {
            const phaseLabel = PHASE_LABEL[item.phase] ?? item.phase;
            const chipColor = phaseColor(item.phase);
            const userName = getUserDisplayName(item.userId);

            return (
              <Card
                key={item.id}
                data-testid="pdca-item-card"
                variant="outlined"
                onClick={() => handleOpenEdit(item)}
                sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
              >
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" mb={1}>
                    <Typography variant="h6" component="h2">
                      {item.title || '（タイトル未設定）'}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip label={phaseLabel} color={chipColor} size="small" sx={{ fontWeight: 'bold' }} />
                      <Button
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDailySupport(item);
                        }}
                        data-testid="pdca-open-daily-support"
                      >
                        日次記録を見る
                      </Button>
                      <Button
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenIceberg(item.userId);
                        }}
                        data-testid="pdca-open-iceberg"
                      >
                        氷山を見る
                      </Button>
                      <Button
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(item);
                        }}
                        data-testid="pdca-edit"
                      >
                        編集
                      </Button>
                    </Stack>
                  </Stack>

                  <Typography variant="body2" color="text.secondary" mb={0.5}>
                    対象利用者：{userName}
                  </Typography>

                  <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                    作成日：{formatJpDateTime(item.createdAt)} ／ 最終更新：{formatJpDateTime(item.updatedAt)}
                  </Typography>

                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {item.summary}
                  </Typography>
                </CardContent>
              </Card>
            );
          })}

          {filteredItems.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              選択された利用者のPDCAデータはまだありません。
            </Typography>
          )}
        </Stack>
      </Stack>

      <Dialog open={isDialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="sm">
        <DialogTitle>{isEditingExisting ? 'PDCA を編集' : 'PDCA を追加'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="タイトル"
            value={editingItem?.title ?? ''}
            onChange={(e) => handleChangeField('title', e.target.value)}
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel id="pdca-phase-label">フェーズ</InputLabel>
            <Select
              labelId="pdca-phase-label"
              label="フェーズ"
              value={editingItem?.phase ?? 'PLAN'}
              onChange={(e) => handleChangeField('phase', e.target.value as IcebergPdcaPhase)}
            >
              <MenuItem value="PLAN">PLAN（計画）</MenuItem>
              <MenuItem value="DO">DO（実行）</MenuItem>
              <MenuItem value="CHECK">CHECK（評価）</MenuItem>
              <MenuItem value="ACT">ACT（改善）</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="サマリ / 一言メモ"
            value={editingItem?.summary ?? ''}
            onChange={(e) => handleChangeField('summary', e.target.value)}
            fullWidth
            multiline
            minRows={3}
          />
          {editingItem && (
            <Typography variant="caption" color="text.secondary">
              作成: {formatJpDateTime(editingItem.createdAt)} ／ 最終更新: {formatJpDateTime(editingItem.updatedAt)}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>キャンセル</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!editingItem || !editingItem.title.trim()}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default IcebergPdcaPage;
