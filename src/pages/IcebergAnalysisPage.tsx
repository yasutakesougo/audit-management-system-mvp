import { sensoryToAssessmentItems } from '@/features/analysis/domain/sensoryToAssessmentItems';
import { useAssessmentStore } from '@/features/assessment/stores/assessmentStore';
import { IcebergCanvas } from '@/features/ibd/analysis/iceberg/IcebergCanvas';
import { IcebergDetailSidebar } from '@/features/ibd/analysis/iceberg/IcebergDetailSidebar';
import { useIcebergRepository } from '@/features/ibd/analysis/iceberg/SharePointIcebergRepository';
import { useIcebergStore } from '@/features/ibd/analysis/iceberg/icebergStore';
import { IBDPageHeader } from '@/features/ibd/core/components/IBDPageHeader';
import { useUsers } from '@/features/users/useUsers';
import { auditLog } from '@/lib/debugLogger';
import { TESTIDS, tid } from '@/testids';
import CastConnectedIcon from '@mui/icons-material/CastConnected';
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
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import HistoryIcon from '@mui/icons-material/History';
import AddIcon from '@mui/icons-material/Add';
import React, { useCallback, useEffect, useState } from 'react';
import type { IcebergSnapshot, NodePosition, IcebergSource } from '@/features/ibd/analysis/iceberg/icebergTypes';
import { alpha } from '@mui/material/styles';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';


const IcebergAnalysisPage: React.FC = () => {
  const repository = useIcebergRepository();

  const { 
    currentSession, initSession, moveNode, updateNode, deleteNode, 
    updateLink, deleteLink,
    addNodeFromData, saveState, lastSaveError, savePersistent 
  } = useIcebergStore(repository ?? undefined);
  const { getByUserId, seedDemoData } = useAssessmentStore();
  const { data: users } = useUsers();
  const [targetUserId, setTargetUserId] = useState('');
  const activeSessionUserId = currentSession?.targetUserId;
  const [isSaving, setIsSaving] = useState(false);
  const [isMeetingMode, setIsMeetingMode] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  
  // Selection lifecycle
  const [isCheckingSession, setIsCheckingSession] = useState(false);
  const [latestSnapshot, setLatestSnapshot] = useState<IcebergSnapshot | null>(null);
  const [showChoiceDialog, setShowChoiceDialog] = useState(false);

  const { loadPersistent } = useIcebergStore(repository ?? undefined);

  const selectedNode = currentSession?.nodes.find(n => n.id === selectedNodeId) || null;
  const selectedLink = currentSession?.links.find(l => l.id === selectedLinkId) || null;

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

    combinedItems.forEach((item, index) => {
      const autoPos = {
        x: 120 + (index % 3) * 240,
        y: 350 + Math.floor(index / 3) * 100,
      };
      addNodeFromData(item, 'assessment', autoPos, 'fact');
    });

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

  const handleAddNewNode = useCallback((position: NodePosition) => {
    if (!currentSession) return;
    
    // 水面の位置(40%)に基づいてデフォルトのタイプを判定
    // Canvasの高さを800px程度と仮定(実際はレスポンシブだが初期配置の目安として)
    const type = position.y < 320 ? 'behavior' : 'environment';
    
    const id = `manual-${Date.now()}`;
    const newNodeData = {
      id,
      topic: '新規項目',
      description: '',
      behavior: '新規行動',
    };

    addNodeFromData(newNodeData as unknown as IcebergSource, type, position);
    setSelectedNodeId(`node-${id}`);
    setSnackbar({ open: true, message: '新しい項目を追加しました。右側のパネルで編集してください。' });
  }, [currentSession, addNodeFromData]);

  useEffect(() => {
    if (!targetUserId || !repository) return;
    if (activeSessionUserId === targetUserId) return;

    const checkExisting = async () => {
      setIsCheckingSession(true);
      try {
        const latest = await repository.getLatestByUser(targetUserId);
        if (latest) {
          setLatestSnapshot(latest);
          setShowChoiceDialog(true);
        } else {
          // No existing session, start fresh
          handleStartFresh(targetUserId);
        }
      } catch (e) {
        auditLog.error('iceberg-analysis', 'check_existing_failed', { error: String(e) });
        handleStartFresh(targetUserId);
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkExisting();
  }, [activeSessionUserId, targetUserId, repository, users]);

  const handleStartFresh = (userId: string) => {
    const user = users.find((u) => u.UserID === userId);
    const title = user ? `${user.FullName}さんの分析セッション` : `${userId}さんの分析セッション`;
    initSession(userId, title, 'active');
    setLatestSnapshot(null);
    setShowChoiceDialog(false);
  };

  const handleResume = async () => {
    if (!latestSnapshot || !targetUserId) return;
    try {
      await loadPersistent(targetUserId);
      setSnackbar({ open: true, message: '前回のセッションを再開しました' });
    } catch (err) {
      auditLog.error('iceberg-analysis', 'resume_failed', { error: String(err) });
      setSnackbar({ open: true, message: '再開に失敗しました。新規作成を開始します。' });
      handleStartFresh(targetUserId);
    } finally {
      setShowChoiceDialog(false);
    }
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
      auditLog.error('iceberg-analysis', 'save_failed', {
        error: e instanceof Error ? e.message : String(e),
      });
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
              {...tid(TESTIDS['iceberg-btn-import'])}
            >
              アセスメントから取込
            </Button>
            <Button
              variant={isMeetingMode ? "contained" : "outlined"}
              color={isMeetingMode ? "secondary" : "primary"}
              startIcon={isMeetingMode ? <CastConnectedIcon /> : <CastConnectedIcon />}
              onClick={() => {
                const nextMode = !isMeetingMode;
                setIsMeetingMode(nextMode);
                setSnackbar({
                  open: true,
                  message: nextMode ? "会議モードを開始しました。画面共有に適した表示に切り替わります。" : "会議モードを終了しました。"
                });
              }}
              disabled={!currentSession}
              {...tid(TESTIDS['iceberg-btn-meeting-mode'])}
              sx={{
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: isMeetingMode ? 4 : 0,
                transform: isMeetingMode ? 'scale(1.02)' : 'scale(1)',
                fontWeight: isMeetingMode ? 700 : 400,
              }}
            >
              {isMeetingMode ? "会議モード実行中" : "会議モード"}
            </Button>
            <Button
              variant="contained"
              startIcon={isSaving ? <CircularProgress size={20} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={!currentSession || isSaving || saveState === 'saving' || isMeetingMode}
              {...tid(TESTIDS['iceberg-btn-save'])}
            >
              分析保存
            </Button>
          </>
        }
      />

      {isMeetingMode && (
        <Alert severity="info" variant="filled" sx={{ mb: 2, borderRadius: 2 }}>
          <strong>会議モード実行中:</strong> 画面共有に適した強調表示になっています。編集は制限されています。
        </Alert>
      )}

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
        {...tid(TESTIDS['iceberg-page-main'])}
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 0,
          background: '#fff',
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid #ddd',
        }}
      >
        <Box
          {...tid(TESTIDS['iceberg-canvas'])}
          sx={{
            flex: 1,
            position: 'relative',
            p: 1,
          }}
        >
          {isCheckingSession ? (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <CircularProgress size={32} />
              <Typography variant="body2" color="text.secondary">
                以前の分析データを確認しています...
              </Typography>
            </Box>
          ) : currentSession ? (
            <IcebergCanvas 
              nodes={currentSession.nodes} 
              links={currentSession.links} 
              onMoveNode={isMeetingMode ? () => {} : moveNode} 
              onSelectNode={setSelectedNodeId}
              onAddNode={handleAddNewNode}
              selectedNodeId={selectedNodeId}
              onSelectLink={setSelectedLinkId}
              selectedLinkId={selectedLinkId}
              isMeetingMode={isMeetingMode}
            />
          ) : (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography color="text.secondary" variant="h6">
                上部のドロップダウンから分析対象を選択してください
              </Typography>
            </Box>
          )}
        </Box>

        {/* 右ペイン: 項目・リンク詳細編集 */}
        {(selectedNode || selectedLink) && (
          <IcebergDetailSidebar
            node={selectedNode}
            link={selectedLink}
            nodes={currentSession?.nodes}
            onClose={() => {
              setSelectedNodeId(null);
              setSelectedLinkId(null);
            }}
            onUpdateNode={updateNode}
            onDeleteNode={deleteNode}
            onUpdateLink={updateLink}
            onDeleteLink={deleteLink}
            isReadOnly={isMeetingMode}
            logs={currentSession?.logs}
          />
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

      {/* セッション再開・新規作成の選択ダイアログ */}
      <Dialog 
        open={showChoiceDialog} 
        onClose={() => {}} // 禁止 backdrop click closure to force a choice
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
          <WorkspacesIcon color="primary" />
          分析セッションの開始
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 3 }}>
            対象の利用者には以前の分析データが存在します。
          </DialogContentText>
          
          <Stack spacing={2}>
            {latestSnapshot && (
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2, 
                  cursor: 'pointer',
                  borderColor: 'primary.main',
                  bgcolor: alpha('#1976d2', 0.04),
                  '&:hover': { bgcolor: alpha('#1976d2', 0.08) }
                }}
                onClick={handleResume}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <HistoryIcon color="primary" sx={{ fontSize: 32 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold" color="primary">
                      前回の続きから再開する
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      最終更新: {new Date(latestSnapshot.updatedAt).toLocaleString()}
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                       <Typography variant="caption" sx={{ px: 1, py: 0.2, borderRadius: 1, bgcolor: 'primary.main', color: 'white' }}>
                        {latestSnapshot.status === 'archived' ? '確定済み' : '編集中'}
                      </Typography>
                    </Box>
                  </Box>
                </Stack>
              </Paper>
            )}

            <Paper 
              variant="outlined" 
              sx={{ 
                p: 2, 
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': { bgcolor: 'grey.50', borderColor: 'grey.400' }
              }}
              onClick={() => handleStartFresh(targetUserId)}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <AddIcon color="action" sx={{ fontSize: 32 }} />
                <Box>
                  <Typography variant="subtitle1" fontWeight="bold">
                    白紙から新しく始める
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    現在の図解をクリアし、アセスメントから新規に構築します
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setTargetUserId('')} color="inherit">キャンセル</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default IcebergAnalysisPage;
