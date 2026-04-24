/**
 * LogTab — ABC 記録一覧 + フィルタ + 詳細/編集ダイアログ
 *
 * 利用者別・日付・強度・危険度で絞り込み、詳細閲覧・編集・削除ができる。
 */
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildIcebergPdcaUrl } from '@/app/links/navigationLinks';

// ── MUI ──
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

// ── Icons ──
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import BubbleChartRoundedIcon from '@mui/icons-material/BubbleChartRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

// ── Domain ──
import type { AbcRecord } from '@/domain/abc/abcRecord';
import { ABC_INTENSITY_VALUES, ABC_INTENSITY_DISPLAY } from '@/domain/abc/abcRecord';
import type { AbcIntensity } from '@/domain/abc/abcRecord';
import { localEvidenceLinkRepository } from '@/infra/localStorage/localEvidenceLinkRepository';
import { getStrategyUsagesForAbcRecord } from '@/domain/isp/reverseTrace';
import type { StrategyUsageSummary } from '@/domain/isp/reverseTrace';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useConfirmDialog } from '@/components/ui/useConfirmDialog';
import { useAbcRecordOrchestrator } from './hooks/orchestrators/useAbcRecordOrchestrator';

// ── Local ──
import type { UserOption } from './types';
import { type DateRangePreset, getDateRange, DATE_PRESET_LABELS, intensityColor } from './helpers';

interface LogTabProps {
  records: AbcRecord[];
  users: UserOption[];
  onRefresh: () => void;
  /** ディープリンクで自動表示するrecord ID */
  focusedRecordId?: string;
  /** ディープリンクバナー表示 */
  deepLinkBanner?: boolean;
}

const LogTab: React.FC<LogTabProps> = ({ records, users, onRefresh, focusedRecordId, deepLinkBanner }) => {
  const navigate = useNavigate();

  // ── Filters ──
  const [filterUser, setFilterUser] = useState<UserOption | null>(null);
  const [filterIntensity, setFilterIntensity] = useState<AbcIntensity | ''>('');
  const [filterRiskOnly, setFilterRiskOnly] = useState(false);
  const [datePreset, setDatePreset] = useState<DateRangePreset>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // ── Detail / Edit dialog ──
  const [detailRecord, setDetailRecord] = useState<AbcRecord | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<AbcRecord>>({});
  const [editSaving, setEditSaving] = useState(false);

  // ── Reverse Trace (Phase 4) ──
  const [reverseTrace, setReverseTrace] = useState<StrategyUsageSummary | null>(null);

  useEffect(() => {
    if (detailRecord && !isEditing) {
      const allMaps = localEvidenceLinkRepository.getAll();
      const summary = getStrategyUsagesForAbcRecord(detailRecord.id, allMaps);
      setReverseTrace(summary);
    } else {
      setReverseTrace(null);
    }
  }, [detailRecord, isEditing]);

  // ── Deep link: focusedRecordId → 自動で詳細ダイアログを開く ──
  const [deepLinkDone, setDeepLinkDone] = useState(false);
  useEffect(() => {
    if (!focusedRecordId || deepLinkDone || records.length === 0) return;
    const target = records.find(r => r.id === focusedRecordId);
    if (target) {
      setDetailRecord(target);
      setIsEditing(false);
    }
    setDeepLinkDone(true);
  }, [focusedRecordId, records, deepLinkDone]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    records.forEach(r => r.tags.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [records]);

  const filteredRecords = useMemo(() => {
    let result = records;
    if (filterUser) result = result.filter(r => r.userId === filterUser.id);
    if (filterIntensity) result = result.filter(r => r.intensity === filterIntensity);
    if (filterRiskOnly) result = result.filter(r => r.riskFlag);
    const range = datePreset === 'custom'
      ? (customStart && customEnd ? { start: customStart, end: customEnd } : null)
      : getDateRange(datePreset);
    if (range) {
      result = result.filter(r => {
        const d = r.occurredAt.slice(0, 10);
        return d >= range.start && d <= range.end;
      });
    }
    if (filterTags.length > 0) {
      result = result.filter(r => filterTags.some(t => r.tags.includes(t)));
    }
    return result;
  }, [records, filterUser, filterIntensity, filterRiskOnly, datePreset, customStart, customEnd, filterTags]);

  const deleteConfirm = useConfirmDialog();

  const { handleUpdateRecord, handleDeleteRecord } = useAbcRecordOrchestrator({
    onRefresh,
    setSaving: setEditSaving,
  });

  const handleDelete = useCallback(async (id: string) => {
    deleteConfirm.open({
      title: 'ABC 記録を削除',
      message: 'この記録を削除しますか？この操作は元に戻せません。',
      severity: 'error',
      confirmLabel: '削除',
      onConfirm: async () => {
        await handleDeleteRecord(id);
        setDetailRecord(null);
      },
    });
  }, [handleDeleteRecord, deleteConfirm]);

  const startEdit = useCallback(() => {
    if (!detailRecord) return;
    setEditForm({ ...detailRecord });
    setIsEditing(true);
  }, [detailRecord]);

  const cancelEdit = useCallback(() => { setIsEditing(false); setEditForm({}); }, []);

  const saveEdit = useCallback(async () => {
    if (!detailRecord || !editForm) return;
    
    const updated = await handleUpdateRecord(detailRecord.id, {
      occurredAt: editForm.occurredAt ?? detailRecord.occurredAt,
      setting: editForm.setting ?? detailRecord.setting,
      antecedent: editForm.antecedent ?? detailRecord.antecedent,
      behavior: editForm.behavior ?? detailRecord.behavior,
      consequence: editForm.consequence ?? detailRecord.consequence,
      intensity: editForm.intensity ?? detailRecord.intensity,
      durationMinutes: editForm.durationMinutes ?? detailRecord.durationMinutes,
      riskFlag: editForm.riskFlag ?? detailRecord.riskFlag,
      tags: editForm.tags ?? detailRecord.tags,
      notes: editForm.notes ?? detailRecord.notes,
    });
    
    if (updated) setDetailRecord(updated);
    setIsEditing(false);
  }, [detailRecord, editForm, handleUpdateRecord]);

  const activeFilterCount = [filterUser, filterIntensity, filterRiskOnly, datePreset !== 'all', filterTags.length > 0].filter(Boolean).length;

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
        <Typography variant="body2" color="text.secondary">
          {filteredRecords.length === records.length ? `${records.length} 件の記録` : `${filteredRecords.length} / ${records.length} 件`}
        </Typography>
        <Button size="small" startIcon={<FilterListRoundedIcon />} onClick={() => setShowFilters(s => !s)} color={activeFilterCount > 0 ? 'primary' : 'inherit'}>
          絞り込み{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </Button>
      </Stack>

      {showFilters && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
              <Autocomplete
                disablePortal
                options={users}
                value={filterUser}
                onChange={(_, v) => setFilterUser(v)}
                getOptionLabel={o => o.label}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                renderInput={params => <TextField {...params} label="利用者" size="small" />}
                sx={{ flex: 2 }}
                noOptionsText="該当なし"
              />
              <TextField select label="強度" value={filterIntensity} onChange={e => setFilterIntensity(e.target.value as AbcIntensity | '')} size="small" sx={{ minWidth: 100 }}>
                <MenuItem value="">すべて</MenuItem>
                {ABC_INTENSITY_VALUES.map(v => <MenuItem key={v} value={v}>{ABC_INTENSITY_DISPLAY[v]}</MenuItem>)}
              </TextField>
              <FormControlLabel control={<Switch checked={filterRiskOnly} onChange={e => setFilterRiskOnly(e.target.checked)} color="error" size="small" />} label={<Typography variant="body2">危険のみ</Typography>} />
            </Stack>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>期間</Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                {(Object.keys(DATE_PRESET_LABELS) as DateRangePreset[]).map(preset => (
                  <Chip key={preset} label={DATE_PRESET_LABELS[preset]} size="small" variant={datePreset === preset ? 'filled' : 'outlined'} color={datePreset === preset ? 'primary' : 'default'} onClick={() => setDatePreset(preset)} sx={{ cursor: 'pointer' }} />
                ))}
              </Stack>
              {datePreset === 'custom' && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField type="date" label="開始日" value={customStart} onChange={e => setCustomStart(e.target.value)} size="small" InputLabelProps={{ shrink: true }} sx={{ flex: 1 }} />
                  <Typography variant="body2" color="text.secondary">〜</Typography>
                  <TextField type="date" label="終了日" value={customEnd} onChange={e => setCustomEnd(e.target.value)} size="small" InputLabelProps={{ shrink: true }} sx={{ flex: 1 }} />
                </Stack>
              )}
            </Box>
            {allTags.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>タグ</Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {allTags.map(tag => (
                    <Chip key={tag} label={tag} size="small" variant={filterTags.includes(tag) ? 'filled' : 'outlined'} color={filterTags.includes(tag) ? 'secondary' : 'default'} onClick={() => setFilterTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])} sx={{ cursor: 'pointer' }} />
                  ))}
                </Stack>
              </Box>
            )}
            {activeFilterCount > 0 && (
              <Button size="small" onClick={() => { setFilterUser(null); setFilterIntensity(''); setFilterRiskOnly(false); setDatePreset('all'); setCustomStart(''); setCustomEnd(''); setFilterTags([]); }} sx={{ alignSelf: 'flex-end', textTransform: 'none' }}>
                フィルターをクリア
              </Button>
            )}
          </Stack>
        </Paper>
      )}

      {filteredRecords.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {records.length === 0 ? 'まだ ABC 記録がありません。「簡易記録」タブから最初の記録を作成してください。' : 'フィルター条件に一致する記録がありません。'}
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {filteredRecords.map(record => (
            <Card key={record.id} variant="outlined" sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.main' }, transition: 'border-color 0.2s' }} onClick={() => { setDetailRecord(record); setIsEditing(false); }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle2" fontWeight={700}>{record.userName}</Typography>
                      <Chip label={ABC_INTENSITY_DISPLAY[record.intensity]} size="small" color={intensityColor(record.intensity)} variant="outlined" />
                      {record.riskFlag && <Chip icon={<WarningAmberRoundedIcon />} label="危険" size="small" color="error" variant="filled" />}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(record.occurredAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Stack>
                  {record.setting && <Typography variant="caption" color="text.secondary">📍 {record.setting}</Typography>}
                  <Stack spacing={0.5}>
                    <Typography variant="body2"><strong>A:</strong> {record.antecedent.length > 60 ? record.antecedent.slice(0, 60) + '…' : record.antecedent}</Typography>
                    <Typography variant="body2"><strong>B:</strong> {record.behavior.length > 60 ? record.behavior.slice(0, 60) + '…' : record.behavior}</Typography>
                    <Typography variant="body2"><strong>C:</strong> {record.consequence.length > 60 ? record.consequence.slice(0, 60) + '…' : record.consequence}</Typography>
                  </Stack>
                  {record.tags.length > 0 && (
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {record.tags.map(tag => <Chip key={tag} label={tag} size="small" variant="outlined" />)}
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {/* ── Detail / Edit Dialog ── */}
      <Dialog open={!!detailRecord} onClose={() => { setDetailRecord(null); setIsEditing(false); }} maxWidth="sm" fullWidth>
        {detailRecord && (
          <>
            <DialogTitle>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="h6" fontWeight={700}>{isEditing ? 'ABC 記録を編集' : 'ABC 記録詳細'}</Typography>
                <Stack direction="row" spacing={0.5}>
                  {!isEditing && (
                    <Tooltip title="編集"><IconButton size="small" color="primary" onClick={startEdit}><EditNoteRoundedIcon /></IconButton></Tooltip>
                  )}
                  <Tooltip title="削除"><IconButton size="small" color="error" onClick={() => handleDelete(detailRecord.id)}><DeleteOutlineRoundedIcon /></IconButton></Tooltip>
                </Stack>
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              {isEditing ? (
                <Stack spacing={2}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField type="datetime-local" label="発生日時" value={(editForm.occurredAt ?? '').slice(0, 16)} onChange={e => setEditForm(f => ({ ...f, occurredAt: e.target.value }))} size="small" fullWidth InputLabelProps={{ shrink: true }} />
                    <TextField label="場面" value={editForm.setting ?? ''} onChange={e => setEditForm(f => ({ ...f, setting: e.target.value }))} size="small" fullWidth />
                  </Stack>
                  <TextField label="A: 直前の状況" value={editForm.antecedent ?? ''} onChange={e => setEditForm(f => ({ ...f, antecedent: e.target.value }))} size="small" fullWidth multiline minRows={2} />
                  <TextField label="B: 行動" value={editForm.behavior ?? ''} onChange={e => setEditForm(f => ({ ...f, behavior: e.target.value }))} size="small" fullWidth multiline minRows={2} />
                  <TextField label="C: 結果" value={editForm.consequence ?? ''} onChange={e => setEditForm(f => ({ ...f, consequence: e.target.value }))} size="small" fullWidth multiline minRows={2} />
                  <Stack direction="row" spacing={2} alignItems="center">
                    <TextField select label="強度" value={editForm.intensity ?? 'medium'} onChange={e => setEditForm(f => ({ ...f, intensity: e.target.value as AbcIntensity }))} size="small" sx={{ minWidth: 100 }}>
                      {ABC_INTENSITY_VALUES.map(v => <MenuItem key={v} value={v}>{ABC_INTENSITY_DISPLAY[v]}</MenuItem>)}
                    </TextField>
                    <TextField type="number" label="継続時間（分）" value={editForm.durationMinutes ?? ''} onChange={e => setEditForm(f => ({ ...f, durationMinutes: e.target.value ? Number(e.target.value) : null }))} size="small" sx={{ minWidth: 130 }} inputProps={{ min: 0 }} />
                    <FormControlLabel control={<Switch checked={editForm.riskFlag ?? false} onChange={e => setEditForm(f => ({ ...f, riskFlag: e.target.checked }))} color="error" />} label={<Typography variant="body2">危険行動</Typography>} />
                  </Stack>
                  <TextField label="メモ" value={editForm.notes ?? ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} size="small" fullWidth multiline minRows={1} />
                </Stack>
              ) : (
                <Stack spacing={2}>
                  {/* Deep link banner */}
                  {deepLinkBanner && focusedRecordId === detailRecord.id && (
                    <Alert
                      severity="info"
                      variant="outlined"
                      sx={{
                        animation: 'fadeIn 0.3s ease-in',
                        '@keyframes fadeIn': {
                          from: { opacity: 0, transform: 'translateY(-8px)' },
                          to: { opacity: 1, transform: 'translateY(0)' },
                        },
                      }}
                    >
                      📍 支援計画シートから参照された根拠記録を表示中
                    </Alert>
                  )}
                  <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                    <Chip label={detailRecord.userName} color="primary" />
                    <Chip label={new Date(detailRecord.occurredAt).toLocaleString('ja-JP')} variant="outlined" />
                    {detailRecord.setting && <Chip label={`📍 ${detailRecord.setting}`} variant="outlined" />}
                    <Chip label={ABC_INTENSITY_DISPLAY[detailRecord.intensity]} color={intensityColor(detailRecord.intensity)} />
                    {detailRecord.riskFlag && <Chip icon={<WarningAmberRoundedIcon />} label="危険行動" color="error" />}
                    {detailRecord.durationMinutes != null && <Chip label={`${detailRecord.durationMinutes}分`} variant="outlined" />}
                  </Stack>
                  <Divider />
                  <Box>
                    <Typography variant="subtitle2" color="warning.main" fontWeight={700}>A: 先行事象</Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>{detailRecord.antecedent}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="error.main" fontWeight={700}>B: 行動</Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>{detailRecord.behavior}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="info.main" fontWeight={700}>C: 結果</Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>{detailRecord.consequence}</Typography>
                  </Box>
                  {detailRecord.tags.length > 0 && (
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {detailRecord.tags.map(tag => <Chip key={tag} label={tag} size="small" />)}
                    </Stack>
                  )}
                  {detailRecord.notes && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">メモ</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{detailRecord.notes}</Typography>
                    </Box>
                  )}
                  {/* ── Reverse Trace: このABCが使われている支援 ── */}
                  {reverseTrace && reverseTrace.totalUsageCount > 0 && (
                    <>
                      <Divider />
                      <Box>
                        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
                          <AccountTreeRoundedIcon fontSize="small" color="primary" />
                          <Typography variant="subtitle2" fontWeight={700} color="primary.main">
                            このABCが使われている支援
                          </Typography>
                          <Chip
                            label={`${reverseTrace.totalUsageCount}件`}
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.65rem' }}
                          />
                        </Stack>
                        <Stack spacing={0.75}>
                          {reverseTrace.usages.map((usage, idx) => (
                            <Paper
                              key={`${usage.planningSheetId}-${usage.strategy}-${idx}`}
                              variant="outlined"
                              sx={{
                                px: 1.5, py: 0.75,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                borderLeftWidth: 3,
                                borderLeftColor: usage.strategy === 'antecedentStrategies'
                                  ? 'info.main'
                                  : usage.strategy === 'teachingStrategies'
                                    ? 'success.main'
                                    : 'warning.main',
                              }}
                            >
                              <Chip
                                label={usage.strategyLabel}
                                size="small"
                                variant="filled"
                                color={
                                  usage.strategy === 'antecedentStrategies'
                                    ? 'info'
                                    : usage.strategy === 'teachingStrategies'
                                      ? 'success'
                                      : 'warning'
                                }
                                sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600 }}
                              />
                              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                                支援計画シート: {usage.planningSheetId.slice(0, 12)}…
                              </Typography>
                              {usage.count > 1 && (
                                <Chip
                                  label={`×${usage.count}`}
                                  size="small"
                                  variant="outlined"
                                  sx={{ height: 18, fontSize: '0.6rem' }}
                                />
                              )}
                            </Paper>
                          ))}
                        </Stack>
                        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                          {Object.entries(reverseTrace.byStrategy)
                            .filter(([, count]) => count > 0)
                            .map(([key, count]) => {
                              const labels: Record<string, string> = {
                                antecedentStrategies: '先行事象',
                                teachingStrategies: '教授',
                                consequenceStrategies: '後続事象',
                              };
                              return (
                                <Typography key={key} variant="caption" color="text.secondary">
                                  {labels[key]}（{count}件）
                                </Typography>
                              );
                            })}
                          <Typography variant="caption" color="text.secondary">
                            関連支援計画: {reverseTrace.relatedSheetCount}件
                          </Typography>
                        </Stack>
                      </Box>
                    </>
                  )}
                  {reverseTrace && reverseTrace.totalUsageCount === 0 && (
                    <>
                      <Divider />
                      <Box>
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <AccountTreeRoundedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                          <Typography variant="body2" color="text.disabled">
                            このABCはまだ支援計画に紐づけられていません
                          </Typography>
                        </Stack>
                      </Box>
                    </>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    記録者: {detailRecord.recorderName} | 作成: {new Date(detailRecord.createdAt).toLocaleString('ja-JP')}
                  </Typography>
                </Stack>
              )}
            </DialogContent>
            <DialogActions sx={{ justifyContent: 'space-between' }}>
              {isEditing ? (
                <>
                  <Button onClick={cancelEdit} sx={{ textTransform: 'none' }}>キャンセル</Button>
                  <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={saveEdit} disabled={editSaving} sx={{ textTransform: 'none' }}>{editSaving ? '保存中…' : '変更を保存'}</Button>
                </>
              ) : (
                <>
                  <Button variant="outlined" color="secondary" size="small" startIcon={<BubbleChartRoundedIcon />} onClick={() => { setDetailRecord(null); navigate(buildIcebergPdcaUrl(detailRecord.userId, { source: 'abc-record' })); }} sx={{ textTransform: 'none' }}>氷山PDCAで分析</Button>
                  <Button onClick={() => setDetailRecord(null)}>閉じる</Button>
                </>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
      <ConfirmDialog {...deleteConfirm.dialogProps} />
    </Stack>
  );
};

export default LogTab;
