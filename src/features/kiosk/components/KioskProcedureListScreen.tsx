import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardActionArea, IconButton, Chip, LinearProgress } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useUser } from '@/features/users/useUsers';
import { useProcedureData } from '@/features/daily/hooks/useProcedureData';
import { useExecutionData } from '@/features/daily/hooks/useExecutionData';
import { formatDateJapanese } from '@/lib/dateFormat';
import { toLocalDateISO } from '@/utils/getNow';
import type { ExecutionRecord } from '@/features/daily/domain/executionRecordTypes';

export const KioskProcedureListScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const search = location.search ?? '';
  const { userId } = useParams<{ userId: string }>();
  const { data: user, status } = useUser(userId || '');
  const isUserLoading = status === 'loading' || status === 'idle';
  const procedureRepo = useProcedureData();
  const executionRepo = useExecutionData();
  
  const [records, setRecords] = useState<ExecutionRecord[]>([]);

  const todayIso = React.useMemo(() => toLocalDateISO(new Date()), []);
  const todayStr = formatDateJapanese(new Date());

  const procedures = React.useMemo(() => {
    if (!userId) return [];
    return procedureRepo.getByUser(userId);
  }, [userId, procedureRepo]);

  // 実施記録の取得
  useEffect(() => {
    const fetchRecords = async () => {
      if (!userId) return;
      try {
        const data = await executionRepo.getRecords(todayIso, userId);
        setRecords(data);
      } catch (error) {
        console.error('Failed to fetch execution records:', error);
      }
    };
    void fetchRecords();
  }, [userId, executionRepo, todayIso]);

  // 進捗サマリーの計算
  const totalCount = procedures.length;
  const doneCount = records.filter(r => r.status === 'completed').length;
  const attentionCount = records.filter(r => r.status === 'triggered').length;
  const progress = totalCount > 0 ? ((doneCount + attentionCount) / totalCount) * 100 : 0;

  if (isUserLoading) {
    return <Box sx={{ p: 4 }}>読み込み中...</Box>;
  }

  if (!user) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h5">利用者が存在しません</Typography>
        <IconButton onClick={() => navigate(`/kiosk/users${search}`)} sx={{ mt: 2 }}>
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
            onClick={() => navigate(`/kiosk/users${search}`)} 
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
            実施状況: {doneCount + attentionCount} / {totalCount}
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ height: 12, borderRadius: 6, mb: 1, bgcolor: 'action.hover' }} 
          />
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            {attentionCount > 0 && (
              <Chip icon={<WarningIcon />} label={`${attentionCount} 注意`} color="warning" size="small" sx={{ fontWeight: 'bold' }} />
            )}
            <Chip icon={<CheckCircleIcon />} label={`${doneCount} 完了`} color="success" size="small" variant={doneCount > 0 ? "filled" : "outlined"} sx={{ fontWeight: 'bold' }} />
          </Box>
        </Box>
      </Box>

      {/* 手順一覧 */}
      <Grid container spacing={2}>
        {procedures.map((step, index) => {
          const scheduleItemId = step.id || index.toString();
          const record = records.find(r => r.scheduleItemId === scheduleItemId);
          const isCompleted = record?.status === 'completed';
          const isTriggered = record?.status === 'triggered';
          
          return (
            <Grid key={index} size={12}>
              <Card 
                sx={{ 
                  borderRadius: 3,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  borderLeft: '6px solid',
                  borderLeftColor: step.isKey ? 'primary.main' : 'divider',
                  bgcolor: isCompleted ? 'success.lighter' : isTriggered ? 'warning.lighter' : 'background.paper',
                  opacity: isCompleted ? 0.8 : 1,
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }
                }}
                data-testid={`kiosk-procedure-card-${index}`}
              >
                <CardActionArea 
                  onClick={() => navigate(`/kiosk/users/${userId}/procedures/${index}${search}`)}
                  sx={{ p: 2.5 }}
                >
                  <Grid container alignItems="center" spacing={2}>
                    <Grid size={2} sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', color: isCompleted ? 'success.main' : 'text.secondary' }}>
                        {step.time}
                      </Typography>
                    </Grid>
                    <Grid size={7}>
                      <Typography variant="h6" sx={{ 
                        fontWeight: 'bold', 
                        mb: 0.5,
                        color: isCompleted ? 'success.dark' : 'text.primary',
                        textDecoration: isCompleted ? 'line-through' : 'none'
                      }}>
                        {step.activity}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {step.instruction}
                      </Typography>
                    </Grid>
                    <Grid size={3} sx={{ textAlign: 'right' }}>
                      {isCompleted ? (
                        <Chip 
                          icon={<CheckCircleIcon />} 
                          label="実施済み" 
                          color="success"
                          sx={{ borderRadius: 2, fontWeight: 'bold' }}
                        />
                      ) : isTriggered ? (
                        <Chip 
                          icon={<WarningIcon />} 
                          label="注意あり" 
                          color="warning"
                          sx={{ borderRadius: 2, fontWeight: 'bold' }}
                        />
                      ) : (
                        <Chip 
                          icon={<AccessTimeIcon />} 
                          label="未実施" 
                          variant="outlined" 
                          sx={{ borderRadius: 2, color: 'text.disabled', borderColor: 'divider' }}
                        />
                      )}
                    </Grid>
                  </Grid>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
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
