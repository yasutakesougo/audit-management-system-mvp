/**
 * DailyRecordForm
 *
 * Thin composition component — all logic delegated to:
 * - useDailyRecordFormState: state, handlers, effects, validation
 * - dailyRecordFormLogic: pure functions, constants
 *
 * 1028 → ~560 lines (JSX only, no inline logic)
 */

import type { MealAmount, PersonDaily } from '@/features/daily';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PersonIcon from '@mui/icons-material/Person';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { isProblemBehaviorEmpty, mealOptions } from './dailyRecordFormLogic';
import { useDailyRecordFormState } from './useDailyRecordFormState';

interface DailyRecordFormProps {
  open: boolean;
  onClose: () => void;
  record?: PersonDaily;
  onSave: (record: Omit<PersonDaily, 'id'>) => Promise<void>;
}

export function DailyRecordForm({ open, onClose, record, onSave }: DailyRecordFormProps) {
  const s = useDailyRecordFormState({ open, onClose, record, onSave });

  return (
    <Dialog
      open={open}
      onClose={s.handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { minHeight: '80vh' } }}
      data-testid="daily-record-form-dialog"
    >
      <DialogTitle data-testid="daily-record-form-title">
        {record ? '日次記録の編集' : '新しい日次記録'}
        {s.selectedUserValue && (
          <Typography variant="subtitle2" component="div" color="textSecondary" sx={{ mt: 1 }}>
            {s.selectedUserValue.label} ({s.selectedUserValue.id})
          </Typography>
        )}
      </DialogTitle>

      <DialogContent dividers data-testid="daily-record-form-content">
        <Stack spacing={3}>
          {/* Phase 2: インラインエラー表示 */}
          {s.saveError && (
            <Alert
              severity="error"
              onClose={() => s.setSaveError(null)}
              data-testid="save-error-alert"
              sx={{ whiteSpace: 'pre-line' }}
            >
              {s.saveError}
            </Alert>
          )}

          {/* 基本情報 */}
          <Paper sx={{ p: 2 }} data-testid="basic-info-section">
            <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <PersonIcon sx={{ mr: 1 }} />
              基本情報
            </Typography>

            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Autocomplete
                  fullWidth
                  size="small"
                  options={s.userOptions}
                  value={s.selectedUserValue}
                  onChange={(_, option) => s.handlePersonChange(option)}
                  isOptionEqualToValue={(option, value) => option.id === value?.id}
                  getOptionLabel={(option) =>
                    option.furigana ? `${option.label}（${option.furigana}）` : option.label
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="利用者の選択"
                      placeholder="氏名で検索してください"
                      helperText={s.errors.personId || '氏名から利用者を検索できます'}
                      error={!!s.errors.personId}
                    />
                  )}
                  data-testid="daily-record-user-picker"
                />

                <TextField
                  fullWidth
                  label="日付"
                  type="date"
                  value={s.formData.date}
                  onChange={(e) => s.handleDateChange(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  error={!!s.errors.date}
                  helperText={s.errors.date}
                />
              </Stack>

              <TextField
                fullWidth
                label="記録者名"
                value={s.formData.reporter.name}
                onChange={(e) => s.handleReporterChange(e.target.value)}
                placeholder="記録者の氏名を入力"
                error={!!s.errors.reporter}
                helperText={s.errors.reporter}
              />
            </Stack>
          </Paper>

          {/* Phase 1B: 関連申し送りの可視化 */}
          {s.formData.personId && (
            <>
              {s.loadingHandoffs && <Skeleton variant="rectangular" height={80} />}

              {!s.loadingHandoffs &&
                !s.handoffError &&
                s.handoffCount > 0 &&
                s.importantHandoffs?.length > 0 && (
                  <Alert severity="warning" sx={{ mb: 2 }} data-testid="daily-related-handoffs">
                    <AlertTitle sx={{ fontWeight: 600 }}>
                      📢 この利用者の重要な申し送り（{s.handoffCount}件）
                    </AlertTitle>
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {s.importantHandoffs.slice(0, 3).map((handoff) => (
                        <Box key={handoff.id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                          <Chip size="small" label={handoff.category} color="primary" sx={{ minWidth: 60 }} />
                          <Typography variant="body2">
                            {handoff.message}
                            <Typography
                              component="span"
                              variant="caption"
                              color="text.secondary"
                              sx={{ ml: 1 }}
                            >
                              ({handoff.time})
                            </Typography>
                          </Typography>
                        </Box>
                      ))}
                      {s.handoffCount > 3 && (
                        <Typography variant="caption" color="text.secondary">
                          ... 他 {s.handoffCount - 3}件
                        </Typography>
                      )}
                    </Stack>
                    <Button
                      size="small"
                      variant="text"
                      startIcon={<OpenInNewIcon />}
                      onClick={() =>
                        s.navigate('/handoff-timeline', {
                          state: { dayScope: s.dayScope, timeFilter: 'all' },
                        })
                      }
                      sx={{ mt: 1 }}
                      data-testid="daily-open-handoff-timeline"
                    >
                      すべての申し送りを確認
                    </Button>
                  </Alert>
                )}
            </>
          )}

          {/* 午前の活動 */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <AccessTimeIcon sx={{ mr: 1 }} />
              午前の活動
            </Typography>

            <Box sx={{ mb: 2 }}>
              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <TextField
                  size="small"
                  placeholder="活動内容を入力"
                  value={s.newActivityAM}
                  onChange={(e) => s.setNewActivityAM(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') s.handleAddActivity('AM');
                  }}
                  sx={{ flexGrow: 1 }}
                />
                <Button
                  variant="outlined"
                  onClick={() => s.handleAddActivity('AM')}
                  disabled={!s.newActivityAM.trim()}
                >
                  追加
                </Button>
              </Stack>

              <Stack direction="row" flexWrap="wrap" gap={0.5}>
                {s.formData.data.amActivities.map((activity: string, index: number) => (
                  <Chip
                    key={index}
                    label={activity}
                    onDelete={() => s.handleRemoveActivity('AM', index)}
                    deleteIcon={<DeleteIcon />}
                    size="small"
                  />
                ))}
              </Stack>
            </Box>

            <TextField
              fullWidth
              multiline
              rows={3}
              label="午前の記録・メモ"
              value={s.formData.data.amNotes || ''}
              onChange={(e) => s.handleDataChange('amNotes', e.target.value)}
              placeholder="午前中の様子や特記事項を記録"
            />
          </Paper>

          {/* 午後の活動 */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <AccessTimeIcon sx={{ mr: 1 }} />
              午後の活動
            </Typography>

            <Box sx={{ mb: 2 }}>
              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <TextField
                  size="small"
                  placeholder="活動内容を入力"
                  value={s.newActivityPM}
                  onChange={(e) => s.setNewActivityPM(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') s.handleAddActivity('PM');
                  }}
                  sx={{ flexGrow: 1 }}
                />
                <Button
                  variant="outlined"
                  onClick={() => s.handleAddActivity('PM')}
                  disabled={!s.newActivityPM.trim()}
                >
                  追加
                </Button>
              </Stack>

              <Stack direction="row" flexWrap="wrap" gap={0.5}>
                {s.formData.data.pmActivities.map((activity: string, index: number) => (
                  <Chip
                    key={index}
                    label={activity}
                    onDelete={() => s.handleRemoveActivity('PM', index)}
                    deleteIcon={<DeleteIcon />}
                    size="small"
                  />
                ))}
              </Stack>
            </Box>

            <TextField
              fullWidth
              multiline
              rows={3}
              label="午後の記録・メモ"
              value={s.formData.data.pmNotes || ''}
              onChange={(e) => s.handleDataChange('pmNotes', e.target.value)}
              placeholder="午後の様子や特記事項を記録"
            />
          </Paper>

          {/* 食事記録 */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <RestaurantIcon sx={{ mr: 1 }} />
              食事記録
            </Typography>

            <FormControl fullWidth>
              <InputLabel id="daily-meal-amount-label">食事摂取量</InputLabel>
              <Select
                labelId="daily-meal-amount-label"
                id="daily-meal-amount-select"
                name="mealAmount"
                value={s.formData.data.mealAmount || '完食'}
                onChange={(e) => s.handleDataChange('mealAmount', e.target.value as MealAmount)}
                label="食事摂取量"
              >
                {mealOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Paper>

          {/* 問題行動 - 申し送りからの自動提案バナー */}
          {s.formData.personId &&
            s.formData.date &&
            !s.loadingHandoffs &&
            !s.handoffError &&
            s.problemSuggestion &&
            !s.problemSuggestionApplied &&
            isProblemBehaviorEmpty(s.formData.data.problemBehavior) && (
              <Alert severity="info" sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Typography variant="subtitle2">
                    💡 申し送りの内容から、問題行動の候補があります
                  </Typography>
                  <Typography variant="body2">
                    必要であれば「提案を反映」を押すと、自傷・暴力・大声・異食などのチェックを
                    自動でオンにします。不要な項目は後から外すことができます。
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {s.problemSuggestion.selfHarm && <Chip label="自傷（候補）" size="small" />}
                    {s.problemSuggestion.violence && <Chip label="暴力（候補）" size="small" />}
                    {s.problemSuggestion.loudVoice && <Chip label="大声（候補）" size="small" />}
                    {s.problemSuggestion.pica && <Chip label="異食（候補）" size="small" />}
                    {s.problemSuggestion.other && <Chip label="その他（候補）" size="small" />}
                  </Stack>
                  <Box>
                    <Button variant="outlined" size="small" onClick={s.applyProblemBehaviorSuggestion}>
                      提案を反映
                    </Button>
                  </Box>
                </Stack>
              </Alert>
            )}

          {/* 問題行動 */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              問題行動
            </Typography>

            <Stack direction="row" flexWrap="wrap" spacing={1} sx={{ mb: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={s.formData.data.problemBehavior?.selfHarm || false}
                    onChange={(e) => s.handleProblemBehaviorChange('selfHarm', e.target.checked)}
                  />
                }
                label="自傷"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={s.formData.data.problemBehavior?.violence || false}
                    onChange={(e) => s.handleProblemBehaviorChange('violence', e.target.checked)}
                  />
                }
                label="暴力"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={s.formData.data.problemBehavior?.loudVoice || false}
                    onChange={(e) => s.handleProblemBehaviorChange('loudVoice', e.target.checked)}
                  />
                }
                label="大声"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={s.formData.data.problemBehavior?.pica || false}
                    onChange={(e) => s.handleProblemBehaviorChange('pica', e.target.checked)}
                  />
                }
                label="異食"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={s.formData.data.problemBehavior?.other || false}
                    onChange={(e) => s.handleProblemBehaviorChange('other', e.target.checked)}
                  />
                }
                label="その他"
              />
            </Stack>

            {s.formData.data.problemBehavior?.other && (
              <TextField
                fullWidth
                label="その他詳細"
                value={s.formData.data.problemBehavior?.otherDetail || ''}
                onChange={(e) => s.handleProblemBehaviorChange('otherDetail', e.target.value)}
                multiline
                rows={2}
                sx={{ mt: 2 }}
              />
            )}
          </Paper>

          {/* 発作記録 */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              発作記録
            </Typography>

            <FormControlLabel
              control={
                <Checkbox
                  checked={s.formData.data.seizureRecord?.occurred || false}
                  onChange={(e) => s.handleSeizureRecordChange('occurred', e.target.checked)}
                />
              }
              label="発作あり"
              sx={{ mb: 2 }}
            />

            {s.formData.data.seizureRecord?.occurred && (
              <Stack spacing={2}>
                <TextField
                  label="発作時刻"
                  type="time"
                  value={s.formData.data.seizureRecord?.time || ''}
                  onChange={(e) => s.handleSeizureRecordChange('time', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="持続時間"
                  placeholder="例：約5分"
                  value={s.formData.data.seizureRecord?.duration || ''}
                  onChange={(e) => s.handleSeizureRecordChange('duration', e.target.value)}
                />
                <FormControl>
                  <InputLabel>重症度</InputLabel>
                  <Select
                    name="seizureSeverity"
                    value={s.formData.data.seizureRecord?.severity || ''}
                    onChange={(e) => s.handleSeizureRecordChange('severity', e.target.value)}
                    label="重症度"
                  >
                    <MenuItem value="軽度">軽度</MenuItem>
                    <MenuItem value="中等度">中等度</MenuItem>
                    <MenuItem value="重度">重度</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="発作メモ"
                  multiline
                  rows={2}
                  value={s.formData.data.seizureRecord?.notes || ''}
                  onChange={(e) => s.handleSeizureRecordChange('notes', e.target.value)}
                />
              </Stack>
            )}
          </Paper>

          {/* 特記事項 */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              特記事項
            </Typography>

            {!record && !s.loadingHandoffs && s.handoffCount > 0 && (
              <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 2 }}>
                <Typography variant="body2">
                  重要度「重要」の申し送りが {s.handoffCount} 件見つかりました。
                  特記事項に自動で下書きしていますので、不要な行は削除してご利用ください。
                </Typography>
              </Alert>
            )}

            {!record && s.handoffError && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  申し送り情報の取得に失敗しました: {s.handoffError}
                </Typography>
              </Alert>
            )}

            <TextField
              fullWidth
              label="特記事項"
              value={s.formData.data.specialNotes || ''}
              onChange={(e) => s.handleDataChange('specialNotes', e.target.value)}
              placeholder="その他の重要な情報や申し送り事項"
              multiline
              rows={6}
              helperText={
                !record && s.handoffCount > 0
                  ? `申し送りから自動転記: ${s.handoffCount}件`
                  : 'その他の重要な情報や申し送り事項を記録してください'
              }
            />
          </Paper>
        </Stack>
      </DialogContent>

      <DialogActions
        data-testid="daily-record-form-actions"
        sx={{
          position: 'sticky',
          bottom: 0,
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          p: 1,
          zIndex: 1,
        }}
      >
        <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
          <Button
            onClick={s.handleClose}
            data-testid="cancel-button"
            variant="outlined"
            size="large"
            fullWidth
            disabled={s.isSaving}
            sx={{ minHeight: 48 }}
          >
            キャンセル
          </Button>
          <Button
            onClick={s.handleSave}
            variant="contained"
            size="large"
            fullWidth
            sx={{ minHeight: 48 }}
            data-testid="save-button"
            disabled={!s.isFormValid || s.isSaving}
            startIcon={s.isSaving ? <CircularProgress size={20} color="inherit" /> : undefined}
          >
            {s.isSaving ? '保存中...' : record ? '更新' : '保存'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
