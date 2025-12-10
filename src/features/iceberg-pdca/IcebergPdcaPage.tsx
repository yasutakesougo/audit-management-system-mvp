import { useMemo, useState, type FC } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import type { IcebergPdcaPhase } from './types';
import { mockPdcaItems } from './mockPdcaItems';

const PHASE_LABEL: Record<IcebergPdcaPhase, string> = {
  PLAN: 'PLAN（計画）',
  DO: 'DO（実行）',
  CHECK: 'CHECK（振り返り）',
  ACT: 'ACT（改善）',
};

const PHASE_COLOR: Record<IcebergPdcaPhase, 'default' | 'primary' | 'success' | 'warning' | 'secondary'> = {
  PLAN: 'primary',
  DO: 'success',
  CHECK: 'warning',
  ACT: 'secondary',
};

// TODO: 後で useUsersStore など実データに差し替え予定
const MOCK_USER_NAME_BY_ID: Record<string, string> = {
  U001: 'U001さん（仮）',
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
  const [selectedUserId, setSelectedUserId] = useState<'ALL' | string>('ALL');

  const userOptions = useMemo(() => {
    const ids = Array.from(new Set(mockPdcaItems.map((item) => item.userId)));
    return ids.map((id) => ({ id, label: MOCK_USER_NAME_BY_ID[id] ?? id }));
  }, []);

  const filteredItems = useMemo(
    () => (selectedUserId === 'ALL' ? mockPdcaItems : mockPdcaItems.filter((item) => item.userId === selectedUserId)),
    [selectedUserId]
  );

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
              <MenuItem value="ALL">すべての利用者</MenuItem>
              {userOptions.map((user) => (
                <MenuItem key={user.id} value={user.id}>
                  {user.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Divider />

        {/* PDCA カードリスト */}
        <Stack spacing={2}>
          {filteredItems.map((item) => {
            const phaseLabel = PHASE_LABEL[item.phase] ?? item.phase;
            const phaseColor = PHASE_COLOR[item.phase] ?? 'default';
            const userName = MOCK_USER_NAME_BY_ID[item.userId] ?? item.userId;

            return (
              <Card key={item.id} variant="outlined">
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" mb={1}>
                    <Typography variant="h6" component="h2">
                      {item.title}
                    </Typography>
                    <Chip label={phaseLabel} color={phaseColor} size="small" sx={{ fontWeight: 'bold' }} />
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
    </Box>
  );
};

export default IcebergPdcaPage;
