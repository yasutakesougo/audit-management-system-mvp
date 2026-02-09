import * as React from 'react';
import {
  Box,
  Button,
  Chip,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import type { MeetingMinutesRepository, MinutesSearchParams } from '../sp/repository';
import type { MeetingCategory } from '../types';
import { useMeetingMinutesList } from '../hooks/useMeetingMinutes';

const CATEGORY_OPTIONS: Array<MeetingCategory | 'ALL'> = [
  'ALL',
  '職員会議',
  '朝会',
  '夕会',
  'ケース会議',
  '委員会',
  'その他',
];

export function MeetingMinutesListPage(props: { repo: MeetingMinutesRepository }) {
  const { repo } = props;

  const [params, setParams] = React.useState<MinutesSearchParams>({
    q: '',
    tag: '',
    category: 'ALL',
    from: '',
    to: '',
    publishedOnly: false,
  });

  const query = useMeetingMinutesList(repo, params);

  const rows = query.data ?? [];

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5">議事録アーカイブ</Typography>
            <Typography variant="body2" color="text.secondary">
              会議の記録を検索・閲覧できます。
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              component={RouterLink}
              to="/meeting-minutes/new?category=朝会"
              variant="outlined"
            >
              ＋ 朝会を作成
            </Button>
            <Button
              component={RouterLink}
              to="/meeting-minutes/new?category=夕会"
              variant="outlined"
            >
              ＋ 夕会を作成
            </Button>
            <Button component={RouterLink} to="/meeting-minutes/new" variant="contained">
              新規作成
            </Button>
          </Stack>
        </Stack>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="検索"
                value={params.q ?? ''}
                onChange={(e) => setParams((prev) => ({ ...prev, q: e.target.value }))}
                placeholder="タイトル・要点・タグ"
                fullWidth
              />
              <TextField
                label="タグ"
                value={params.tag ?? ''}
                onChange={(e) => setParams((prev) => ({ ...prev, tag: e.target.value }))}
                placeholder="送迎 ヒヤリ"
                fullWidth
              />
              <TextField
                label="カテゴリ"
                select
                value={params.category ?? 'ALL'}
                onChange={(e) => setParams((prev) => ({
                  ...prev,
                  category: e.target.value as MeetingCategory | 'ALL',
                }))}
                sx={{ minWidth: 180 }}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option === 'ALL' ? 'すべて' : option}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="開始日"
                type="date"
                value={params.from ?? ''}
                onChange={(e) => setParams((prev) => ({ ...prev, from: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 200 }}
              />
              <TextField
                label="終了日"
                type="date"
                value={params.to ?? ''}
                onChange={(e) => setParams((prev) => ({ ...prev, to: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 200 }}
              />
              <Button
                variant="outlined"
                onClick={() => setParams({
                  q: '',
                  tag: '',
                  category: 'ALL',
                  from: '',
                  to: '',
                  publishedOnly: false,
                })}
              >
                クリア
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {query.isLoading && (
          <Typography color="text.secondary">読み込み中…</Typography>
        )}
        {query.isError && (
          <Typography color="error">取得に失敗しました。</Typography>
        )}

        {!query.isLoading && !query.isError && rows.length === 0 && (
          <Typography color="text.secondary">まだ議事録がありません。</Typography>
        )}

        {!query.isLoading && !query.isError && rows.length > 0 && (
          <Stack spacing={2}>
            {rows.map((row) => (
              <Paper key={row.id} variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1.5}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    justifyContent="space-between"
                    alignItems={{ sm: 'center' }}
                  >
                    <Typography
                      variant="subtitle1"
                      component={RouterLink}
                      to={`/meeting-minutes/${row.id}`}
                      sx={{ textDecoration: 'none', color: 'inherit', fontWeight: 600 }}
                    >
                      {row.title}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Chip size="small" label={row.category} />
                      <Chip size="small" label={row.meetingDate || '日付未設定'} />
                    </Stack>
                  </Stack>

                  <Typography variant="body2" color="text.secondary">
                    {row.summary || '要点が未入力です。'}
                  </Typography>

                  {row.tags && (
                    <Typography variant="caption" color="text.secondary">
                      タグ: {row.tags}
                    </Typography>
                  )}

                  <Divider />

                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button
                      component={RouterLink}
                      to={`/meeting-minutes/${row.id}`}
                      size="small"
                    >
                      詳細
                    </Button>
                    <Button
                      component={RouterLink}
                      to={`/meeting-minutes/${row.id}/edit`}
                      size="small"
                    >
                      編集
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
