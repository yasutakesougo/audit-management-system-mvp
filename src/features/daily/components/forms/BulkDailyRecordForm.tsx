import { TESTIDS } from '@/testids';
import {
    AccessTime as AccessTimeIcon,
    Cancel as CancelIcon,
    ClearAll as ClearAllIcon,
    ExpandMore as ExpandMoreIcon,
    Group as GroupIcon,
    PersonAdd as PersonAddIcon,
    Person as PersonIcon,
    Save as SaveIcon,
    Search as SearchIcon
} from '@mui/icons-material';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';

import type { BulkDailyRecordFormProps } from './bulkDailyRecordFormLogic';
import { REPORTER_ROLE_OPTIONS } from './bulkDailyRecordFormLogic';
import { useBulkDailyRecordFormState } from '../../forms/useBulkDailyRecordFormState';

export function BulkDailyRecordForm({
  open,
  onClose,
  onSave
}: BulkDailyRecordFormProps) {
  const {
    formData,
    selectedUserIds,
    searchQuery,
    newActivityAM,
    newActivityPM,
    saving,
    filteredUsers,
    selectedUsers,
    setSearchQuery,
    setNewActivityAM,
    setNewActivityPM,
    handleUserToggle,
    handleSelectAll,
    handleClearAll,
    handleAddActivity,
    handleRemoveActivity,
    handleIndividualNoteChange,
    handleSave,
    updateDate,
    updateReporterName,
    updateReporterRole,
    updateAmNotes,
    updatePmNotes,
  } = useBulkDailyRecordFormState({ onClose, onSave });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      keepMounted
      data-testid={TESTIDS['bulk-daily-record-form']}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <GroupIcon />
          複数利用者日々の記録作成
        </Box>
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          複数の利用者に対して共通の活動記録を効率的に作成できます
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          {/* 基本情報 */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <PersonIcon sx={{ mr: 1 }} />
              基本情報
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                type="date"
                label="記録日"
                value={formData.date}
                onChange={(e) => updateDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 160 }}
              />
              <TextField
                fullWidth
                label="記録者名"
                value={formData.reporter.name}
                onChange={(e) => updateReporterName(e.target.value)}
                placeholder="記録者の氏名を入力"
              />
              <FormControl sx={{ minWidth: 120 }}>
                <InputLabel>役職</InputLabel>
                <Select
                  name="reporterRole"
                  value={formData.reporter.role}
                  onChange={(e) => updateReporterRole(e.target.value)}
                  label="役職"
                >
                  {REPORTER_ROLE_OPTIONS.map(opt => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Paper>

          {/* 利用者選択 */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <GroupIcon sx={{ mr: 1 }} />
              利用者選択
            </Typography>

            {/* 検索・操作 */}
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <TextField
                size="small"
                placeholder="名前またはIDで検索"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                  inputProps: {
                    'data-testid': TESTIDS['bulk-daily-record-search']
                  }
                }}
                sx={{ flexGrow: 1 }}
              />
              <Tooltip title="表示中の利用者を全選択">
                <IconButton
                  aria-label="表示中の利用者を全選択"
                  data-testid={TESTIDS['bulk-daily-record-select-all']}
                  onClick={handleSelectAll}
                >
                  <PersonAddIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="選択をクリア">
                <IconButton
                  aria-label="選択をクリア"
                  data-testid={TESTIDS['bulk-daily-record-clear-all']}
                  onClick={handleClearAll}
                >
                  <ClearAllIcon />
                </IconButton>
              </Tooltip>
            </Stack>

            {/* 選択状況 */}
            {selectedUserIds.length > 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {selectedUserIds.length}人の利用者が選択されています
                <Box sx={{ mt: 1 }}>
                    <Stack direction="row" flexWrap="wrap" gap={0.5}>
                    {selectedUsers.slice(0, 5).map((user) => {
                      const userId = user.userId || String(user.id ?? '');
                      return (
                        <Chip
                          key={userId}
                          label={user.name}
                          size="small"
                          onDelete={() => handleUserToggle(userId)}
                        />
                      );
                    })}
                    {selectedUsers.length > 5 && (
                      <Chip label={`他${selectedUsers.length - 5}人`} size="small" />
                    )}
                  </Stack>
                </Box>
              </Alert>
            )}

            {/* 利用者リスト */}
            <Box
              sx={{ maxHeight: 300, overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: 1 }}
              data-testid={TESTIDS['bulk-daily-record-user-list']}
            >
              {filteredUsers.map((user) => {
                const userId = user.userId || String(user.id ?? '');
                return (
                  <FormControlLabel
                    key={userId}
                    data-testid={`${TESTIDS['bulk-daily-record-user-row-prefix']}${userId}`}
                    control={
                      <Checkbox
                        checked={selectedUserIds.includes(userId)}
                        onChange={() => handleUserToggle(userId)}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">
                          {user.name} ({userId})
                        </Typography>
                        {user.furigana && (
                          <Typography variant="caption" color="textSecondary">
                            {user.furigana}
                          </Typography>
                        )}
                      </Box>
                    }
                    sx={{
                      width: '100%',
                      margin: 0,
                      px: 1,
                      py: 0.5,
                      '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' }
                    }}
                  />
                );
              })}
              {filteredUsers.length === 0 && (
                <Typography variant="body2" color="textSecondary" sx={{ p: 2, textAlign: 'center' }}>
                  該当する利用者が見つかりません
                </Typography>
              )}
            </Box>
          </Paper>

          {/* 共通活動記録 */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <AccessTimeIcon sx={{ mr: 1 }} />
              共通活動記録
            </Typography>

            <Stack spacing={2}>
              {/* 午前の活動 */}
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2">午前の活動</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    <Box>
                      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                        <TextField
                          size="small"
                          placeholder="活動内容を入力"
                          value={newActivityAM}
                          onChange={(e) => setNewActivityAM(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleAddActivity('AM');
                            }
                          }}
                          sx={{ flexGrow: 1 }}
                          InputProps={{
                            inputProps: {
                              'data-testid': TESTIDS['bulk-daily-record-activity-input-am']
                            }
                          }}
                        />
                        <Button
                          variant="outlined"
                          onClick={() => handleAddActivity('AM')}
                          disabled={!newActivityAM.trim()}
                        >
                          追加
                        </Button>
                      </Stack>
                      <Stack direction="row" flexWrap="wrap" gap={0.5}>
                        {formData.commonActivities.amActivities.map((activity, index) => (
                          <Chip
                            key={`${activity}-${index}`}
                            label={activity}
                            onDelete={() => handleRemoveActivity('AM', index)}
                            size="small"
                            data-testid={`${TESTIDS['bulk-daily-record-activity-chip-am']}-${index}`}
                            deleteIcon={(
                              <CancelIcon
                                fontSize="small"
                                data-testid={`${TESTIDS['bulk-daily-record-activity-delete-am']}-${index}`}
                              />
                            )}
                          />
                        ))}
                      </Stack>
                    </Box>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="午前の共通メモ"
                      value={formData.commonActivities.amNotes}
                      onChange={(e) => updateAmNotes(e.target.value)}
                      placeholder="午前中の様子や特記事項（全員共通）"
                    />
                  </Stack>
                </AccordionDetails>
              </Accordion>

              {/* 午後の活動 */}
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2">午後の活動</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    <Box>
                      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                        <TextField
                          size="small"
                          placeholder="活動内容を入力"
                          value={newActivityPM}
                          onChange={(e) => setNewActivityPM(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleAddActivity('PM');
                            }
                          }}
                          sx={{ flexGrow: 1 }}
                          InputProps={{
                            inputProps: {
                              'data-testid': TESTIDS['bulk-daily-record-activity-input-pm']
                            }
                          }}
                        />
                        <Button
                          variant="outlined"
                          onClick={() => handleAddActivity('PM')}
                          disabled={!newActivityPM.trim()}
                        >
                          追加
                        </Button>
                      </Stack>
                      <Stack direction="row" flexWrap="wrap" gap={0.5}>
                        {formData.commonActivities.pmActivities.map((activity, index) => (
                          <Chip
                            key={`${activity}-${index}`}
                            label={activity}
                            onDelete={() => handleRemoveActivity('PM', index)}
                            size="small"
                            data-testid={`${TESTIDS['bulk-daily-record-activity-chip-pm']}-${index}`}
                            deleteIcon={(
                              <CancelIcon
                                fontSize="small"
                                data-testid={`${TESTIDS['bulk-daily-record-activity-delete-pm']}-${index}`}
                              />
                            )}
                          />
                        ))}
                      </Stack>
                    </Box>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="午後の共通メモ"
                      value={formData.commonActivities.pmNotes}
                      onChange={(e) => updatePmNotes(e.target.value)}
                      placeholder="午後の様子や特記事項（全員共通）"
                    />
                  </Stack>
                </AccordionDetails>
              </Accordion>
            </Stack>
          </Paper>

          {/* 個別メモ */}
          {selectedUsers.length > 0 && (
            <Paper sx={{ p: 2 }} data-testid={TESTIDS['bulk-daily-record-individual-notes']}>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                個別メモ（必要に応じて入力）
              </Typography>
              <Stack spacing={2}>
                {selectedUsers.map((user) => {
                  const userId = user.userId || String(user.id ?? '');
                  return (
                    <Card key={userId} variant="outlined">
                      <CardContent sx={{ pb: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                          {user.name} ({userId})
                        </Typography>
                        <Stack spacing={1}>
                          <TextField
                            fullWidth
                            size="small"
                            label="個別特記事項"
                            value={formData.individualNotes[userId]?.specialNotes || ''}
                            onChange={(e) => handleIndividualNoteChange(userId, 'specialNotes', e.target.value)}
                            placeholder="この利用者特有の記録事項があれば入力"
                          />
                        </Stack>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            </Paper>
          )}
        </Stack>
      </DialogContent>

      <DialogActions
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
            onClick={onClose}
            disabled={saving}
            variant="outlined"
            size="large"
            fullWidth
            sx={{ minHeight: 48 }}
          >
            キャンセル
          </Button>
          <Button
            variant="contained"
            size="large"
            fullWidth
            sx={{ minHeight: 48 }}
            onClick={handleSave}
            disabled={saving || selectedUserIds.length === 0}
            startIcon={<SaveIcon />}
          >
            {saving ? '保存中...' : `${selectedUserIds.length}人分保存`}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
