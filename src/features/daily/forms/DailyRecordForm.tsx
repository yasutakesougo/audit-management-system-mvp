/**
 * DailyRecordForm — Thin Orchestrator
 *
 * Composes:
 *   - useDailyRecordFormState: all state, handlers, effects, validation
 *   - dailyRecordFormLogic: pure functions, constants
 *   - DailyRecordFormActivities: AM/PM activity sections
 *   - DailyRecordFormBehavior: problem behavior + seizure + suggestion
 *
 * 564 → ~220 lines (composition only, no inline logic)
 */

import type { MealAmount, PersonDaily } from '@/features/daily';
import { buildHandoffTimelineUrl } from '@/app/links/navigationLinks';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import GavelIcon from '@mui/icons-material/Gavel';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
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

import { DailyRecordFormActivities } from './DailyRecordFormActivities';
import { DailyRecordFormBehavior } from './DailyRecordFormBehavior';
import { isProblemBehaviorEmpty, mealOptions } from './dailyRecordFormLogic';
import { useDailyRecordFormState } from './useDailyRecordFormState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { BehaviorTagChips } from '../components/BehaviorTagChips';

interface DailyRecordFormProps {
  open: boolean;
  onClose: () => void;
  record?: PersonDaily;
  onSave: (record: Omit<PersonDaily, 'id'>) => Promise<void>;
}

export function DailyRecordForm({ open, onClose, record, onSave }: DailyRecordFormProps) {
  const s = useDailyRecordFormState({ open, onClose, record, onSave });

  return (
    <>
    <Dialog
      open={open}
      onClose={s.handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { minHeight: '80vh' } }}
      data-testid="daily-record-form-dialog"
    >
      <DialogTitle data-testid="daily-record-form-title">
        {record ? '日々の記録の編集' : '新しい日々の記録'}
        {s.selectedUserValue && (
          <Typography variant="subtitle2" component="div" color="textSecondary" sx={{ mt: 1 }}>
            {s.selectedUserValue.label} ({s.selectedUserValue.id})
          </Typography>
        )}
      </DialogTitle>

      <DialogContent dividers data-testid="daily-record-form-content">
        <Stack spacing={3}>
          {/* Save error alert */}
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

          {/* Basic info section */}
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
                      helperText={s.errors.userId || '氏名から利用者を検索できます'}
                      error={!!s.errors.userId}
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

          {/* Related handoffs banner */}
          {s.formData.userId && (
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
                      onClick={() => {
                        const dateOpt = s.dayScope === 'yesterday' ? 'yesterday' : undefined;
                        s.navigate(buildHandoffTimelineUrl({ date: dateOpt }), {
                          state: { dayScope: s.dayScope, timeFilter: 'all' },
                        });
                      }}
                      sx={{ mt: 1 }}
                      data-testid="daily-open-handoff-timeline"
                    >
                      すべての申し送りを確認
                    </Button>
                  </Alert>
                )}
            </>
          )}

          {/* AM activities */}
          <DailyRecordFormActivities
            period="AM"
            activities={s.formData.data.amActivities}
            notes={s.formData.data.amNotes || ''}
            newActivity={s.newActivityAM}
            onNewActivityChange={s.setNewActivityAM}
            onAddActivity={() => s.handleAddActivity('AM')}
            onRemoveActivity={(index) => s.handleRemoveActivity('AM', index)}
            onNotesChange={(value) => s.handleDataChange('amNotes', value)}
          />

          {/* PM activities */}
          <DailyRecordFormActivities
            period="PM"
            activities={s.formData.data.pmActivities}
            notes={s.formData.data.pmNotes || ''}
            newActivity={s.newActivityPM}
            onNewActivityChange={s.setNewActivityPM}
            onAddActivity={() => s.handleAddActivity('PM')}
            onRemoveActivity={(index) => s.handleRemoveActivity('PM', index)}
            onNotesChange={(value) => s.handleDataChange('pmNotes', value)}
          />

          {/* Meal record */}
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

          {/* Problem behavior + Seizure sections */}
          <DailyRecordFormBehavior
            problemBehavior={s.formData.data.problemBehavior}
            seizureRecord={s.formData.data.seizureRecord}
            onProblemBehaviorChange={s.handleProblemBehaviorChange}
            onSeizureRecordChange={s.handleSeizureRecordChange}
            showSuggestion={
              !!s.formData.userId &&
              !!s.formData.date &&
              !s.loadingHandoffs &&
              !s.handoffError &&
              !s.problemSuggestionApplied &&
              isProblemBehaviorEmpty(s.formData.data.problemBehavior)
            }
            problemSuggestion={s.problemSuggestion}
            onApplySuggestion={s.applyProblemBehaviorSuggestion}
          />

          {/* Behavior tags (MVP-004) */}
          <Paper sx={{ p: 2 }} data-testid="behavior-tags-section">
            <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <LocalOfferIcon sx={{ mr: 1 }} />
              行動タグ
              {(s.formData.data.behaviorTags?.length ?? 0) > 0 && (
                <Chip
                  label={`${(s.formData.data.behaviorTags ?? []).length}件`}
                  size="small"
                  color="primary"
                  sx={{ ml: 1 }}
                />
              )}
            </Typography>
            <BehaviorTagChips
              selectedTags={s.formData.data.behaviorTags ?? []}
              onToggleTag={s.handleBehaviorTagToggle}
            />
          </Paper>

          {/* Compliance fields — 法的記録 */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <GavelIcon sx={{ mr: 1 }} />
              法的記録
            </Typography>
            <Stack direction="row" spacing={3}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={s.formData.data.restraint || false}
                    onChange={(e) => s.handleDataChange('restraint', e.target.checked as never)}
                  />
                }
                label="拘束あり"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={s.formData.data.hasAttachment || false}
                    onChange={(e) => s.handleDataChange('hasAttachment', e.target.checked as never)}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <AttachFileIcon sx={{ fontSize: 18, mr: 0.5 }} />
                    別紙あり
                  </Box>
                }
              />
            </Stack>
          </Paper>

          {/* Special notes */}
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
    <ConfirmDialog {...s.closeConfirmDialog} />
    </>
  );
}
