import type { TokuseiSurveyResponse } from '@/domain/assessment/tokusei';
import { AssessmentItemList } from '@/features/assessment/components/AssessmentItemList';
import { ImportSurveyDialog } from '@/features/assessment/components/ImportSurveyDialog';
import { SensoryProfilePanel } from '@/features/assessment/components/SensoryProfilePanel';
import type { AssessmentItem, SensoryProfile, UserAssessment } from '@/features/assessment/domain/types';
import { useAssessmentStore } from '@/features/assessment/stores/assessmentStore';
import { useUsersDemo } from '@/features/users/usersStoreDemo';
import { isDemoModeEnabled } from '@/lib/env';
import DownloadIcon from '@mui/icons-material/Download';
import PersonIcon from '@mui/icons-material/Person';
import SaveIcon from '@mui/icons-material/Save';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import React, { useEffect, useMemo, useState } from 'react';

type SnackbarState = {
  open: boolean;
  message: string;
};

const SENSORY_KEYWORD_MAP: Array<{ field: keyof SensoryProfile; keywords: string[] }> = [
  { field: 'visual', keywords: ['視覚', '光', '眩', 'ちらつき'] },
  { field: 'auditory', keywords: ['聴覚', '音', '騒音', '声', '耳'] },
  { field: 'tactile', keywords: ['触覚', '触れ', '感触', '肌', '触'] },
  { field: 'olfactory', keywords: ['嗅覚', '匂い', '臭い', 'におい'] },
  { field: 'vestibular', keywords: ['揺れ', 'バランス', '前庭', '乗り物'] },
  { field: 'proprioceptive', keywords: ['固有感覚', '重さ', '力加減', '筋'] },
];

const ALERT_PATTERN = /(過敏|苦手|痛|眩|大きな音|騒音|刺激|困難)/;
const SOOTHE_PATTERN = /(安心|落ち着|好む|好き|得意|落ち着ける|安心できる)/;

const deriveSensoryProfile = (current: SensoryProfile, response: TokuseiSurveyResponse): SensoryProfile => {
  if (!response.sensoryFeatures) return current;
  const text = response.sensoryFeatures;
  const normalized = text.toLowerCase();
  let changed = false;
  const next: SensoryProfile = { ...current };

  for (const { field, keywords } of SENSORY_KEYWORD_MAP) {
    const matched = keywords.some((keyword) => normalized.includes(keyword));
    if (!matched) continue;
    let value = next[field];
    if (ALERT_PATTERN.test(text)) {
      value = Math.min(5, Math.max(value, 4));
    } else if (SOOTHE_PATTERN.test(text)) {
      value = Math.max(value, 3);
    } else {
      value = Math.max(value, 3);
    }
    if (value !== next[field]) {
      next[field] = value;
      changed = true;
    }
  }

  return changed ? next : current;
};

const AssessmentDashboardPage: React.FC = () => {
  const { data: users } = useUsersDemo();
  const { getByUserId, save, seedDemoData } = useAssessmentStore();
  const demoModeEnabled = isDemoModeEnabled();

  const [targetUserId, setTargetUserId] = useState<string>('');
  const [formData, setFormData] = useState<UserAssessment | null>(null);
  const [snackbarState, setSnackbarState] = useState<SnackbarState>({ open: false, message: '' });
  const [importOpen, setImportOpen] = useState(false);

  const showSnackbar = (message: string) => {
    setSnackbarState({ open: true, message });
  };

  useEffect(() => {
    if (!targetUserId) {
      setFormData(null);
      return;
    }

    if (demoModeEnabled) {
      seedDemoData(targetUserId);
    }

    const data = getByUserId(targetUserId);
    setFormData(data);
  }, [demoModeEnabled, getByUserId, seedDemoData, targetUserId]);

  const selectedUserName = useMemo(() => {
    return users.find((user) => user.UserID === targetUserId)?.FullName;
  }, [targetUserId, users]);

  const handleSave = () => {
    if (!formData) return;
    save({ ...formData, updatedAt: new Date().toISOString() });
    showSnackbar('アセスメント情報を保存しました');
  };

  const handleImportSelection = (response: TokuseiSurveyResponse) => {
    if (!formData) return;

    const timestamp = Date.now();
    const mappings: Array<{ source?: string; category: AssessmentItem['category']; topic: string; status: AssessmentItem['status']; }> = [
      { source: response.strengths, category: 'personal', topic: '強み・得意 (アンケート)', status: 'strength' },
      { source: response.sensoryFeatures, category: 'body', topic: '感覚特性 (アンケート)', status: 'challenge' },
      { source: response.behaviorFeatures, category: 'activity', topic: '行動特性 (アンケート)', status: 'neutral' },
      { source: response.notes, category: 'environment', topic: '特記事項 (アンケート)', status: 'neutral' },
    ];

    const importedItems: AssessmentItem[] = [];
    mappings.forEach((map, index) => {
      if (!map.source || !map.source.trim()) return;
      importedItems.push({
        id: `imported-${response.id}-${index}-${timestamp}`,
        category: map.category,
        topic: map.topic,
        status: map.status,
        description: `[回答者: ${response.responderName || '不明'}]
${map.source.trim()}`,
      });
    });

    if (importedItems.length === 0) {
      showSnackbar('取り込める内容が見つかりませんでした');
      setImportOpen(false);
      return;
    }

    const nextSensory = deriveSensoryProfile(formData.sensory, response);
    const nextAnalysisTags = Array.from(new Set([
      ...formData.analysisTags,
      'アンケート取込',
      response.targetUserName ?? 'Forms回答',
    ]));

    setFormData({
      ...formData,
      items: [...formData.items, ...importedItems],
      sensory: nextSensory,
      analysisTags: nextAnalysisTags,
    });

    setImportOpen(false);
    showSnackbar(`${importedItems.length}件の特性を取り込みました`);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3, minHeight: '100vh' }}>
      <Paper elevation={0} sx={{ p: 2, mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box display="flex" alignItems="center" gap={2}>
          <PersonIcon color="primary" fontSize="large" />
          <Box>
            <Typography variant="h5" fontWeight="bold">
              アセスメント管理 (Iceberg Model)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              水面下の特性を構造化してチームで共有
            </Typography>
          </Box>
        </Box>

        <Box display="flex" alignItems="center" gap={2}>
          <FormControl size="small" sx={{ minWidth: 240 }}>
            <InputLabel id="assessment-target-label">対象者選択</InputLabel>
            <Select
              labelId="assessment-target-label"
              label="対象者選択"
              value={targetUserId}
              onChange={(event) => setTargetUserId(event.target.value)}
            >
              <MenuItem value="">
                <em>選択してください</em>
              </MenuItem>
              {users.map((user) => (
                <MenuItem key={user.UserID} value={user.UserID}>
                  {user.FullName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            disabled={!formData}
            onClick={() => setImportOpen(true)}
          >
            アンケート取込
          </Button>

          <Button variant="contained" startIcon={<SaveIcon />} disabled={!formData} onClick={handleSave}>
            保存
          </Button>
        </Box>
      </Paper>

      {targetUserId && formData ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <SensoryProfilePanel profile={formData.sensory} onChange={(next) => setFormData({ ...formData, sensory: next })} />

          <Paper sx={{ p: 3 }}>
            <AssessmentItemList items={formData.items} onChange={(next) => setFormData({ ...formData, items: next })} />
          </Paper>
        </Box>
      ) : (
        <Box sx={{ textAlign: 'center', mt: 10 }}>
          <Typography variant="h6" color="text.secondary">
            対象者を選択してアセスメントを入力してください
          </Typography>
        </Box>
      )}

      <Snackbar
        open={snackbarState.open}
        autoHideDuration={3000}
        onClose={() => setSnackbarState((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSnackbarState((prev) => ({ ...prev, open: false }))}>
          {snackbarState.message || '処理が完了しました'}
        </Alert>
      </Snackbar>

      <ImportSurveyDialog
        open={importOpen}
        targetUserId={targetUserId}
        targetUserName={selectedUserName}
        onClose={() => setImportOpen(false)}
        onSelect={handleImportSelection}
      />
    </Container>
  );
};

export default AssessmentDashboardPage;
