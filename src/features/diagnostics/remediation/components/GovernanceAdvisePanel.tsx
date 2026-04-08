import React from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Stack, 
  Divider, 
  Button, 
  Alert, 
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
  Chip,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoIcon from '@mui/icons-material/Info';
import { useOperationalGovernance } from '../hooks/useOperationalGovernance';
import { type GovernanceRecommendation } from '../domain/governanceAdvisor';
import { useConfirmDialog } from '@/components/ui/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Link } from 'react-router-dom';

/**
 * GovernanceAdvisePanel — 運用ガバナンス・アドバイザー (Phase 2-B)
 * 
 * 構造不整合 (Drift) やインデックス逼迫 (Pressure) を一括で管理し、
 * レジストリに基づいた最適な修復案を提示する。
 */
export const GovernanceAdvisePanel: React.FC = () => {
  const { 
    recommendations, 
    loading, 
    error, 
    executingIds, 
    results, 
    repair 
  } = useOperationalGovernance();
  
  const confirm = useConfirmDialog();

  const handleRepairWithConfirm = (rec: GovernanceRecommendation) => {
    confirm.open({
      title: '構成の修復実行',
      message: `
対象リスト: ${rec.listTitle}
アクション: ${rec.action.label}
----------------------------------
${rec.reason}

【実行される処理】
・SharePoint 上での列作成、またはインデックスの付与。
・システムの整合性が回復し、Nightly Patrol のエラーが解消されます。
      `.trim(),
      confirmLabel: '修復を実行する',
      warningText: '実行中にページを閉じないでください。',
      onConfirm: () => repair(rec),
    });
  };

  if (loading && recommendations.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (recommendations.length === 0) {
    return null;
  }

  const hasAnySuccess = Object.values(results).some(v => v.status === 'success');

  return (
    <Paper 
      variant="outlined" 
      sx={{ 
        p: 3, 
        my: 4, 
        borderColor: 'warning.light', 
        bgcolor: '#fffbf0', 
        borderRadius: 3,
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        animation: 'fadeIn 0.5s ease-out'
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
        <Box sx={{ 
          bgcolor: 'warning.main', 
          color: 'white', 
          p: 0.5, 
          borderRadius: 1, 
          display: 'flex',
          boxShadow: '0 2px 8px rgba(237, 108, 2, 0.3)'
        }}>
          <WarningAmberIcon fontSize="small" />
        </Box>
        <Typography variant="h6" color="warning.dark" fontWeight="800">
          運用ガバナンス・アドバイザー
        </Typography>
        <Chip 
          label={`${recommendations.length} 件の推奨事項`} 
          color="warning" 
          sx={{ fontWeight: 'bold', bgcolor: 'white' }}
        />
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, ml: 5 }}>
        システムの健全な運用を妨げる構成の不整合が検知されました。<br />
        SSOT レジストリに基づき、以下の修復アクションを推奨します。
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      <List sx={{ 
        bgcolor: 'background.paper', 
        borderRadius: 2, 
        border: '1px solid', 
        borderColor: 'divider',
        overflow: 'hidden'
      }}>
        {recommendations.map((rec, idx) => {
          const isExecuting = executingIds.has(rec.id);
          const result = results[rec.id];
          const isSuccess = result?.status === 'success';
          const isP1 = rec.priority.level === 'P1_CRITICAL';

          return (
            <React.Fragment key={rec.id}>
              {idx > 0 && <Divider />}
              <ListItem 
                sx={{ 
                  py: 3,
                  px: 3,
                  transition: 'background-color 0.2s',
                  bgcolor: isExecuting ? 'action.hover' : 
                          isP1 ? 'rgba(211, 47, 47, 0.02)' :
                          isSuccess ? 'rgba(76, 175, 80, 0.04)' : 'inherit',
                  '&:hover': { bgcolor: 'action.hover' }
                }}
              >
                <ListItemIcon sx={{ minWidth: 48 }}>
                  {isSuccess ? (
                    <CheckCircleOutlineIcon color="success" />
                  ) : result?.status === 'error' ? (
                    <ErrorOutlineIcon color="error" />
                  ) : isP1 ? (
                    <ErrorOutlineIcon color="error" />
                  ) : (
                    <BuildCircleIcon color="warning" />
                  )}
                </ListItemIcon>
                
                <ListItemText 
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.5 }}>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {rec.targetField}
                      </Typography>
                      <Typography variant="caption" sx={{ 
                        bgcolor: 'grey.100', 
                        color: 'grey.700',
                        px: 1, 
                        py: 0.2,
                        borderRadius: 1,
                        fontWeight: 'bold',
                        border: '1px solid',
                        borderColor: 'grey.200'
                      }}>
                        {rec.listTitle}
                      </Typography>
                      
                      <Chip 
                        label={rec.priority.level.replace('_', ' ')} 
                        color={rec.severity === 'critical' ? 'error' : 'warning'} 
                        sx={{ height: 18 }}
                      />
                    </Stack>
                  }
                  secondary={
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" color="text.primary" sx={{ 
                        display: 'block', 
                        mb: 1, 
                        fontSize: '0.9rem', 
                        fontWeight: 700,
                        color: rec.priority.level === 'P1_CRITICAL' ? 'error.main' : 'text.primary'
                      }}>
                         {rec.priority.summary}
                      </Typography>
                      
                      {/* Risk Assessment & Reasoning */}
                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip 
                            label={
                              rec.priority.risk === 'data_integrity' ? 'データ整合性' :
                              rec.priority.risk === 'performance' ? '性能低下' :
                              rec.priority.risk === 'operational_friction' ? '運用負荷' : '構成最適化'
                            }
                            color={rec.priority.risk === 'data_integrity' ? 'error' : undefined}
                            variant="outlined"
                            sx={{ height: 18, fontSize: '9px', borderRadius: 1 }}
                          />
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                            Score: {rec.priority.score.toFixed(1)} | {rec.sourceSignal} signal
                          </Typography>
                        </Stack>
                        
                        <Box sx={{ 
                          bgcolor: 'rgba(0,0,0,0.01)', 
                          p: 1.5, 
                          borderRadius: 2, 
                          borderLeft: '3px solid',
                          borderColor: 'divider'
                        }}>
                          {rec.priority.details.map((line, i) => (
                            <Typography key={i} variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, lineHeight: 1.3, fontSize: '0.72rem' }}>
                              • {line}
                            </Typography>
                          ))}
                        </Box>
                      </Stack>

                      {result?.status === 'error' && (
                        <Typography variant="caption" color="error.main" fontWeight="bold" sx={{ display: 'block', mt: 1.5 }}>
                          ⚠️ 修復失敗: {result.errorDetail}
                        </Typography>
                      )}
                    </Box>
                  }
                />
                
                <Box sx={{ ml: 2 }}>
                  {isSuccess ? (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <CheckCircleOutlineIcon fontSize="small" color="success" />
                      <Typography variant="caption" color="success.main" fontWeight="bold">
                        {result.errorDetail === '(Dry Run Mode)' ? '検証済み' : '修復済み'}
                      </Typography>
                    </Stack>
                  ) : (
                    <Stack direction="row" spacing={1}>
                      <Tooltip title="APIを呼び出さずにシミュレーションします">
                        <span>
                          <Button 
                            variant="outlined" 
                            size="small" 
                            color="info"
                            disabled={isExecuting}
                            onClick={() => repair(rec, { dryRun: true })}
                            sx={{ textTransform: 'none', borderRadius: 2 }}
                          >
                            検証
                          </Button>
                        </span>
                      </Tooltip>

                      <Tooltip title="SSOT レジストリに基づく修復を実行します">
                        <span>
                          <Button 
                            variant="contained" 
                            size="small" 
                            color={rec.severity === 'critical' ? 'error' : 'warning'}
                            startIcon={isExecuting ? <CircularProgress size={16} color="inherit" /> : <BuildCircleIcon />}
                            disabled={isExecuting}
                            onClick={() => handleRepairWithConfirm(rec)}
                            sx={{ 
                              textTransform: 'none', 
                              fontWeight: 'bold',
                              borderRadius: 2,
                              px: 2,
                              boxShadow: 'none'
                            }}
                          >
                            {isExecuting ? '実行中...' : '修復'}
                          </Button>
                        </span>
                      </Tooltip>
                    </Stack>
                  )}
                </Box>
              </ListItem>
            </React.Fragment>
          );
        })}
      </List>

      {hasAnySuccess && (
        <Alert 
          severity="success" 
          variant="standard"
          sx={{ mt: 3, borderRadius: 2, borderLeft: '6px solid', borderColor: 'success.main' }}
        >
          <Typography variant="body2" fontWeight="bold">
            修復が適用されました。
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', mb: 1, opacity: 0.8 }}>
             実環境への反映を確認するため、データ整合性スキャンの再実行を推奨します。
          </Typography>
          <Button 
            component={Link} 
            to="/admin/data-integrity" 
            variant="outlined" 
            size="small" 
            color="success"
            sx={{ fontWeight: '800', borderRadius: 1.5 }}
          >
            スキャンを再実行 →
          </Button>
        </Alert>
      )}

      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', opacity: 0.5 }}>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <InfoIcon sx={{ fontSize: 12 }} />
          <Typography variant="caption">
            Source: Nightly Patrol (Diagnostics_Reports) & SP_LIST_REGISTRY
          </Typography>
        </Stack>
      </Box>

      <ConfirmDialog {...confirm.dialogProps} />
    </Paper>
  );
};

// MUI tiny chip helper
