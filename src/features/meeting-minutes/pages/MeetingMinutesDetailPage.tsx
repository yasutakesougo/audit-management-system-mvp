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
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import * as React from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';

import { useCreateHandoffFromExternalSource } from '@/features/handoff/useCreateHandoffFromExternalSource';
import { useToast } from '@/hooks/useToast';
import { useMeetingMinutesDetail } from '../hooks/useMeetingMinutes';
import type { MeetingMinutesRepository } from '../sp/repository';
import { auditLog } from '@/lib/debugLogger';
import { MeetingMinutesBlockViewer } from '../components/MeetingMinutesBlockViewer';
import { buildHandoffPayload } from '../editor/buildHandoffPayload';
import { HANDOFF_TEMPLATES, type HandoffAudience } from '../editor/handoffTemplates';
import { MeetingMinutesPrintPreview } from '../export/components/MeetingMinutesPrintPreview';
import { buildMeetingMinutesExportModel } from '../export/buildMeetingMinutesExportModel';
import { useMeetingMinutesPdfExport } from '../export/pdf/useMeetingMinutesPdfExport';
import { buildMeetingMinutesPdfFileName } from '../export/pdf/buildMeetingMinutesPdfFileName';
import { useMeetingMinutesSharePointExport } from '../export/sharepoint/useMeetingMinutesSharePointExport';
import { SharePointSaveResultActions } from '../export/sharepoint/SharePointSaveResultActions';

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
  const [audience, setAudience] = React.useState<HandoffAudience>('field');
  const [sendSummary, setSendSummary] = React.useState(HANDOFF_TEMPLATES.field.defaultSelection.includeSummary);
  const [sendDecisions, setSendDecisions] = React.useState(HANDOFF_TEMPLATES.field.defaultSelection.includeDecisions);
  const [sendActions, setSendActions] = React.useState(HANDOFF_TEMPLATES.field.defaultSelection.includeActions);
  const [sendReports, setSendReports] = React.useState(HANDOFF_TEMPLATES.field.defaultSelection.includeReports);
  const [sendNotifications, setSendNotifications] = React.useState(HANDOFF_TEMPLATES.field.defaultSelection.includeNotifications);
  const [extra, setExtra] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [quickSending, setQuickSending] = React.useState(false);
  const [quickError, setQuickError] = React.useState<string | null>(null);
  const [quickSent, setQuickSent] = React.useState(false);
  const [openPreview, setOpenPreview] = React.useState(false);

  const { exportAsPdf } = useMeetingMinutesPdfExport();
  const { saveToSharePoint, isSaving: isSavingToSP, error: saveErrorSP, lastSavedFile, clearLastSavedFile } = useMeetingMinutesSharePointExport();

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
  const hasBlocks = (minutes.contentBlocks ?? []).length > 0;

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
                    const template = HANDOFF_TEMPLATES.field;
                    const { title, body, sourceUrl } = buildHandoffPayload(minutes, {
                      ...template.defaultSelection,
                      sectionOrder: template.sectionOrder,
                      audience: 'field',
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
                    auditLog.error('meeting-minutes', 'quick_handoff_send_failed', { error: String(error) });
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
            <Button variant="outlined" onClick={() => {
              clearLastSavedFile();
              setOpenPreview(true);
            }}>
              印刷 / PDF保存
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

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>参加者</Typography>
              {(minutes.attendees ?? []).length > 0 ? (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {(minutes.attendees ?? []).map((name) => (
                    <Chip key={name} label={name} size="small" color="primary" variant="outlined" />
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">記録なし</Typography>
              )}
            </Box>

            {isDailyMeeting && (minutes.staffAttendance || minutes.userHealthNotes) && (
              <>
                <Divider />
                {minutes.staffAttendance && (
                  <Box>
                    <Typography variant="subtitle2">
                      {minutes.category === '朝会' ? '👥 職員の出欠・配置確認' : '👥 夜勤・翌日の配置'}
                    </Typography>
                    {renderMultiline(minutes.staffAttendance)}
                  </Box>
                )}
                {minutes.userHealthNotes && (
                  <Box>
                    <Typography variant="subtitle2">
                      {minutes.category === '朝会' ? '🏥 利用者の体調・特記事項' : '🏥 日中の利用者の様子'}
                    </Typography>
                    {renderMultiline(minutes.userHealthNotes)}
                  </Box>
                )}
              </>
            )}

            <Divider />

            {/* ── 本文: contentBlocks があればブロック表示、なければ legacy ── */}
            {hasBlocks ? (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>議事録本文</Typography>
                <MeetingMinutesBlockViewer blocks={minutes.contentBlocks!} />
              </Box>
            ) : (
              <>
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
              </>
            )}

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
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>送信先テンプレート（順序と初期項目の提案）</Typography>
            <ToggleButtonGroup
              color="primary"
              value={audience}
              exclusive
              onChange={(e, newValue: HandoffAudience | null) => {
                if (newValue !== null) {
                  setAudience(newValue);
                  const template = HANDOFF_TEMPLATES[newValue];
                  setSendSummary(template.defaultSelection.includeSummary);
                  setSendReports(template.defaultSelection.includeReports);
                  setSendDecisions(template.defaultSelection.includeDecisions);
                  setSendActions(template.defaultSelection.includeActions);
                  setSendNotifications(template.defaultSelection.includeNotifications);
                }
              }}
              fullWidth
              size="small"
            >
              <ToggleButton value="field">現場申し送り</ToggleButton>
              <ToggleButton value="admin">管理者共有</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Typography variant="subtitle2" sx={{ mb: 1 }}>セクションの個別調整（手動で変更可能）</Typography>
          <Stack>
          <FormControlLabel
            control={<Checkbox checked={sendSummary} onChange={(e) => setSendSummary(e.target.checked)} />}
            label="要点（Summary）"
          />
          <FormControlLabel
            control={<Checkbox checked={sendReports} onChange={(e) => setSendReports(e.target.checked)} />}
            label="報告（Reports）"
          />
          <FormControlLabel
            control={<Checkbox checked={sendDecisions} onChange={(e) => setSendDecisions(e.target.checked)} />}
            label="決定事項（Decisions）"
          />
          <FormControlLabel
            control={<Checkbox checked={sendActions} onChange={(e) => setSendActions(e.target.checked)} />}
            label="アクション（Actions）"
          />
          <FormControlLabel
            control={<Checkbox checked={sendNotifications} onChange={(e) => setSendNotifications(e.target.checked)} />}
            label="連絡事項（Notifications）"
          />
          </Stack>
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
            disabled={sending || (!sendSummary && !sendDecisions && !sendActions && !sendReports && !sendNotifications)}
            startIcon={sending ? <CircularProgress size={16} color="inherit" /> : undefined}
            onClick={async () => {
              setSending(true);
              setSendError(null);
              try {
                const { title, body, sourceUrl } = buildHandoffPayload(minutes, {
                  includeSummary: sendSummary,
                  includeDecisions: sendDecisions,
                  includeActions: sendActions,
                  includeReports: sendReports,
                  includeNotifications: sendNotifications,
                  extraText: extra,
                  sectionOrder: HANDOFF_TEMPLATES[audience].sectionOrder,
                  audience,
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
                auditLog.error('meeting-minutes', 'handoff_send_failed', { error: String(error) });
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

      {/* Print Preview Dialog */}
      <Dialog
        open={openPreview}
        onClose={() => setOpenPreview(false)}
        maxWidth="md"
        fullWidth
        sx={{
          '@media print': {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            m: 0,
            p: 0,
            boxShadow: 'none',
            '& .MuiDialog-container': {
              height: 'auto',
            },
            '& .MuiPaper-root': {
              boxShadow: 'none',
              m: 0,
              p: 0,
              maxWidth: '100%',
              width: '100%',
            },
          },
        }}
      >
        <DialogTitle sx={{ '@media print': { display: 'none' } }}>
          印刷 / PDF保存
        </DialogTitle>
        <DialogContent dividers sx={{ '@media print': { border: 'none', p: 0, overflow: 'visible' } }}>
          <Box sx={{ mb: 2, '@media print': { display: 'none' } }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>出力ファイル名:</strong> {buildMeetingMinutesPdfFileName({
                title: minutes.title,
                meetingDate: minutes.meetingDate,
                audience,
              })}
            </Typography>
            {saveErrorSP && (
              <Typography variant="body2" color="error" sx={{ mb: 1 }}>
                保存エラー: {saveErrorSP}
              </Typography>
            )}
            <ToggleButtonGroup
              color="primary"
              value={audience}
              exclusive
              onChange={(e, newValue: HandoffAudience | null) => {
                if (newValue !== null) setAudience(newValue);
              }}
              size="small"
            >
              <ToggleButton value="field">現場向け</ToggleButton>
              <ToggleButton value="admin">管理者向け</ToggleButton>
            </ToggleButtonGroup>
            {lastSavedFile && (
              <SharePointSaveResultActions 
                result={lastSavedFile} 
                onClear={clearLastSavedFile} 
                title={minutes.title}
                meetingDate={minutes.meetingDate}
                audience={audience}
              />
            )}
          </Box>
          <Box className="print-content" sx={{ p: 2 }}>
            <MeetingMinutesPrintPreview
              model={buildMeetingMinutesExportModel({ minutes, audience })}
              audience={audience}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ '@media print': { display: 'none' } }}>
          <Button onClick={() => setOpenPreview(false)} disabled={isSavingToSP}>閉じる</Button>
          <Button 
            variant="outlined" 
            disabled={isSavingToSP}
            startIcon={isSavingToSP ? <CircularProgress size={16} /> : undefined}
            onClick={async () => {
              try {
                const res = await saveToSharePoint({
                  model: buildMeetingMinutesExportModel({ minutes, audience }),
                  audience,
                });
                if (res) {
                  show('success', `SharePoint に保存しました: ${res.fileName}`);
                }
              } catch {
                // error is handled by hook and shown in UI
              }
            }}
          >
            SharePointに保存
          </Button>
          <Button 
            variant="contained" 
            disabled={isSavingToSP}
            onClick={() => exportAsPdf({
              model: buildMeetingMinutesExportModel({ minutes, audience }),
              audience,
            })}
          >
            PDFとして保存 (印刷)
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
