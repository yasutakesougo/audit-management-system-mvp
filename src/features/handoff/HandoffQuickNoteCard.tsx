/**
 * 申し送り即入力カード
 *
 * 「今すぐ申し送り」機能
 * いつでも画面上部から素早く申し送りを追加可能
 * v2: 送信成功フィードバック（✅ 送信しました！）
 */

import type { IUserMaster } from '@/sharepoint/fields';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
    Alert,
    Box,
    Button,
    Card,
    CardActions,
    CardContent,
    CardHeader,
    Chip,
    Collapse,
    Divider,
    MenuItem,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUsersQuery } from '@/features/users/hooks/useUsersQuery';
import { getSeverityColor, getStatusColor } from './handoffConstants';
import type { HandoffCategory, HandoffRecord, HandoffSeverity } from './handoffTypes';
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

/** 送信フィードバックの表示時間 (ms) */
const SUCCESS_DISPLAY_MS = 3000;

const RECENT_HANDOFF_LIMIT = 5;
const MESSAGE_PREVIEW_LENGTH = 60;

function toPlainPreview(message: string): string {
  const normalized = message.trim();
  const plainText = normalized.includes('<') && typeof DOMParser !== 'undefined'
    ? new DOMParser().parseFromString(normalized, 'text/html').body.textContent ?? normalized
    : normalized;
  const compact = plainText.replace(/\s+/g, ' ').trim();

  if (compact.length <= MESSAGE_PREVIEW_LENGTH) {
    return compact;
  }

  return `${compact.substring(0, MESSAGE_PREVIEW_LENGTH)}…`;
}

export const HandoffQuickNoteCard: React.FC = () => {
  const timeBand = useCurrentTimeBand();
  const {
    createHandoff,
    allHandoffs,
    loading: handoffsLoading,
    error: handoffsError,
  } = useHandoffTimeline();
  const { data: users } = useUsersQuery();

  // UserRelation: O(1) ルックアップ
  const userLookup = useMemo(() => {
    const map = new Map<string, IUserMaster>();
    for (const u of users) {
      map.set(u.UserID.toString(), u);
    }
    return map;
  }, [users]);

  const [target, setTarget] = useState<TargetOption>('ALL');
  const [category, setCategory] = useState<HandoffCategory>('体調');
  const [severity, setSeverity] = useState<HandoffSeverity>('通常');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // v2: 送信結果フィードバック
  const [submitResult, setSubmitResult] = useState<'success' | 'error' | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // 自動非表示タイマーのクリーンアップ
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const showFeedback = useCallback((result: 'success' | 'error') => {
    setSubmitResult(result);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSubmitResult(null), SUCCESS_DISPLAY_MS);
  }, []);

  const placeholder = useMemo(() => getTimeBandPlaceholder(timeBand), [timeBand]);
  const recentHandoffs = useMemo<HandoffRecord[]>(() => {
    return [...allHandoffs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, RECENT_HANDOFF_LIMIT);
  }, [allHandoffs]);

  const handleSubmit = async () => {
    if (!message.trim()) return;

    setSubmitting(true);
    setSubmitResult(null);
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

      // 送信成功時はフォームをクリア + フィードバック表示
      setMessage('');
      showFeedback('success');

      // カテゴリ・重要度はリセットしない（連続入力しやすくするため）
    } catch {
      showFeedback('error');
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
          {/* v2: 送信結果フィードバック */}
          <Collapse in={submitResult !== null}>
            {submitResult === 'success' && (
              <Alert
                severity="success"
                icon={<CheckCircleIcon fontSize="inherit" />}
                onClose={() => setSubmitResult(null)}
                sx={{
                  fontWeight: 600,
                  '& .MuiAlert-message': { fontSize: '0.95rem' },
                }}
              >
                ✅ 送信しました！タイムラインに反映されました。
              </Alert>
            )}
            {submitResult === 'error' && (
              <Alert
                severity="error"
                onClose={() => setSubmitResult(null)}
                sx={{ fontWeight: 600 }}
              >
                ⚠️ 送信に失敗しました。もう一度お試しください。
              </Alert>
            )}
          </Collapse>

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
                  const user = userLookup.get(value);
                  if (user) setTarget(user);
                }
              }}
              sx={{ minWidth: 200 }}
              SelectProps={{
                // Dialog 内 select の menu を portal せず同一ツリーに描画して
                // 親 Dialog への aria-hidden 適用を避ける。
                MenuProps: { disablePortal: true },
              }}
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

          <Divider />

          <Box>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              gap={1}
              sx={{ mb: 1 }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                最近の申し送り
              </Typography>
              <Button
                href="/handoff-timeline"
                size="small"
                endIcon={<OpenInNewIcon fontSize="small" />}
                sx={{ whiteSpace: 'nowrap' }}
              >
                詳細を見る
              </Button>
            </Stack>

            {handoffsLoading && (
              <Typography variant="body2" color="text.secondary">
                申し送りを読み込み中...
              </Typography>
            )}

            {!handoffsLoading && handoffsError && (
              <Alert severity="warning" sx={{ mb: 1 }}>
                最近の申し送りを読み込めませんでした。
              </Alert>
            )}

            {!handoffsLoading && !handoffsError && recentHandoffs.length === 0 && (
              <Box
                sx={{
                  py: 2,
                  px: 1.5,
                  bgcolor: 'grey.50',
                  border: '1px dashed',
                  borderColor: 'grey.300',
                  borderRadius: 1,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  まだ入力された申し送りはありません。
                </Typography>
              </Box>
            )}

            {!handoffsLoading && recentHandoffs.length > 0 && (
              <Stack spacing={1}>
                {recentHandoffs.map(item => (
                  <Box
                    key={item.id}
                    sx={{
                      p: 1.25,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Stack spacing={0.75}>
                      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Chip
                          label={item.severity}
                          size="small"
                          color={getSeverityColor(item.severity)}
                          variant={item.severity === '通常' ? 'outlined' : 'filled'}
                        />
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {item.userDisplayName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          /
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {item.category}
                        </Typography>
                        <Chip
                          label={item.status}
                          size="small"
                          color={getStatusColor(item.status)}
                          variant="outlined"
                        />
                      </Stack>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ lineHeight: 1.6 }}
                      >
                        {toPlainPreview(item.message)}
                      </Typography>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
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
