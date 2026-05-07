import React, { useState } from 'react';
import { Box, Typography, IconButton, Paper, Grid, Button, Chip, Stack, Alert, Snackbar, TextField } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { appendKioskSearchParams } from '../utils/navigation';
import { useUser } from '@/features/users/useUsers';
import { useProcedureData } from '@/features/daily/hooks/useProcedureData';
import { useExecutionRecord } from '@/features/daily/hooks/useExecutionRecord';
import { formatDateIso } from '@/lib/dateFormat';

const MOOD_CHIPS = ['落ち着いていた', '不安そう', '拒否あり', '興奮あり', '切り替え困難'];
const ACTION_CHIPS = ['見守り', '声かけ', '環境調整', '活動変更', '距離を取る', 'クールダウン'];
const RESULT_CHIPS = ['改善した', '変化なし', '悪化した', '途中で落ち着いた'];

export const KioskProcedureDetailScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId, slotKey } = useParams<{ userId: string; slotKey: string }>();
  const { data: user, status } = useUser(userId || '');
  const isUserLoading = status === 'loading' || status === 'idle';
  const procedureRepo = useProcedureData();
  
  const today = React.useMemo(() => formatDateIso(new Date()), []);
  
  const procedure = React.useMemo(() => {
    if (!userId || slotKey === undefined) return null;
    const procedures = procedureRepo.getByUser(userId);
    const index = parseInt(slotKey, 10);
    return procedures[index] || null;
  }, [userId, slotKey, procedureRepo]);

  // scheduleItemId として ID もしくは インデックスを使用する
  const scheduleItemId = procedure?.id || slotKey || '';
  const { record, saveRecord, isLoading } = useExecutionRecord(today, userId || '', scheduleItemId);
  
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // 観察チップ用ステート
  const [selectedMood, setSelectedMood] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [selectedResult, setSelectedResult] = useState<string>('');
  const [textMemo, setTextMemo] = useState<string>('');
  const [showObservations, setShowObservations] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // 以前の保存記録からステートを復元する（1回限り）
  React.useEffect(() => {
    if (isLoading || isInitialized || !record) return;
    
    const memoText = record.memo || '';
    const moodMatch = memoText.match(/【様子】([^\n]+)/);
    const actionMatch = memoText.match(/【対応】([^\n]+)/);
    const resultMatch = memoText.match(/【変化】([^\n]+)/);
    const textMatch = memoText.match(/【メモ】([\s\S]+)/);
    
    if (moodMatch) setSelectedMood(moodMatch[1].trim());
    if (actionMatch) setSelectedAction(actionMatch[1].trim());
    if (resultMatch) setSelectedResult(resultMatch[1].trim());
    
    if (textMatch) {
      setTextMemo(textMatch[1].trim());
    } else if (memoText.trim()) {
      const hasLabels = memoText.includes('【様子】') || memoText.includes('【対応】') || memoText.includes('【変化】');
      if (!hasLabels) {
        setTextMemo(memoText.trim());
      }
    }
    
    if (record.status === 'triggered') {
      setShowObservations(true);
    }
    setIsInitialized(true);
  }, [record, isLoading, isInitialized]);

  const serializeMemo = () => {
    const parts: string[] = [];
    if (selectedMood) parts.push(`【様子】${selectedMood}`);
    if (selectedAction) parts.push(`【対応】${selectedAction}`);
    if (selectedResult) parts.push(`【変化】${selectedResult}`);
    if (textMemo.trim()) parts.push(`【メモ】${textMemo.trim()}`);
    return parts.join('\n');
  };

  const handleSave = async (newStatus: 'completed' | 'triggered') => {
    if (!userId) return;
    setIsSaving(true);
    try {
      const finalMemo = newStatus === 'triggered' ? serializeMemo() : '';
      await saveRecord(newStatus, finalMemo);
      setShowSuccess(true);
      // 成功フィードバックの後、少し待ってから一覧に戻る
      setTimeout(() => {
        navigate(appendKioskSearchParams(`/kiosk/users/${userId}/procedures`, location.search));
      }, 1500);
    } catch (error) {
      console.error('Failed to save execution record:', error);
      setIsSaving(false);
    }
  };

  const handleTriggerClick = () => {
    setShowObservations(!showObservations);
  };

  if (isUserLoading || isLoading) {
    return <Box sx={{ p: 4 }}>読み込み中...</Box>;
  }

  if (!user || !procedure) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h5">情報が見つかりません</Typography>
        <Button 
          variant="contained" 
          onClick={() => navigate(appendKioskSearchParams(`/kiosk/users/${userId}/procedures`, location.search))} 
          sx={{ mt: 2 }}
          startIcon={<ArrowBackIcon />}
        >
          一覧に戻る
        </Button>
      </Box>
    );
  }

  // instruction を「本人」と「支援者」に分割して表示（。で区切られた最初の文を本人のタスクとする）
  // 将来的なスキーマ拡張で明示的なフィールドに移行予定
  const parts = procedure.instruction.split('。').filter(Boolean);
  const personTask = parts[0] || '手順に従って進めましょう';
  const staffTask = parts.slice(1).join('。') || '適宜見守り、必要に応じて声掛けを行います';

  const isCompleted = record?.status === 'completed';
  const isTriggered = record?.status === 'triggered';

  return (
    <Box sx={{ p: 4, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ヘッダー */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton 
            onClick={() => navigate(appendKioskSearchParams(`/kiosk/users/${userId}/procedures`, location.search))} 
            sx={{ mr: 2, bgcolor: 'action.hover' }}
            data-testid="kiosk-procedure-detail-back"
          >
            <ArrowBackIcon fontSize="large" />
          </IconButton>
          <Box>
            <Typography variant="h6" color="text.secondary" sx={{ mb: -0.5 }}>
              {procedure.time} - {procedure.activity}
            </Typography>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
              {user.FullName} 様
            </Typography>
          </Box>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {procedure.isKey && (
            <Chip label="最優先" color="primary" sx={{ fontWeight: 'bold', px: 1 }} />
          )}
          {isCompleted && (
            <Chip label="実施済み" color="success" icon={<CheckCircleOutlineIcon />} sx={{ fontWeight: 'bold' }} />
          )}
          {isTriggered && (
            <Chip label="注意あり" color="warning" icon={<ErrorOutlineIcon />} sx={{ fontWeight: 'bold' }} />
          )}
        </Stack>
      </Box>

      {/* メインコンテンツ */}
      <Grid container spacing={4} sx={{ flexGrow: 1, mb: 4 }}>
        {/* 本人のやる事 */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper 
            elevation={0} 
            sx={{ 
              p: 4, 
              height: '100%', 
              bgcolor: 'primary.lighter', 
              borderRadius: 6,
              border: '2px solid',
              borderColor: 'primary.light',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Typography variant="h5" color="primary.main" sx={{ mb: 3, fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
              <Box sx={{ width: 8, height: 24, bgcolor: 'primary.main', mr: 2, borderRadius: 1 }} />
              本人のすること
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 'bold', lineHeight: 1.4, flexGrow: 1 }}>
              {personTask}
            </Typography>
          </Paper>
        </Grid>

        {/* 支援者のやる事 */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper 
            elevation={0} 
            sx={{ 
              p: 4, 
              height: '100%', 
              bgcolor: 'action.hover', 
              borderRadius: 6,
              border: '2px solid transparent',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Typography variant="h5" color="text.secondary" sx={{ mb: 3, fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
              <Box sx={{ width: 8, height: 24, bgcolor: 'text.disabled', mr: 2, borderRadius: 1 }} />
              支援者がすること
            </Typography>
            <Typography variant="h4" sx={{ color: 'text.secondary', lineHeight: 1.5, flexGrow: 1 }}>
              {staffTask}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* 観察記録の入力パネル */}
      {showObservations && (
        <Paper
          elevation={0}
          sx={{
            p: 4,
            mb: 4,
            borderRadius: 6,
            border: '2px solid',
            borderColor: 'warning.light',
            bgcolor: 'warning.lighter',
          }}
          data-testid="kiosk-observation-panel"
        >
          <Typography variant="h5" color="primary.main" sx={{ mb: 3, fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: 8, height: 24, bgcolor: 'primary.main', mr: 2, borderRadius: 1 }} />
            手順記録の作成
          </Typography>

          <Stack spacing={4}>
            {/* 1. 本人の様子 */}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1.5, color: 'text.secondary' }}>
                本人の様子
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {MOOD_CHIPS.map((chip) => {
                  const active = selectedMood === chip;
                  return (
                    <Chip
                      key={chip}
                      label={chip}
                      onClick={() => setSelectedMood(active ? '' : chip)}
                      color={active ? 'warning' : 'default'}
                      variant={active ? 'filled' : 'outlined'}
                      sx={{ fontSize: '1.1rem', py: 2.5, px: 1, borderRadius: 3, fontWeight: active ? 'bold' : 'normal' }}
                      data-testid={`mood-chip-${chip}`}
                    />
                  );
                })}
              </Stack>
            </Box>

            {/* 2. 支援者の対応 */}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1.5, color: 'text.secondary' }}>
                支援者の対応
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {ACTION_CHIPS.map((chip) => {
                  const active = selectedAction === chip;
                  return (
                    <Chip
                      key={chip}
                      label={chip}
                      onClick={() => setSelectedAction(active ? '' : chip)}
                      color={active ? 'warning' : 'default'}
                      variant={active ? 'filled' : 'outlined'}
                      sx={{ fontSize: '1.1rem', py: 2.5, px: 1, borderRadius: 3, fontWeight: active ? 'bold' : 'normal' }}
                      data-testid={`action-chip-${chip}`}
                    />
                  );
                })}
              </Stack>
            </Box>

            {/* 3. 変化 */}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1.5, color: 'text.secondary' }}>
                変化
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {RESULT_CHIPS.map((chip) => {
                  const active = selectedResult === chip;
                  return (
                    <Chip
                      key={chip}
                      label={chip}
                      onClick={() => setSelectedResult(active ? '' : chip)}
                      color={active ? 'warning' : 'default'}
                      variant={active ? 'filled' : 'outlined'}
                      sx={{ fontSize: '1.1rem', py: 2.5, px: 1, borderRadius: 3, fontWeight: active ? 'bold' : 'normal' }}
                      data-testid={`result-chip-${chip}`}
                    />
                  );
                })}
              </Stack>
            </Box>

            {/* 4. メモ */}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1.5, color: 'text.secondary' }}>
                メモ (自由記述)
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                variant="outlined"
                placeholder="様子や対応について、その他の補足事項があれば入力してください"
                value={textMemo}
                onChange={(e) => setTextMemo(e.target.value)}
                sx={{
                  bgcolor: 'background.paper',
                  borderRadius: 3,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 3,
                  }
                }}
                inputProps={{ 'data-testid': 'kiosk-observation-memo' }}
              />
            </Box>

            {/* 操作ボタン */}
            <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ pt: 2 }}>
              <Button
                variant="outlined"
                color="inherit"
                onClick={() => {
                  setShowObservations(false);
                  setSelectedMood('');
                  setSelectedAction('');
                  setSelectedResult('');
                  setTextMemo('');
                }}
                sx={{ py: 1.5, px: 3, borderRadius: 3, fontSize: '1.1rem' }}
                disabled={isSaving}
              >
                キャンセル
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={() => handleSave('triggered')}
                sx={{ py: 1.5, px: 4, borderRadius: 3, fontSize: '1.1rem', fontWeight: 'bold' }}
                disabled={isSaving}
                data-testid="kiosk-observation-submit"
              >
                記録を保存する
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      {/* フッター / アクションボタン */}
      <Box sx={{ mt: 'auto', pt: 4, borderTop: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={3} justifyContent="center">
          <Button 
            variant={showObservations || isTriggered ? "contained" : "outlined"}
            color="primary"
            size="large" 
            startIcon={showObservations ? null : <ErrorOutlineIcon />}
            onClick={handleTriggerClick}
            sx={{ 
              py: 2.5, 
              px: 12, 
              borderRadius: 4, 
              fontSize: '1.5rem',
              fontWeight: 'bold',
              boxShadow: showObservations || isTriggered ? '0 8px 16px rgba(0,0,0,0.1)' : 'none',
              ...((showObservations || isTriggered) ? {} : {
                color: 'text.secondary',
                borderColor: 'divider',
              }),
              '&:hover': { bgcolor: showObservations || isTriggered ? 'primary.dark' : 'action.hover' }
            }}
            disabled={isSaving || isCompleted}
            data-testid="kiosk-trigger-btn"
          >
            {showObservations ? '閉じる' : (isTriggered ? '記録済み' : '手順記録')}
          </Button>
        </Stack>
      </Box>

      {/* 成功メッセージ */}
      <Snackbar 
        open={showSuccess} 
        autoHideDuration={3000} 
        onClose={() => setShowSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" sx={{ width: '100%', fontSize: '1.2rem', fontWeight: 'bold' }}>
          記録を保存しました
        </Alert>
      </Snackbar>
    </Box>
  );
};
