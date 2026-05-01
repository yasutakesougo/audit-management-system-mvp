import React, { useState } from 'react';
import { Box, Typography, IconButton, Paper, Grid, Button, Chip, Stack, Alert, Snackbar } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useNavigate, useParams } from 'react-router-dom';
import { useUser } from '@/features/users/useUsers';
import { useProcedureData } from '@/features/daily/hooks/useProcedureData';
import { useExecutionRecord } from '@/features/daily/hooks/useExecutionRecord';
import { formatDateIso } from '@/lib/dateFormat';

export const KioskProcedureDetailScreen: React.FC = () => {
  const navigate = useNavigate();
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
  const { record, setStatus } = useExecutionRecord(today, userId || '', scheduleItemId);
  
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = async (newStatus: 'completed' | 'triggered') => {
    if (!userId) return;
    setIsSaving(true);
    try {
      await setStatus(newStatus);
      setShowSuccess(true);
      // 成功フィードバックの後、少し待ってから一覧に戻る
      setTimeout(() => {
        navigate(`/kiosk/users/${userId}/procedures`);
      }, 1500);
    } catch (error) {
      console.error('Failed to save execution record:', error);
      setIsSaving(false);
    }
  };

  if (isUserLoading) {
    return <Box sx={{ p: 4 }}>読み込み中...</Box>;
  }

  if (!user || !procedure) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h5">情報が見つかりません</Typography>
        <Button 
          variant="contained" 
          onClick={() => navigate(`/kiosk/users/${userId}/procedures`)} 
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
            onClick={() => navigate(`/kiosk/users/${userId}/procedures`)} 
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
      <Grid container spacing={4} sx={{ flexGrow: 1 }}>
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

      {/* フッター / アクションボタン */}
      <Box sx={{ mt: 6, pt: 4, borderTop: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={3} justifyContent="center">
          <Button 
            variant={isTriggered ? "contained" : "outlined"}
            color="warning"
            size="large" 
            startIcon={<ErrorOutlineIcon />}
            onClick={() => handleSave('triggered')}
            sx={{ 
              py: 2, 
              px: 4, 
              borderRadius: 4, 
              fontSize: '1.2rem',
              fontWeight: isTriggered ? 'bold' : 'normal',
              ...(isTriggered ? {} : {
                color: 'text.secondary',
                borderColor: 'divider',
              }),
              '&:hover': { bgcolor: isTriggered ? 'warning.dark' : 'action.hover' }
            }}
            disabled={isSaving || isCompleted}
          >
            {isTriggered ? '記録済み' : '注意ありで記録'}
          </Button>
          <Button 
            variant="contained" 
            color={isCompleted ? "success" : "primary"}
            size="large" 
            startIcon={<CheckCircleOutlineIcon />}
            onClick={() => handleSave('completed')}
            sx={{ 
              py: 2, 
              px: 8, 
              borderRadius: 4, 
              fontSize: '1.5rem', 
              fontWeight: 'bold',
              boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
            }}
            disabled={isSaving || isCompleted}
          >
            {isCompleted ? '実施済みです' : '実施済みにする'}
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

