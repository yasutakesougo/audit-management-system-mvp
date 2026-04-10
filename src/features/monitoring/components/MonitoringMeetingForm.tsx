import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
  Chip,
  Alert,
  Autocomplete,
  Checkbox,
  FormControlLabel,
  Tooltip,
} from '@mui/material';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import LockIcon from '@mui/icons-material/Lock';
import EditIcon from '@mui/icons-material/Edit';
import { 
  MEETING_TYPE_LABELS, 
  PLAN_CHANGE_LABELS,
  PlanChangeDecision,
  MeetingType,
  MonitoringMeetingDraft,
  MeetingAttendee,
  MonitoringMeetingRecord,
  MEETING_STATUS_LABELS
} from '@/domain/isp/monitoringMeeting';
import { useStaff } from '@/stores/useStaff';
import { Staff } from '@/types';
import { MonitoringMeetingPDFAction } from '../reports/MonitoringMeetingPDFAction';

interface MonitoringMeetingFormProps {
  draft: MonitoringMeetingDraft;
  onUpdate: (patch: Partial<MonitoringMeetingDraft>) => void;
  onSave: () => void;
  onFinalize?: () => void;
  onCancel: () => void;
  isSaving?: boolean;
  planningSheets?: { id: string, title: string }[];
}

export const MonitoringMeetingForm: React.FC<MonitoringMeetingFormProps> = ({
  draft,
  onUpdate,
  onSave,
  onFinalize,
  onCancel,
  isSaving,
  planningSheets = []
}) => {
  const { data: staffMaster = [] } = useStaff();
  const isFinalized = draft.status === 'finalized';

  const set = <K extends keyof MonitoringMeetingDraft>(key: K, value: MonitoringMeetingDraft[K]) => {
    if (isFinalized) return;
    onUpdate({ [key]: value });
  };

  const handleAddStaff = (staff: Staff | null) => {
    if (isFinalized || !staff) return;
    if (draft.attendees.some(a => a.staffId === staff.staffId)) return;

    const newAttendee: MeetingAttendee = {
      name: staff.name,
      role: staff.role || '',
      present: true,
      staffId: staff.staffId,
      hasBasicTraining: staff.hasBasicBehaviorSupportTraining,
      hasPracticalTraining: staff.hasPracticalBehaviorSupportTraining,
      trainingLevel: staff.hasPracticalBehaviorSupportTraining ? 'practical' 
                    : staff.hasBasicBehaviorSupportTraining? 'basic' : 'none'
    };

    onUpdate({ attendees: [...draft.attendees, newAttendee] });
  };

  const handleRemoveStaff = (id: string | undefined) => {
    if (isFinalized || !id) return;
    onUpdate({ attendees: draft.attendees.filter(a => a.staffId !== id) });
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: 3 }}>
      <Stack spacing={4}>
        
        {/* Status Banner */}
        <Alert 
          severity={isFinalized ? "success" : "info"} 
          icon={isFinalized ? <LockIcon /> : <EditIcon />}
          sx={{ mb: 2 }}
        >
          {isFinalized ? (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                この会議記録は確定済みです
              </Typography>
              <Typography variant="caption">
                確定日時: {draft.finalizedAt ? new Date(draft.finalizedAt).toLocaleString() : '-'} / 
                確定者: {draft.finalizedBy || '不明'}
              </Typography>
            </Box>
          ) : (
            "現在は下書き状態です。内容を入力し、最後に「記録を確定」してください。"
          )}
        </Alert>

        {/* 1. Header & Context */}
        <Card elevation={0} variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom color="primary">
              1. 会議基本情報
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  type="date"
                  label="開催日"
                  value={draft.meetingDate}
                  onChange={(e) => set('meetingDate', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  disabled={isFinalized}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  select
                  label="会議種別"
                  value={draft.meetingType}
                  onChange={(e) => set('meetingType', e.target.value as MeetingType)}
                  disabled={isFinalized}
                >
                  {Object.entries(MEETING_TYPE_LABELS).map(([val, label]) => (
                    <MenuItem key={val} value={val}>{label}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  select
                  label="紐づく支援計画シート"
                  value={draft.planningSheetId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const sheet = planningSheets.find(s => s.id === id);
                    onUpdate({ 
                      planningSheetId: id,
                      planningSheetTitle: sheet?.title || ''
                    });
                  }}
                  helperText="評価のベースとなる計画シートを選択してください"
                  disabled={isFinalized}
                >
                  {planningSheets.map(s => (
                    <MenuItem key={s.id} value={s.id}>{s.title}</MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* 2. Attendees & Qualification Check */}
        <Card elevation={0} variant="outlined">
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6" color="primary">
                2. 参加者と資格要件
              </Typography>
              <Stack direction="row" spacing={1}>
                <Chip 
                  label={`状態: ${MEETING_STATUS_LABELS[draft.status]}`} 
                  color={isFinalized ? "secondary" : "default"} 
                  size="small"
                />
                {draft.hasBasicTrainedMember ? (
                  <Chip icon={<VerifiedUserIcon />} label="監査要件: 充足" color="success" variant="outlined" size="small" />
                ) : (
                  <Chip icon={<ErrorOutlineIcon />} label="監査要件: 不足" color="warning" variant="outlined" size="small" />
                )}
              </Stack>
            </Stack>

            {!isFinalized && (
              <Autocomplete
                options={staffMaster}
                getOptionLabel={(option) => option.name}
                onChange={(_, value) => handleAddStaff(value)}
                renderInput={(params) => (
                  <TextField {...params} label="参加スタッフを追加" placeholder="スタッフ名で検索" />
                )}
                sx={{ mb: 2 }}
                disabled={isFinalized}
              />
            )}

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {draft.attendees.map((a) => (
                <Tooltip 
                  key={a.staffId} 
                  title={a.hasPracticalTraining ? "実践研修修了" : a.hasBasicTraining ? "基礎研修修了" : "研修未受講"}
                >
                  <Chip
                    label={`${a.name} (${a.role})`}
                    onDelete={isFinalized ? undefined : () => handleRemoveStaff(a.staffId)}
                    color={a.hasPracticalTraining ? "secondary" : a.hasBasicTraining ? "primary" : "default"}
                    variant={a.hasBasicTraining ? "filled" : "outlined"}
                    icon={a.hasBasicTraining ? <VerifiedUserIcon /> : undefined}
                  />
                </Tooltip>
              ))}
            </Stack>
          </CardContent>
        </Card>

        {/* 3. Intensive Behavioral Support Summaries */}
        <Card elevation={0} variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom color="primary">
              3. 支援の実施状況と変化 (強度行動障害支援)
            </Typography>
            <Stack spacing={3}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="支援目標に対する実施状況"
                placeholder="計画どおり実施できたこと、できなかったこと、その理由"
                value={draft.implementationSummary}
                onChange={(e) => set('implementationSummary', e.target.value)}
                disabled={isFinalized}
              />
              <TextField
                fullWidth
                multiline
                rows={3}
                label="行動面の変化（具体的なエピソード）"
                placeholder="行動の頻度・強度・持続時間の変化、新しい兆候など"
                value={draft.behaviorChangeSummary}
                onChange={(e) => set('behaviorChangeSummary', e.target.value)}
                disabled={isFinalized}
              />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="有効だった支援"
                    placeholder="パニックの回避に繋がった声掛けや環境調整など"
                    value={draft.effectiveSupportSummary}
                    onChange={(e) => set('effectiveSupportSummary', e.target.value)}
                    disabled={isFinalized}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="新たな課題"
                    placeholder="継続して取り組むべき点、または新しく発生した課題"
                    value={draft.issueSummary}
                    onChange={(e) => set('issueSummary', e.target.value)}
                    disabled={isFinalized}
                  />
                </Grid>
              </Grid>
            </Stack>
          </CardContent>
        </Card>

        {/* 4. Discussion Details (Audit Evidence) */}
        <Card elevation={0} variant="outlined" sx={{ borderLeft: '4px solid #1976d2' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom color="primary">
              4. 会議での検討内容（監査証跡）
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              検討の経緯を具体的に記録してください。誰がどのような意見を出し、どのように結論に至ったかが重要です。
            </Alert>
            <TextField
              fullWidth
              multiline
              rows={8}
              label="具体的検討内容"
              placeholder="〇〇氏より、△△の場面での対応について提案があり、検討した結果、次回の支援計画では◇◇を取り入れることとした..."
              value={draft.discussionSummary}
              onChange={(e) => set('discussionSummary', e.target.value)}
              required
              error={!draft.discussionSummary}
              disabled={isFinalized}
            />
          </CardContent>
        </Card>

        {/* 5. Conclusion & Plan Update */}
        <Card elevation={0} variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom color="primary">
              5. 結論と今後の予定
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  select
                  label="支援計画の更新判定"
                  value={draft.planChangeDecision}
                  onChange={(e) => set('planChangeDecision', e.target.value as PlanChangeDecision)}
                  disabled={isFinalized}
                >
                  {Object.entries(PLAN_CHANGE_LABELS).map(([val, label]) => (
                    <MenuItem key={val} value={val}>{label}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  type="date"
                  label="次回モニタリング予定日"
                  value={draft.nextMonitoringDate}
                  onChange={(e) => set('nextMonitoringDate', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  disabled={isFinalized}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Stack direction="row" spacing={3}>
                  <FormControlLabel
                    control={<Checkbox checked={draft.requiresPlanSheetUpdate} onChange={(e) => set('requiresPlanSheetUpdate', e.target.checked)} disabled={isFinalized} />}
                    label="支援計画シートの修正が必要"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={draft.requiresIspUpdate} onChange={(e) => set('requiresIspUpdate', e.target.checked)} disabled={isFinalized} />}
                    label="個別支援計画書の修正が必要"
                  />
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Footer actions */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, pb: 4 }}>
          <Button variant="outlined" onClick={onCancel}>一覧へ戻る</Button>
          {!isFinalized && (
            <>
              <Button 
                variant="outlined" 
                onClick={onSave}
                disabled={isSaving}
              >
                下書き保存
              </Button>
              <Button 
                variant="contained" 
                size="large" 
                color="primary"
                onClick={onFinalize}
                disabled={isSaving || !draft.discussionSummary}
                startIcon={<LockIcon />}
              >
                記録を確定（編集不可）
              </Button>
            </>
          )}
          {isFinalized && (
            <Stack direction="row" spacing={2} alignItems="center">
              <MonitoringMeetingPDFAction 
                record={draft as unknown as MonitoringMeetingRecord} 
                userName={draft.userName || 'No Name'} 
              />
              <Button variant="contained" disabled startIcon={<LockIcon />}>
                確定済み
              </Button>
            </Stack>
          )}
        </Box>
      </Stack>
    </Box>
  );
};
