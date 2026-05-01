import React from 'react';
import { Box, Typography, Grid, Card, CardActionArea, IconButton, Chip, LinearProgress } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useNavigate, useParams } from 'react-router-dom';
import { useUser } from '@/features/users/useUsers';
import { useProcedureData } from '@/features/daily/hooks/useProcedureData';
import { formatDateJapanese } from '@/lib/dateFormat';

export const KioskProcedureListScreen: React.FC = () => {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const { data: user, status } = useUser(userId || '');
  const isUserLoading = status === 'loading' || status === 'idle';
  const procedureRepo = useProcedureData();
  
  const procedures = React.useMemo(() => {
    if (!userId) return [];
    return procedureRepo.getByUser(userId);
  }, [userId, procedureRepo]);

  const todayStr = formatDateJapanese(new Date());

  // 進捗サマリーの計算（現在は枠だけ用意、すべて「未実施」とする）
  const totalCount = procedures.length;
  const doneCount = 0;
  const attentionCount = 0;
  const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  if (isUserLoading) {
    return <Box sx={{ p: 4 }}>読み込み中...</Box>;
  }

  if (!user) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h5">利用者が存在しません</Typography>
        <IconButton onClick={() => navigate('/kiosk/users')} sx={{ mt: 2 }}>
          <ArrowBackIcon /> 戻る
        </IconButton>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ヘッダーセクション */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton 
            onClick={() => navigate('/kiosk/users')} 
            sx={{ mr: 2, bgcolor: 'action.hover' }}
            data-testid="kiosk-procedure-list-back"
          >
            <ArrowBackIcon fontSize="large" />
          </IconButton>
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
              {user.FullName} 様
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              {todayStr} の支援手順
            </Typography>
          </Box>
        </Box>

        {/* 進捗サマリー */}
        <Box sx={{ minWidth: 200, textAlign: 'right' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            実施状況: {doneCount} / {totalCount}
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ height: 10, borderRadius: 5, mb: 1 }} 
          />
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            {attentionCount > 0 && (
              <Chip icon={<WarningIcon />} label={`${attentionCount} 注意`} color="error" size="small" />
            )}
            <Chip icon={<CheckCircleIcon />} label={`${doneCount} 完了`} color="success" size="small" variant="outlined" />
          </Box>
        </Box>
      </Box>

      {/* 手順一覧 */}
      <Grid container spacing={2}>
        {procedures.map((step, index) => (
          <Grid key={index} size={12}>
            <Card 
              sx={{ 
                borderRadius: 3,
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                borderLeft: '6px solid',
                borderLeftColor: step.isKey ? 'primary.main' : 'divider',
              }}
              data-testid={`kiosk-procedure-card-${index}`}
            >
              <CardActionArea 
                onClick={() => navigate(`/kiosk/users/${userId}/procedures/${index}`)}
                sx={{ p: 2 }}
              >
                <Grid container alignItems="center" spacing={2}>
                  <Grid size={2} sx={{ textAlign: 'center' }}>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                      {step.time}
                    </Typography>
                  </Grid>
                  <Grid size={8}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                      {step.activity}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {step.instruction}
                    </Typography>
                  </Grid>
                  <Grid size={2} sx={{ textAlign: 'right' }}>
                    <Chip 
                      icon={<AccessTimeIcon />} 
                      label="未実施" 
                      variant="outlined" 
                      sx={{ borderRadius: 2 }}
                    />
                  </Grid>
                </Grid>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
        {procedures.length === 0 && (
          <Grid size={12}>
            <Box sx={{ p: 8, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 4 }}>
              <Typography variant="h6" color="text.secondary">
                本日の支援手順が設定されていません
              </Typography>
            </Box>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};
