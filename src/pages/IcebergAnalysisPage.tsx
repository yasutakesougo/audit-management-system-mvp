import { IcebergCanvas } from '@/features/analysis/components/iceberg/IcebergCanvas';
import type { EnvironmentFactor } from '@/features/analysis/domain/icebergTypes';
import { useIcebergStore } from '@/features/analysis/stores/icebergStore';
import type { AssessmentItem } from '@/features/assessment/domain/types';
import type { BehaviorObservation } from '@/features/daily/domain/daily/types';
import { useUsersDemo } from '@/features/users/usersStoreDemo';
import AddLinkIcon from '@mui/icons-material/AddLink';
import SaveIcon from '@mui/icons-material/Save';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useEffect, useState } from 'react';

const createDemoBehaviors = (userId: string): BehaviorObservation[] => [
  {
    id: `demo-beh-${userId}-1`,
    userId,
    timestamp: new Date().toISOString(),
    antecedent: '環境変化(音・光)',
    behavior: '他害(叩く)',
    consequence: '見守り',
    intensity: 4,
    memo: '作業中に突然机を叩いた',
  },
  {
    id: `demo-beh-${userId}-2`,
    userId,
    timestamp: new Date().toISOString(),
    antecedent: '待ち時間',
    behavior: '離席/飛び出し',
    consequence: '環境調整',
    intensity: 2,
    memo: '給食前の待機中に離席',
  },
];

const createDemoAssessments = (): AssessmentItem[] => [
  {
    id: 'demo-asm-1',
    category: 'environment',
    topic: '聴覚過敏',
    status: 'challenge',
    description: 'ザワザワした音が苦手で手で耳を塞ぐことがある',
  },
  {
    id: 'demo-asm-2',
    category: 'personal',
    topic: '手先が器用',
    status: 'strength',
    description: '細かい作業に集中できる時間帯がある',
  },
];

const createDemoEnvironmentFactors = (): EnvironmentFactor[] => [
  {
    id: 'demo-env-1',
    topic: '工事騒音',
    description: '施設の外で工事がありドリル音が響いていた',
  },
];

const IcebergAnalysisPage: React.FC = () => {
  const { currentSession, initSession, moveNode, addNodeFromData, linkNodes } = useIcebergStore();
  const { data: users } = useUsersDemo();
  const [targetUserId, setTargetUserId] = useState('');
  const activeSessionUserId = currentSession?.targetUserId;

  useEffect(() => {
    if (!targetUserId) return;
    if (activeSessionUserId === targetUserId) return;
    const user = users.find((u) => u.UserID === targetUserId);
    const title = user ? `${user.FullName}さんの分析セッション` : `${targetUserId}さんの分析セッション`;
    initSession(targetUserId, title);
  }, [activeSessionUserId, initSession, targetUserId, users]);

  useEffect(() => {
    if (!currentSession) return;
    if (currentSession.nodes.length > 0) return;

    const behaviors = createDemoBehaviors(currentSession.targetUserId);
    const assessments = createDemoAssessments();
    const environments = createDemoEnvironmentFactors();

    behaviors.forEach((behavior, index) =>
      addNodeFromData(behavior, 'behavior', { x: 140 + index * 280, y: 80 + index * 20 }),
    );
    assessments.forEach((item, index) =>
      addNodeFromData(item, 'assessment', { x: 180 + index * 260, y: 420 + index * 40 }),
    );
    environments.forEach((factor, index) =>
      addNodeFromData(factor, 'environment', { x: 120 + index * 260, y: 340 + index * 30 }),
    );
  }, [addNodeFromData, currentSession]);

  const handleAutoLink = () => {
    if (!currentSession) return;
    const causes = currentSession.nodes.filter((node) => node.type !== 'behavior');
    const behaviors = currentSession.nodes.filter((node) => node.type === 'behavior');
    if (!causes.length || !behaviors.length) return;
    linkNodes(causes[0].id, behaviors[0].id);
  };

  const handleUserChange = (event: SelectChangeEvent<string>) => {
    setTargetUserId(event.target.value);
  };

  return (
    <Container maxWidth="xl" sx={{ height: '100vh', py: 2, display: 'flex', flexDirection: 'column' }}>
      <Paper sx={{ p: 2, mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 3 }}>
        <Box display="flex" alignItems="center" gap={2}>
          <WorkspacesIcon color="primary" fontSize="large" />
          <Box>
            <Typography variant="h6" fontWeight="bold">
              Iceberg Workspace (氷山モデル分析)
            </Typography>
            <FormControl size="small" sx={{ mt: 1, minWidth: 240 }}>
              <InputLabel id="iceberg-user-select-label">分析対象</InputLabel>
              <Select
                labelId="iceberg-user-select-label"
                label="分析対象"
                value={targetUserId}
                displayEmpty
                onChange={handleUserChange}
              >
                <MenuItem value="">
                  <em>対象者を選択</em>
                </MenuItem>
                {users.map((user) => (
                  <MenuItem key={user.UserID} value={user.UserID}>
                    {user.FullName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>

        <Stack direction="row" spacing={2}>
          <Button variant="outlined" startIcon={<AddLinkIcon />} onClick={handleAutoLink} disabled={!currentSession}>
            仮説リンク (Demo)
          </Button>
          <Button variant="contained" startIcon={<SaveIcon />} disabled={!currentSession}>
            分析保存
          </Button>
        </Stack>
      </Paper>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          bgcolor: '#fafafa',
          border: '1px solid #ddd',
          borderRadius: 2,
          position: 'relative',
          p: 1,
        }}
      >
        {currentSession ? (
          <IcebergCanvas nodes={currentSession.nodes} links={currentSession.links} onMoveNode={moveNode} />
        ) : (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary" variant="h6">
              上部のドロップダウンから分析対象を選択してください
            </Typography>
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default IcebergAnalysisPage;
