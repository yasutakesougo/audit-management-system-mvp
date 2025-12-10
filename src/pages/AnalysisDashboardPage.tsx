import { BehaviorHeatmap } from '@/features/analysis/components/BehaviorHeatmap';
import { BehaviorTrendChart } from '@/features/analysis/components/BehaviorTrendChart';
import { useBehaviorAnalytics } from '@/features/analysis/hooks/useBehaviorAnalytics';
import { seedDemoBehaviors, useBehaviorStore } from '@/features/daily/stores/behaviorStore';
import { useUsersDemo } from '@/features/users/usersStoreDemo';
import { isDemoModeEnabled } from '@/lib/env';
import AssessmentIcon from '@mui/icons-material/Assessment';
import RefreshIcon from '@mui/icons-material/Refresh';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import React, { useEffect, useMemo, useRef, useState } from 'react';

const AnalysisDashboardPage: React.FC = () => {
  const { data: users } = useUsersDemo();
  const { data: records, fetchByUser } = useBehaviorStore();
  const demoModeEnabled = isDemoModeEnabled();
  const [targetUserId, setTargetUserId] = useState<string>('');
  const autoSeededRef = useRef<Set<string>>(new Set());

  const { dailyStats } = useBehaviorAnalytics(records);
  const selectedUserName = useMemo(() => users.find((u) => u.UserID === targetUserId)?.FullName ?? '', [targetUserId, users]);

  useEffect(() => {
    if (targetUserId) {
      fetchByUser(targetUserId);
    }
  }, [fetchByUser, targetUserId]);

  useEffect(() => {
    if (!demoModeEnabled || !targetUserId) return;

    if (records.length > 0) {
      autoSeededRef.current.add(targetUserId);
      return;
    }

    if (autoSeededRef.current.has(targetUserId)) {
      return;
    }

    const seededCount = seedDemoBehaviors(targetUserId);
    if (seededCount > 0) {
      autoSeededRef.current.add(targetUserId);
      fetchByUser(targetUserId);
    }
  }, [demoModeEnabled, fetchByUser, records.length, targetUserId]);

  const handleSeedData = () => {
    if (!targetUserId) return;
    seedDemoBehaviors(targetUserId);
    fetchByUser(targetUserId);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3, minHeight: '100vh' }} data-testid="analysis-dashboard-page">
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

          {targetUserId && (
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
            gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
            alignItems: 'stretch',
          }}
        >
          <Box>
            <BehaviorTrendChart data={dailyStats} title={`${selectedUserName || '対象者'} の行動推移`} />
          </Box>

          <Box>
            <BehaviorHeatmap data={records} title={`${selectedUserName || '対象者'} の時間帯別発生`} />
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
