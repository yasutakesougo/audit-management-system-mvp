/**
 * 申し送り即入力カード
 *
 * 「今すぐ申し送り」機能
 * いつでも画面上部から素早く申し送りを追加可能
 */

import type { IUserMaster } from '@/sharepoint/fields';
import {
    Box,
    Button,
    Card,
    CardActions,
    CardContent,
    CardHeader,
    Chip,
    Divider,
    MenuItem,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useUsersDemo } from '../users/usersStoreDemo';
import type { HandoffCategory, HandoffSeverity } from './handoffTypes';
import { getTimeBandPlaceholder, useCurrentTimeBand } from './useCurrentTimeBand';
import { useHandoffTimeline } from './useHandoffTimeline';

type TargetOption = 'ALL' | IUserMaster;

const CATEGORY_OPTIONS: HandoffCategory[] = [
  '体調',
  '行動面',
  '家族連絡',
  '支援の工夫',
  '良かったこと',
  '事故・ヒヤリ',
  'その他',
];

const SEVERITY_OPTIONS: HandoffSeverity[] = ['通常', '要注意', '重要'];

export const HandoffQuickNoteCard: React.FC = () => {
  const timeBand = useCurrentTimeBand();
  const { createHandoff } = useHandoffTimeline();
  const { data: users } = useUsersDemo();

  const [target, setTarget] = useState<TargetOption>('ALL');
  const [category, setCategory] = useState<HandoffCategory>('体調');
  const [severity, setSeverity] = useState<HandoffSeverity>('通常');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const placeholder = useMemo(() => getTimeBandPlaceholder(timeBand), [timeBand]);

  const handleSubmit = async () => {
    if (!message.trim()) return;

    setSubmitting(true);
    try {
      const userCode = target === 'ALL' ? 'ALL' : target.UserID.toString();
      const userDisplayName = target === 'ALL' ? '全体' : target.FullName;

      await createHandoff({
        userCode,
        userDisplayName,
        category,
        severity,
        timeBand,
        message: message.trim(),
        title: `${userDisplayName} / ${category}`,
      });

      // 送信成功時はフォームをクリア
      setMessage('');

      // カテゴリ・重要度はリセットしない（連続入力しやすくするため）
    } catch (error) {
      console.error('[handoff] Submit failed:', error);
      // エラーハンドリングは useHandoffTimeline で行われている
    } finally {
      setSubmitting(false);
    }
  };

  const isSubmitDisabled = submitting || !message.trim();

  return (
    <Card elevation={2} data-testid="handoff-quicknote-card">
      <CardHeader
        title="📝 今すぐ申し送り"
        subheader="気になったこと・良かったこと・明日につなげたいことを、短くメモしてください"
        titleTypographyProps={{ variant: 'h6', fontWeight: 'bold' }}
      />
      <CardContent>
        <Stack spacing={2}>
          {/* 対象選択 + 時間帯表示 */}
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              select
              label="対象"
              size="small"
              value={target === 'ALL' ? 'ALL' : target.UserID.toString()}
              onChange={e => {
                const value = e.target.value;
                if (value === 'ALL') {
                  setTarget('ALL');
                } else {
                  const user = users.find(u => u.UserID.toString() === value);
                  if (user) setTarget(user);
                }
              }}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="ALL">🌟 全体向け</MenuItem>
              <Divider />
              {users.map(user => (
                <MenuItem key={user.UserID} value={user.UserID.toString()}>
                  {user.FullName}
                </MenuItem>
              ))}
            </TextField>

            <Box sx={{ flexGrow: 1 }} />

            <Chip
              label={`⏰ ${timeBand}`}
              size="small"
              color="primary"
              variant="outlined"
            />
          </Stack>

          {/* カテゴリ選択 */}
          <Box>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
              カテゴリ
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {CATEGORY_OPTIONS.map(opt => (
                <Chip
                  key={opt}
                  label={opt}
                  size="small"
                  variant={opt === category ? 'filled' : 'outlined'}
                  color={opt === category ? 'primary' : 'default'}
                  onClick={() => setCategory(opt)}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Stack>
          </Box>

          {/* 重要度選択 */}
          <Box>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
              重要度
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              {SEVERITY_OPTIONS.map(opt => (
                <Chip
                  key={opt}
                  label={opt}
                  size="small"
                  variant={opt === severity ? 'filled' : 'outlined'}
                  color={
                    opt === '重要'
                      ? 'error'
                      : opt === '要注意'
                      ? 'warning'
                      : 'default'
                  }
                  onClick={() => setSeverity(opt)}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Stack>
          </Box>

          {/* 本文入力 */}
          <TextField
            label="申し送り内容"
            multiline
            minRows={3}
            maxRows={6}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={placeholder}
            fullWidth
            variant="outlined"
            helperText="改行・箇条書きもOKです。簡潔にポイントを記載してください。"
          />
        </Stack>
      </CardContent>
      <Divider />
      <CardActions sx={{ justifyContent: 'flex-end', p: 2 }}>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isSubmitDisabled}
          size="large"
        >
          {submitting ? '送信中…' : 'この内容で登録'}
        </Button>
      </CardActions>
    </Card>
  );
};