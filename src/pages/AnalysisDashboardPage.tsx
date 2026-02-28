import { type TokuseiSurveyResponse } from '@/domain/assessment/tokusei';
import { BehaviorHeatmap } from '@/features/analysis/components/BehaviorHeatmap';
import { BehaviorTrendChart } from '@/features/analysis/components/BehaviorTrendChart';
import { useBehaviorAnalytics } from '@/features/analysis/hooks/useBehaviorAnalytics';
import FeatureChipList from '@/features/assessment/components/FeatureChipList';
import { useTokuseiSurveyResponses } from '@/features/assessment/hooks/useTokuseiSurveyResponses';
import { seedDemoBehaviors, useBehaviorStore } from '@/features/daily/stores/behaviorStore';
import { useUsersDemo } from '@/features/users/usersStoreDemo';
import { isDemoModeEnabled } from '@/lib/env';
import AssessmentIcon from '@mui/icons-material/Assessment';
import RefreshIcon from '@mui/icons-material/Refresh';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Container from '@mui/material/Container';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ANALYSIS_DAYS_OPTIONS = [
  { value: 30, label: '過去30日' },
  { value: 60, label: '過去60日' },
  { value: 90, label: '過去90日' },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AnalysisDashboardPage: React.FC = () => {
  const { data: users } = useUsersDemo();
  const { analysisData, fetchForAnalysis } = useBehaviorStore();
  const demoModeEnabled = isDemoModeEnabled();
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [analysisDays, setAnalysisDays] = useState<number>(30);
  const autoSeededRef = useRef<Set<string>>(new Set());

  const { dailyStats } = useBehaviorAnalytics(analysisData);
  const selectedUserName = useMemo(() => users.find((u) => u.UserID === targetUserId)?.FullName ?? '', [targetUserId, users]);

  // Tokusei data — find matching response for the selected user
  const { data: tokuseiResponses } = useTokuseiSurveyResponses();
  const matchedTokusei: TokuseiSurveyResponse | undefined = useMemo(() => {
    if (!targetUserId || !tokuseiResponses.length) return undefined;
    // Match by targetUserName (partial match for flexibility)
    return tokuseiResponses.find(
      (r) => r.targetUserName === selectedUserName,
    );
  }, [targetUserId, selectedUserName, tokuseiResponses]);

  // Fetch analysis data when user or period changes
  useEffect(() => {
    if (targetUserId) {
      void fetchForAnalysis(targetUserId, analysisDays);
    }
  }, [fetchForAnalysis, targetUserId, analysisDays]);

  // Demo mode: auto-seed with enough data for analysis
  useEffect(() => {
    if (!demoModeEnabled || !targetUserId) return;

    if (analysisData.length > 0) {
      autoSeededRef.current.add(targetUserId);
      return;
    }

    if (autoSeededRef.current.has(targetUserId)) {
      return;
    }

    const seededCount = seedDemoBehaviors(targetUserId, analysisDays);
    if (seededCount > 0) {
      autoSeededRef.current.add(targetUserId);
      void fetchForAnalysis(targetUserId, analysisDays);
    }
  }, [demoModeEnabled, fetchForAnalysis, analysisData.length, targetUserId, analysisDays]);

  const handleSeedData = useCallback(() => {
    if (!targetUserId) return;
    seedDemoBehaviors(targetUserId, analysisDays);
    void fetchForAnalysis(targetUserId, analysisDays);
  }, [targetUserId, analysisDays, fetchForAnalysis]);

  return (
    <Container maxWidth="xl" sx={{ py: 3, minHeight: '100vh' }} data-testid="analysis-dashboard-page">
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <AssessmentIcon color="primary" fontSize="large" />
          <Box>
            <Typography variant="h5" fontWeight="bold">
              行動分析ダッシュボード
            </Typography>
            <Typography variant="body2" color="text.secondary">
              FR-C01: 記録データを即座に可視化してフィードバック
            </Typography>
          </Box>
        </Box>

        <Box display="flex" alignItems="center" gap={2}>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="analysis-target-user-label">分析対象者</InputLabel>
            <Select
              labelId="analysis-target-user-label"
              label="分析対象者"
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

          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel id="analysis-days-label">分析期間</InputLabel>
            <Select
              labelId="analysis-days-label"
              label="分析期間"
              value={analysisDays}
              onChange={(event) => setAnalysisDays(Number(event.target.value))}
            >
              {ANALYSIS_DAYS_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {targetUserId && demoModeEnabled && (
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={handleSeedData} size="small">
              デモデータ生成
            </Button>
          )}
        </Box>
      </Paper>

      {targetUserId ? (
        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { xs: '1fr', md: '1fr 2fr 1fr' },
            gridTemplateRows: 'auto',
            alignItems: 'stretch',
          }}
        >
          {/* 左: 特性パネル */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {matchedTokusei ? (
              <>
                <Card variant="outlined">
                  <CardHeader
                    title="性格・対人関係"
                    titleTypographyProps={{ variant: 'subtitle2', fontWeight: 700 }}
                    sx={{ pb: 0, pt: 1.5, px: 2 }}
                  />
                  <CardContent sx={{ pt: 1, pb: 1.5, px: 2 }}>
                    <FeatureChipList value={matchedTokusei.personality} emptyText="データなし" />
                  </CardContent>
                </Card>
                <Card variant="outlined">
                  <CardHeader
                    title="感覚の特徴"
                    titleTypographyProps={{ variant: 'subtitle2', fontWeight: 700 }}
                    sx={{ pb: 0, pt: 1.5, px: 2 }}
                  />
                  <CardContent sx={{ pt: 1, pb: 1.5, px: 2 }}>
                    <FeatureChipList value={matchedTokusei.sensoryFeatures} emptyText="データなし" />
                  </CardContent>
                </Card>
                <Card variant="outlined">
                  <CardHeader
                    title="行動・コミュニケーション"
                    titleTypographyProps={{ variant: 'subtitle2', fontWeight: 700 }}
                    sx={{ pb: 0, pt: 1.5, px: 2 }}
                  />
                  <CardContent sx={{ pt: 1, pb: 1.5, px: 2 }}>
                    <FeatureChipList value={matchedTokusei.behaviorFeatures} emptyText="データなし" />
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card variant="outlined" sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary" textAlign="center">
                    特性アンケートの
                    <br />
                    データがありません
                  </Typography>
                </CardContent>
              </Card>
            )}
          </Box>

          {/* 中央: トレンドチャート */}
          <Box>
            <BehaviorTrendChart data={dailyStats} title={`${selectedUserName || '対象者'} の行動推移（${analysisDays}日間）`} />
          </Box>

          {/* 右: ヒートマップ */}
          <Box>
            <BehaviorHeatmap data={analysisData} title={`${selectedUserName || '対象者'} の時間帯別発生`} />
          </Box>
        </Box>
      ) : (
        <Box sx={{ textAlign: 'center', mt: 10 }}>
          <Typography variant="h6" color="text.secondary">
            対象者を選択して分析を開始してください
          </Typography>
        </Box>
      )}
    </Container>
  );
};

export default AnalysisDashboardPage;
