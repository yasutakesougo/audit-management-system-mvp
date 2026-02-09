import * as React from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';

import type { MeetingMinutesRepository } from '../sp/repository';
import { useMeetingMinutesDetail } from '../hooks/useMeetingMinutes';
import { useCreateHandoffFromExternalSource } from '@/features/handoff/useCreateHandoffFromExternalSource';
import { useToast } from '@/hooks/useToast';

const renderMultiline = (value?: string) =>
  (value ?? '')
    .split('\n')
    .map((line, index) => (
      <Typography key={`${line}-${index}`} variant="body2" color="text.secondary">
        {line || '　'}
      </Typography>
    ));

export function MeetingMinutesDetailPage(props: { repo: MeetingMinutesRepository }) {
  const { repo } = props;
  const nav = useNavigate();
  const idParam = useParams().id;
  const id = Number(idParam);

  const query = useMeetingMinutesDetail(repo, id);
  const createHandoff = useCreateHandoffFromExternalSource();
  const { show } = useToast();
  const [openSend, setOpenSend] = React.useState(false);
  const [sendSummary, setSendSummary] = React.useState(true);
  const [sendDecisions, setSendDecisions] = React.useState(true);
  const [sendActions, setSendActions] = React.useState(true);
  const [extra, setExtra] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [quickSending, setQuickSending] = React.useState(false);
  const [quickError, setQuickError] = React.useState<string | null>(null);
  const [quickSent, setQuickSent] = React.useState(false);

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="error">IDが不正です。</Typography>
      </Box>
    );
  }

  if (query.isLoading) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>読み込み中…</Typography>
      </Box>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="error">取得に失敗しました。</Typography>
      </Box>
    );
  }

  const minutes = query.data;
  const defaultTimeBand = minutes.category === '朝会' ? '朝' : minutes.category === '夕会' ? '夕方' : '午前';
  const isDailyMeeting = minutes.category === '朝会' || minutes.category === '夕会';

  const buildHandoffPayload = (options: {
    includeSummary: boolean;
    includeDecisions: boolean;
    includeActions: boolean;
    extraText?: string;
  }) => {
    const lines: string[] = [];
    const label = `${minutes.category}（${minutes.meetingDate}）`;
    lines.push(`【${label}】`);
    if (options.includeSummary && minutes.summary) lines.push(`\n■要点\n${minutes.summary}`);
    if (options.includeDecisions && minutes.decisions) lines.push(`\n■決定事項\n${minutes.decisions}`);
    if (options.includeActions && minutes.actions) lines.push(`\n■アクション\n${minutes.actions}`);
    if (options.extraText?.trim()) lines.push(`\n■追記\n${options.extraText.trim()}`);

    const sourceUrl = `/meeting-minutes/${minutes.id}`;
    lines.push(`\n---\n元議事録: ${sourceUrl}`);

    const title = `【${minutes.category}】${minutes.meetingDate}`;
    const body = lines.join('\n');

    return { title, body, sourceUrl };
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5">{minutes.title}</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Chip size="small" label={minutes.category} />
              <Chip size="small" label={minutes.meetingDate || '日付未設定'} />
            </Stack>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button component={RouterLink} to={`/meeting-minutes/${minutes.id}/edit`} variant="contained">
              編集
            </Button>
            {isDailyMeeting && (
              <Button
                variant="contained"
                color="secondary"
                onClick={async () => {
                  setQuickSending(true);
                  setQuickError(null);
                  try {
                    const { title, body, sourceUrl } = buildHandoffPayload({
                      includeSummary: true,
                      includeDecisions: true,
                      includeActions: true,
                    });
                    const result = await createHandoff({
                      title,
                      body,
                      timeBand: defaultTimeBand,
                      source: {
                        sourceType: 'meeting-minutes',
                        sourceId: minutes.id,
                        sourceUrl,
                        sourceKey: `meeting-minutes:${minutes.id}`,
                        sourceLabel: minutes.category,
                      },
                    });
                    if (!result.created) {
                      setQuickSent(true);
                      show('info', '既に送信済みです。');
                      return;
                    }
                    setQuickSent(true);
                    show('success', '申し送りに送信しました。');
                  } catch (error) {
                    console.error('[meeting-minutes] quick handoff send failed:', error);
                    setQuickError('送信に失敗しました。もう一度お試しください。');
                  } finally {
                    setQuickSending(false);
                  }
                }}
                disabled={quickSending || quickSent}
                startIcon={quickSending ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                {quickSent ? '送信済み' : quickSending ? '送信中…' : 'ワンクリック申し送り'}
              </Button>
            )}
            <Button variant="outlined" onClick={() => setOpenSend(true)}>
              申し送りに送る
            </Button>
            <Button variant="outlined" onClick={() => nav(-1)}>
              戻る
            </Button>
          </Stack>
        </Stack>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            {quickError && (
              <Typography color="error">{quickError}</Typography>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2">司会</Typography>
                <Typography variant="body2" color="text.secondary">
                  {minutes.chair || '未設定'}
                </Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2">書記</Typography>
                <Typography variant="body2" color="text.secondary">
                  {minutes.scribe || '未設定'}
                </Typography>
              </Box>
            </Stack>

            <Divider />

            <Box>
              <Typography variant="subtitle2">要点（Summary）</Typography>
              {renderMultiline(minutes.summary || '未入力')}
            </Box>

            <Box>
              <Typography variant="subtitle2">決定事項（Decisions）</Typography>
              {renderMultiline(minutes.decisions || '未入力')}
            </Box>

            <Box>
              <Typography variant="subtitle2">アクション（Actions）</Typography>
              {renderMultiline(minutes.actions || '未入力')}
            </Box>

            <Box>
              <Typography variant="subtitle2">タグ</Typography>
              <Typography variant="body2" color="text.secondary">
                {minutes.tags || '未設定'}
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2">関連リンク</Typography>
              {renderMultiline(minutes.relatedLinks || '未設定')}
            </Box>
          </Stack>
        </Paper>
      </Stack>

      <Dialog open={openSend} onClose={() => (!sending ? setOpenSend(false) : undefined)} maxWidth="sm" fullWidth>
        <DialogTitle>申し送りに送る</DialogTitle>
        <DialogContent dividers>
          <FormControlLabel
            control={<Checkbox checked={sendSummary} onChange={(e) => setSendSummary(e.target.checked)} />}
            label="要点（Summary）"
          />
          <FormControlLabel
            control={<Checkbox checked={sendDecisions} onChange={(e) => setSendDecisions(e.target.checked)} />}
            label="決定事項（Decisions）"
          />
          <FormControlLabel
            control={<Checkbox checked={sendActions} onChange={(e) => setSendActions(e.target.checked)} />}
            label="アクション（Actions）"
          />
          <TextField
            label="追記（任意）"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            fullWidth
            multiline
            minRows={3}
            sx={{ mt: 2 }}
          />
          {sendError && (
            <Typography color="error" sx={{ mt: 1 }}>
              {sendError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSend(false)} disabled={sending}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            disabled={sending || (!sendSummary && !sendDecisions && !sendActions)}
            onClick={async () => {
              setSending(true);
              setSendError(null);
              try {
                const { title, body, sourceUrl } = buildHandoffPayload({
                  includeSummary: sendSummary,
                  includeDecisions: sendDecisions,
                  includeActions: sendActions,
                  extraText: extra,
                });

                const result = await createHandoff({
                  title,
                  body,
                  timeBand: defaultTimeBand,
                  source: {
                    sourceType: 'meeting-minutes',
                    sourceId: minutes.id,
                    sourceUrl,
                    sourceKey: `meeting-minutes:${minutes.id}`,
                    sourceLabel: minutes.category,
                  },
                });

                if (!result.created) {
                  setSendError('既に送信済みです。');
                  show('info', '既に送信済みです。');
                  return;
                }

                setQuickSent(true);
                show('success', '申し送りに送信しました。');

                setOpenSend(false);
                setExtra('');
              } catch (error) {
                console.error('[meeting-minutes] handoff send failed:', error);
                setSendError('送信に失敗しました。もう一度お試しください。');
              } finally {
                setSending(false);
              }
            }}
          >
            {sending ? '送信中…' : '送信'}
          </Button>
        </DialogActions>
      </Dialog>
            startIcon={sending ? <CircularProgress size={16} color="inherit" /> : undefined}
    </Box>
  );
}
