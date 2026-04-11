import React, { useState } from 'react';
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
import type { MetricDefinition } from '@/domain/isp/metricDefinition';

export type ImprovementInput = {
  patchId: string;
  metricId: string;
  beforeValue: number | '';
  afterValue: number | '';
  confidence: 'low' | 'medium' | 'high';
};

interface MonitoringMeetingFormProps {
  draft: MonitoringMeetingDraft;
  onUpdate: (patch: Partial<MonitoringMeetingDraft>) => void;
  onSave: () => void;
  onFinalize?: () => void;
  onCancel: () => void;
  isSaving?: boolean;
  planningSheets?: { id: string, title: string }[];
  patchOptions?: { id: string; label: string }[];
  metricDefinitions?: readonly MetricDefinition[];
  improvementInput?: ImprovementInput;
  onImprovementInputChange?: (patch: Partial<ImprovementInput>) => void;
}

export const MonitoringMeetingForm: React.FC<MonitoringMeetingFormProps> = ({
  draft,
  onUpdate,
  onSave,
  onFinalize,
  onCancel,
  isSaving,
  planningSheets = [],
  patchOptions = [],
  metricDefinitions = [],
  improvementInput,
  onImprovementInputChange,
}) => {
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
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
                    : staff.hasBasicBehaviorSupportTraining ? 'basic' : 'none'
    };

    onUpdate({ attendees: [...draft.attendees, newAttendee] });
  };

  const handleRemoveStaff = (id: string | undefined) => {
    if (isFinalized || !id) return;
    onUpdate({ attendees: draft.attendees.filter(a => a.staffId !== id) });
  };

  const validateImprovement = (): boolean => {
    // 改善評価が入力されている場合のみバリデーションを行う
    if (!improvementInput || (!improvementInput.patchId && !improvementInput.metricId && improvementInput.beforeValue === '' && improvementInput.afterValue === '')) {
      setValidationErrors([]);
      setValidationWarnings([]);
      return true;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. 形式バリデーション (Errors - 保存を止める)
    if (!improvementInput.metricId) {
      errors.push('対象指標を選択してください');
    }
    if (improvementInput.beforeValue === '' || improvementInput.afterValue === '') {
      errors.push('before / after を入力してください');
    }
    if (typeof improvementInput.beforeValue === 'number' && improvementInput.beforeValue < 0) {
      errors.push('before値は0以上で入力してください');
    }
    if (typeof improvementInput.afterValue === 'number' && improvementInput.afterValue < 0) {
      errors.push('after値は0以上で入力してください');
    }
    if (improvementInput.beforeValue === 0 && improvementInput.afterValue === 0) {
      errors.push('変化が測定できません');
    }

    // 2. 測定品質バリデーション (Warnings - 保存は止めないが警告)
    if (errors.length === 0 && typeof improvementInput.beforeValue === 'number' && typeof improvementInput.afterValue === 'number') {
      const diff = Math.abs(improvementInput.afterValue - improvementInput.beforeValue);
      
      if (diff === 0) {
        warnings.push('変化がありません（測定対象として適切か確認してください）');
      }

      if (improvementInput.beforeValue > 0 && diff / improvementInput.beforeValue > 5) {
        warnings.push('変化が大きすぎます（入力ミスの可能性があります）');
      }
    }

    setValidationErrors(errors);
    setValidationWarnings(warnings);
    return errors.length === 0;
  };

  const handleSave = () => {
    if (validateImprovement()) {
      onSave();
    }
  };

  const handleFinalize = () => {
    if (validateImprovement()) {
      onFinalize?.();
    }
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

        <Card elevation={0} variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom color="primary">
              6. 改善評価（任意）
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              既に反映済みの更新案に対して、before / after の測定結果がある場合のみ入力してください。
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  select
                  label="評価対象の更新案"
                  value={improvementInput?.patchId ?? ''}
                  onChange={(e) => onImprovementInputChange?.({ patchId: e.target.value })}
                  disabled={isFinalized || patchOptions.length === 0}
                  helperText={patchOptions.length === 0 ? '評価対象にできる確定済み更新案がありません' : '効果を確認したい更新案を選択'}
                >
                  {patchOptions.map((patch) => (
                    <MenuItem key={patch.id} value={patch.id}>{patch.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  select
                  label="対象指標"
                  value={improvementInput?.metricId ?? ''}
                  onChange={(e) => onImprovementInputChange?.({ metricId: e.target.value })}
                  disabled={isFinalized}
                >
                  {metricDefinitions.map((metric) => (
                    <MenuItem key={metric.id} value={metric.id}>
                      {metric.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="before"
                  value={improvementInput?.beforeValue ?? ''}
                  onChange={(e) => onImprovementInputChange?.({
                    beforeValue: e.target.value === '' ? '' : Number(e.target.value),
                  })}
                  disabled={isFinalized}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="after"
                  value={improvementInput?.afterValue ?? ''}
                  onChange={(e) => onImprovementInputChange?.({
                    afterValue: e.target.value === '' ? '' : Number(e.target.value),
                  })}
                  disabled={isFinalized}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  select
                  label="信頼度"
                  value={improvementInput?.confidence ?? 'medium'}
                  onChange={(e) => onImprovementInputChange?.({
                    confidence: e.target.value as ImprovementInput['confidence'],
                  })}
                  disabled={isFinalized}
                >
                  <MenuItem value="low">低</MenuItem>
                  <MenuItem value="medium">中</MenuItem>
                  <MenuItem value="high">高</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Validation Errors & Warnings */}
        <Stack spacing={2} sx={{ mb: 2 }}>
          {validationErrors.length > 0 && (
            <Alert severity="error">
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                ⚠ 改善評価に問題があります
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {validationErrors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </Box>
            </Alert>
          )}

          {validationWarnings.length > 0 && (
            <Alert severity="warning">
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                💡 測定品質に関する確認事項
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {validationWarnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </Box>
            </Alert>
          )}
        </Stack>

        {/* Footer actions */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, pb: 4 }}>
          <Button variant="outlined" onClick={onCancel}>一覧へ戻る</Button>
          {!isFinalized && (
            <>
              <Button 
                variant="outlined" 
                onClick={handleSave}
                disabled={isSaving}
              >
                下書き保存
              </Button>
              <Button 
                variant="contained" 
                size="large" 
                color="primary"
                onClick={handleFinalize}
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
