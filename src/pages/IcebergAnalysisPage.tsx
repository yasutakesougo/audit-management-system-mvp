import { useAuth } from '@/auth/useAuth';
import { IcebergCanvas } from '@/features/analysis/components/iceberg/IcebergCanvas';
import type { EnvironmentFactor } from '@/features/analysis/domain/icebergTypes';
import { sensoryToAssessmentItems } from '@/features/analysis/domain/sensoryToAssessmentItems';
import { createIcebergRepository } from '@/features/analysis/infra/SharePointIcebergRepository';
import { useIcebergStore } from '@/features/analysis/stores/icebergStore';
import type { AssessmentItem } from '@/features/assessment/domain/types';
import { useAssessmentStore } from '@/features/assessment/stores/assessmentStore';
import type { BehaviorObservation } from '@/features/daily/domain/daily/types';
import { IBDPageHeader } from '@/features/ibd/components/IBDPageHeader';
import { useUsersDemo } from '@/features/users/usersStoreDemo';
import { getAppConfig } from '@/lib/env';
import AddLinkIcon from '@mui/icons-material/AddLink';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import SaveIcon from '@mui/icons-material/Save';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

const createDemoBehaviors = (userId: string): BehaviorObservation[] => [
  {
    id: `demo-beh-${userId}-1`,
    userId,
    recordedAt: new Date().toISOString(),
    antecedent: '環境変化(音・光)',
    antecedentTags: [],
    behavior: '他害(叩く)',
    consequence: '見守り',
    intensity: 4,
    followUpNote: '作業中に突然机を叩いた',
  },
  {
    id: `demo-beh-${userId}-2`,
    userId,
    recordedAt: new Date().toISOString(),
    antecedent: '待ち時間',
    antecedentTags: [],
    behavior: '離席/飛び出し',
    consequence: '環境調整',
    intensity: 2,
    followUpNote: '給食前の待機中に離席',
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
  const { acquireToken } = useAuth();

  // Get baseUrl from config (spClient uses this internally)
  const config = useMemo(() => getAppConfig(), []);
  const spSiteUrl = config.VITE_SP_SITE_URL || '';

  // Repository 初期化（acquireToken, baseUrl が安定したら再作成）
  const [repository, setRepository] = useState<Awaited<ReturnType<typeof createIcebergRepository>> | null>(null);

  useEffect(() => {
    const init = async () => {
      const repo = await createIcebergRepository(acquireToken, spSiteUrl);
      setRepository(repo);
    };
    init();
  }, [acquireToken, spSiteUrl]);

  const { currentSession, initSession, moveNode, addNodeFromData, linkNodes, saveState, lastSaveError, savePersistent } = useIcebergStore(repository ?? undefined);
  const { getByUserId, seedDemoData } = useAssessmentStore();
  const { data: users } = useUsersDemo();
  const [targetUserId, setTargetUserId] = useState('');
  const activeSessionUserId = currentSession?.targetUserId;
  const [isSaving, setIsSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({ open: false, message: '' });

  // ------ アセスメント取込ハンドラ ------
  const handleImportAssessment = useCallback(() => {
    if (!targetUserId || !currentSession) return;

    // デモ用: assessmentStore にデータがなければ seed する
    seedDemoData(targetUserId);

    const assessment = getByUserId(targetUserId);
    const manualItems = assessment.items ?? [];
    const sensoryItems = sensoryToAssessmentItems(assessment.sensory);
    const combinedItems = [...manualItems, ...sensoryItems];

    if (combinedItems.length === 0) {
      setSnackbar({ open: true, message: '取込可能な特性データがありません' });
      return;
    }

    // 取込前のノード数を記録し、取込後の差分で追加件数を算出
    const _nodeCountBefore = currentSession.nodes.length;

    combinedItems.forEach((item, index) => {
      const autoPos = {
        x: 120 + (index % 3) * 240,
        y: 350 + Math.floor(index / 3) * 100,
      };
      addNodeFromData(item, 'assessment', autoPos);
    });

    // addNodeFromData は重複を無視するので差分で判定
    // currentSession は immutable snapshot なのでここでは combinedItems.length を使う
    const potentialAdded = combinedItems.length;
    const skipped = currentSession.nodes.filter(
      (n) => n.type === 'assessment' && combinedItems.some((item) => n.sourceId === item.id),
    ).length;
    const addedCount = potentialAdded - skipped;

    if (addedCount > 0) {
      setSnackbar({ open: true, message: `${addedCount}件の特性を水面下に配置しました` });
    } else {
      setSnackbar({ open: true, message: 'すべて配置済みです（新しい特性はありません）' });
    }
  }, [targetUserId, currentSession, getByUserId, seedDemoData, addNodeFromData]);

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

  const handleSave = async () => {
    if (!currentSession || !targetUserId) return;
    setIsSaving(true);
    try {
      await savePersistent({
        userId: targetUserId,
        sessionId: currentSession.id,
        title: currentSession.title,
      });
    } catch (e) {
      console.error('[IcebergAnalysisPage] Save error:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUserChange = (event: SelectChangeEvent<string>) => {
    setTargetUserId(event.target.value);
  };

  return (
    <Container maxWidth="xl" sx={{ height: '100vh', py: 2, display: 'flex', flexDirection: 'column' }}>
      <IBDPageHeader
        title="氷山モデル分析"
        subtitle="表面的な行動の背景にある環境要因を構造化"
        icon={<WorkspacesIcon />}
        actions={
          <>
            <FormControl size="small" sx={{ minWidth: 240 }}>
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
            <Button
              variant="outlined"
              startIcon={<DownloadRoundedIcon />}
              onClick={handleImportAssessment}
              disabled={!targetUserId || !currentSession}
            >
              アセスメントから取込
            </Button>
            <Button variant="outlined" startIcon={<AddLinkIcon />} onClick={handleAutoLink} disabled={!currentSession}>
              仮説リンク (Demo)
            </Button>
            <Button
              variant="contained"
              startIcon={isSaving ? <CircularProgress size={20} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={!currentSession || isSaving || saveState === 'saving'}
            >
              分析保存
            </Button>
          </>
        }
      />

      {/* 保存状態フィードバック */}
      {saveState === 'saved' && (
        <Alert severity="success" sx={{ mb: 2 }}>
          保存しました 💾
        </Alert>
      )}
      {saveState === 'error' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          保存に失敗しました: {lastSaveError || '不明なエラー'}
        </Alert>
      )}
      {saveState === 'conflict' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          他端末で更新されました。再読込してから保存してください。
        </Alert>
      )}

      <Box
        data-testid="iceberg-page-canvas"
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

      {/* 取込フィードバック Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        message={snackbar.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  );
};

export default IcebergAnalysisPage;
