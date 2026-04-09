import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import InfoIcon from '@mui/icons-material/Info';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import { useOperationalGovernance } from '../hooks/useOperationalGovernance';
import { 
  type GovernanceRecommendation, 
  isSilentRepairApproved,
  SILENT_REPAIR_ALLOWLIST
} from '../domain/governanceAdvisor';
import { useConfirmDialog } from '@/components/ui/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Link } from 'react-router-dom';

/**
 * GovernanceAdvisePanel — 運用ガバナンス・アドバイザー
 * 
 * 構造不整合 (Drift) のうち、優先度の高い3件を提示し、
 * 安全な修復導線を提供する運用支援コンポーネント。
 */
export const GovernanceAdvisePanel: React.FC = () => {
  const { 
    recommendations, 
    loading, 
    executingIds, 
    results, 
    repair 
  } = useOperationalGovernance();

  const confirm = useConfirmDialog();

  // 運用OS方針: 構造的ドリフトかつ優先度の高い上位3件に絞り、ノイズを最小化する
  // Step 1 (Phase G): Silent 観測の可視化
  const sortedItems = React.useMemo(() => {
    const structural = recommendations.filter(r => r.category === 'structural_drift');
    
    // 主要アクション項目 (suggested, guarded)
    const active = structural
      .filter(r => r.action.tier !== 'silent')
      .slice(0, 3);
    
    // 観測フェーズ項目 (silent)
    const silent = structural
      .filter(r => r.action.tier === 'silent')
      .slice(0, 3);

    silent.forEach(rec => {
      const isApproved = isSilentRepairApproved(rec.listKey, rec.targetField);
      if (isApproved) {
        // eslint-disable-next-line no-console
        console.warn(
          `[Governance OS] DRY-RUN: Auto-repair WOULD be executed for ${rec.listKey}:${rec.targetField}. ` +
          `Policy: ${SILENT_REPAIR_ALLOWLIST.find(p => p.listKey === rec.listKey)?.note}`,
          { 
            action: rec.action.label,
            payload: rec.action.payload,
            priority: rec.priority.level 
          }
        );
      } else {
        // eslint-disable-next-line no-console
        console.log(`[Governance OS] Silent repair candidate detected: ${rec.listKey}:${rec.targetField}`, { rec });
      }
    });

    return { active, silent };
  }, [recommendations]);

  const handleRepairWithConfirm = (rec: GovernanceRecommendation) => {
    confirm.open({
      title: '構成の修復',
      message: `
対象リスト: ${rec.listTitle}
アクション: ${rec.action.label}
----------------------------------
${rec.reason}

【実行される処理】
・SharePoint 上での列作成、または設定更新。
・実行後、不整合の解消が期待されます。
・修復後、データ整合性スキャンを再実行して結果をご確認ください。
      `.trim(),
      confirmLabel: '修復を開始する',
      warningText: '修復中にページを閉じないでください。',
      onConfirm: () => repair(rec),
    });
  };

  if (loading && recommendations.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (sortedItems.active.length === 0 && sortedItems.silent.length === 0) {
    return null;
  }

  const hasAnySuccess = Object.values(results).some(v => v.status === 'success');

  // ヘルパー: アイテムのレンダリング
  const renderItem = (rec: GovernanceRecommendation, isSilent: boolean = false) => {
    const isExecuting = executingIds.has(rec.id);
    const result = results[rec.id];
    const isSuccess = result?.status === 'success';
    const isApproved = isSilentRepairApproved(rec.listKey, rec.targetField);

    return (
      <Paper 
        key={rec.id}
        elevation={0}
        sx={{ 
          p: 2.5,
          bgcolor: isSilent ? 'transparent' : 'rgba(255, 255, 255, 0.03)',
          borderRadius: 2,
          border: '1px solid',
          borderColor: isSuccess ? 'rgba(52, 211, 153, 0.2)' : 
                      isApproved ? 'rgba(52, 211, 153, 0.3)' : 'rgba(255, 255, 255, 0.05)',
          opacity: isSilent && !isApproved ? 0.6 : 1, // 承認済みなら薄くしない
          transition: 'all 0.2s ease',
          '&:hover': {
            bgcolor: 'rgba(255, 255, 255, 0.05)',
            borderColor: isSilent ? 'rgba(52, 211, 153, 0.2)' : (isSuccess ? 'rgba(52, 211, 153, 0.4)' : 'rgba(245, 158, 11, 0.3)'),
          }
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5 }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: 700, 
                  color: isSuccess ? '#34D399' : (isSilent && !isApproved) ? 'rgba(241, 245, 249, 0.7)' : '#F1F5F9',
                }}
              >
                {rec.listKey} <Box component="span" sx={{ opacity: 0.2, mx: 0.5 }}>/</Box> {rec.targetField}
              </Typography>
              {isSilent && !isSuccess && (
                <Chip 
                  label={isApproved ? "自動修復対象（検証済み）" : "自動修復候補"} 
                  size="small"
                  icon={isApproved ? <VerifiedUserIcon sx={{ fontSize: '12px !important' }} /> : undefined}
                  sx={{ 
                    height: 18,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    bgcolor: isApproved ? 'rgba(52, 211, 153, 0.15)' : 'rgba(52, 211, 153, 0.1)', 
                    color: '#34D399', 
                    border: '1px solid rgba(52, 211, 153, 0.2)',
                  }} 
                />
              )}
              {rec.action.tier === 'suggested' && !isSuccess && (
                <Chip 
                  label="自動修復可能" 
                  size="small"
                  sx={{ 
                    height: 18,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    bgcolor: 'rgba(245, 158, 11, 0.1)', 
                    color: '#F59E0B', 
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                  }} 
                />
              )}
              {rec.action.tier === 'guarded' && !isSuccess && (
                <Chip 
                  label="要手動確認" 
                  size="small"
                  sx={{ 
                    height: 18,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    bgcolor: 'rgba(239, 68, 68, 0.1)', 
                    color: '#FCA5A5', 
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                  }} 
                />
              )}
            </Stack>
            <Typography variant="caption" sx={{ color: 'rgba(241, 245, 249, 0.4)', display: 'block' }}>
              {isSilent 
                ? (isApproved ? 'ポリシーに基づき自律修復が承認されている項目です' : '将来的にバックグラウンドでの自律修復が予定されている項目です') 
                : rec.priority.summary}
            </Typography>
          </Box>

          <Box sx={{ minWidth: 120, display: 'flex', justifyContent: 'flex-end' }}>
            {isSuccess ? (
              <Stack 
                direction="row" 
                spacing={0.5} 
                alignItems="center" 
                sx={{ color: '#34D399', opacity: 0.8 }}
              >
                <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />
                <Typography variant="caption" sx={{ fontWeight: 800 }}>修復完了</Typography>
              </Stack>
            ) : isSilent ? (
              <Typography variant="caption" sx={{ color: 'rgba(52, 211, 153, 0.4)', fontWeight: 700, letterSpacing: '0.05em' }}>
                OBSERVING
              </Typography>
            ) : (
              <Button 
                variant="contained" 
                size="small"
                disabled={isExecuting}
                onClick={() => handleRepairWithConfirm(rec)}
                sx={{ 
                  textTransform: 'none', 
                  fontWeight: 700,
                  px: 2,
                  borderRadius: 1.5,
                  bgcolor: '#F59E0B',
                  color: '#0F172A',
                  '&:hover': {
                    bgcolor: '#D97706',
                  },
                  '&:disabled': {
                    bgcolor: 'rgba(245, 158, 11, 0.2)',
                    color: 'rgba(255, 255, 255, 0.2)'
                  }
                }}
              >
                {isExecuting ? (
                  <CircularProgress size={14} color="inherit" sx={{ mr: 1 }} />
                ) : (
                  <AutoFixHighIcon sx={{ fontSize: 14, mr: 1 }} />
                )}
                {isExecuting ? '修復中' : '修復'}
              </Button>
            )}
          </Box>
        </Stack>
        
        {result?.status === 'error' && (
          <Alert 
            severity="error" 
            variant="outlined"
            sx={{ 
              mt: 1.5, 
              py: 0,
              bgcolor: 'rgba(239, 68, 68, 0.05)', 
              color: '#FCA5A5', 
              border: '1px solid rgba(239, 68, 68, 0.2)',
              fontSize: '0.7rem'
            }}
          >
            修復エラー: {result.errorDetail}
          </Alert>
        )}
      </Paper>
    );
  };

  return (
    <Paper 
      elevation={0}
      sx={{ 
        p: 3, 
        my: 4, 
        borderRadius: 3,
        bgcolor: '#0F172A', 
        color: '#F1F5F9',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        position: 'relative',
        animation: 'fadeIn 0.5s ease-out'
      }}
    >
      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', bgcolor: '#F59E0B', opacity: 0.6, borderRadius: '3px 3px 0 0' }} />

      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
          <VerifiedUserIcon sx={{ color: '#F59E0B', fontSize: 24 }} />
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, letterSpacing: '-0.01em', color: '#FFFFFF' }}>
            構成修復アドバイザー
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(241, 245, 249, 0.5)', fontWeight: 500 }}>
            Nightly Patrol の検知結果に基づき、修復が必要な項目を提示しています。
          </Typography>
        </Box>
      </Stack>

      <Stack spacing={1.5}>
        {sortedItems.active.map(item => renderItem(item))}
        
        {sortedItems.silent.length > 0 && (
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 700, color: 'rgba(241, 245, 249, 0.3)', letterSpacing: '0.05em' }}>
              （参考）自動修復の検証対象
            </Typography>
            <Stack spacing={1}>
              {sortedItems.silent.map(item => renderItem(item, true))}
            </Stack>
          </Box>
        )}
      </Stack>

      {hasAnySuccess && (
        <Alert 
          severity="success"
          sx={{ 
            mt: 3, 
            bgcolor: 'rgba(16, 185, 129, 0.05)', 
            color: '#34D399',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            '& .MuiAlert-icon': { color: '#34D399' }
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 1 }}>
            修復アクションを完了しました。反映を確認するため、スキャンの再実行を推奨します。
          </Typography>
          <Button 
            component={Link} 
            to="/admin/data-integrity" 
            variant="outlined" 
            size="small"
            sx={{ 
              height: 24,
              fontSize: '0.7rem',
              fontWeight: 700, 
              color: '#34D399', 
              borderColor: 'rgba(16, 185, 129, 0.3)',
              '&:hover': {
                borderColor: '#34D399',
                bgcolor: 'rgba(16, 185, 129, 0.1)',
              }
            }}
          >
            スキャンを再実行
          </Button>
        </Alert>
      )}

      <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'flex-end', opacity: 0.3 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <InfoIcon sx={{ fontSize: 12 }} />
          <Typography variant="caption">
            Nightly Patrol の継続検知結果をもとに表示しています
          </Typography>
        </Stack>
      </Box>

      <ConfirmDialog {...confirm.dialogProps} />
    </Paper>
  );
};
