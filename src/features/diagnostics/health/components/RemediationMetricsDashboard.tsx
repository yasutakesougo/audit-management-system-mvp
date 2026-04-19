import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  CircularProgress,
  Tooltip,
  IconButton,
  Chip
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useSP } from '@/lib/spClient';
import { calculateRemediationMetrics, formatDuration } from '@/features/sp/health/remediation/metrics';
import { HybridRemediationAuditRepository } from '@/features/sp/health/remediation/HybridRemediationAuditRepository';
import type { ISpAuditOperations } from '@/features/sp/health/remediation/SharePointRemediationAuditRepository';
import type { SpFetcher } from '@/sharepoint/spListHealthCheck';
import type { RemediationAuditEntry } from '@/features/sp/health/remediation/audit';
import { assessSLOCompliance, CURRENT_SLO } from '@/features/sp/health/remediation/policy';
import { Alert, AlertTitle } from '@mui/material';
import GavelIcon from '@mui/icons-material/Gavel';
import RuleIcon from '@mui/icons-material/Rule';

export const RemediationMetricsDashboard: React.FC = () => {
  const sp = useSP();
  const [entries, setEntries] = useState<RemediationAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    if (!sp) return;
    setLoading(true);
    try {
      const repository = new HybridRemediationAuditRepository(sp as ISpAuditOperations & { spFetch: SpFetcher });
      const data = await repository.getEntries();
      setEntries(data);
    } catch (err) {
      console.error('Failed to fetch metrics data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [sp]);

  if (!sp) return null;

  const metrics = calculateRemediationMetrics(entries);
  const compliance = assessSLOCompliance(metrics);

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 'bold' }}>
            運用品質・SLO 遵守状況
          </Typography>
          <Tooltip title={`SLO Status: ${compliance.status.toUpperCase()}`}>
            <Box sx={{ display: 'flex' }}>
              <RuleIcon 
                sx={{ 
                  fontSize: 14, 
                  color: compliance.status === 'compliant' ? 'success.main' : compliance.status === 'warning' ? 'warning.main' : 'error.main' 
                }} 
              />
            </Box>
          </Tooltip>
        </Stack>
        <Tooltip title="再計算">
          <IconButton onClick={fetchData} size="small" disabled={loading}>
            {loading ? <CircularProgress size={16} /> : <RefreshIcon fontSize="inherit" />}
          </IconButton>
        </Tooltip>
      </Stack>

      <Stack direction="row" spacing={2}>
        <MetricCard 
          label="実行率" 
          value={`${Math.round(metrics.executionRate * 100)}%`} 
          subValue={`${metrics.totalExecuted} / ${metrics.totalPlanned}`}
          color="info"
        />
        <MetricCard 
          label="成功率 (SLO)" 
          value={`${Math.round(metrics.successRate * 100)}%`} 
          subValue={`目標値: ${Math.round(CURRENT_SLO.successRateMin * 100)}%以上`}
          color={metrics.successRate >= CURRENT_SLO.successRateMin ? 'success' : 'error'}
          highlight={metrics.successRate < CURRENT_SLO.successRateMin}
        />
        <MetricCard 
          label="MTTR (SLO)" 
          value={formatDuration(metrics.meanTimeToRemediateMs)} 
          subValue={`目標値: ${Math.floor(CURRENT_SLO.mttrGoalMs / 60000)}分以内`}
          color={(metrics.meanTimeToRemediateMs || 0) <= CURRENT_SLO.mttrGoalMs ? 'secondary' : 'warning'}
          highlight={(metrics.meanTimeToRemediateMs || 0) > CURRENT_SLO.mttrGoalMs}
        />
        <MetricCard 
          label="バックログ (SLO)" 
          value={String(metrics.backlogCount)} 
          subValue={`許容数: ${CURRENT_SLO.backlogLimitCount}件以下`}
          color={metrics.backlogCount <= CURRENT_SLO.backlogLimitCount ? 'success' : 'error'}
          highlight={metrics.backlogCount > CURRENT_SLO.backlogLimitCount}
        />
      </Stack>

      {/* SLO Violation/Breach Alert */}
      {compliance.violations.length > 0 && (
        <Alert 
          severity={compliance.status === 'breached' ? 'error' : 'warning'} 
          variant="filled"
          sx={{ mt: 2 }}
        >
          <AlertTitle sx={{ fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 1 }}>
            <GavelIcon fontSize="small" />
            {compliance.status === 'breached' ? 'SLO 違反 (SERVICE BREACH)' : 'SLO 未達成アラート (WARNING)'}
          </AlertTitle>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.8rem' }}>
            {compliance.violations.map((v, i) => (
              <li key={i} style={{ fontWeight: 500 }}>{v}</li>
            ))}
          </ul>
          {!compliance.autoRemediationAllowed && (
            <Typography variant="caption" sx={{ display: 'block', mt: 1, fontWeight: 'bold', borderTop: '1px solid rgba(255,255,255,0.3)', pt: 1 }}>
              ⚠️ ガバナンス制限: 品質目標未達のため、新規の自動実行プロセスをブロックしています。
            </Typography>
          )}
        </Alert>
      )}

      {/* 🤖 Robot Accountability Summary */}
      {(metrics.totalSkipped > 0 || metrics.totalExecuted > 0) && (
        <Paper variant="outlined" sx={{ mt: 2, p: 1.5, bgcolor: 'grey.50' }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              🤖 Auto-Executor Stats: 
              <Chip size="small" label="Today's Performance" sx={{ height: 16, fontSize: '0.6rem' }} />
            </Typography>
          </Stack>
          <Stack direction="row" spacing={3}>
            <SummaryItem label="実行済み" value={metrics.totalExecuted} color="success.main" />
            <SummaryItem label="Policy 見送り" value={metrics.skippedByPolicy} color="warning.main" />
            <SummaryItem label="Quota 超過" value={metrics.skippedByQuota} color="info.main" />
            <SummaryItem label="手動分析待ち" value={metrics.totalSkipped - metrics.skippedByPolicy - metrics.skippedByQuota} color="text.secondary" />
          </Stack>
        </Paper>
      )}
    </Box>
  );
};

const SummaryItem: React.FC<{ label: string, value: number, color: string }> = ({ label, value, color }) => (
  <Box>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>{label}</Typography>
    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color }}>{value} <Typography component="span" variant="caption">件</Typography></Typography>
  </Box>
);

interface MetricCardProps {
  label: string;
  value: string;
  subValue: string;
  color: 'success' | 'warning' | 'error' | 'info' | 'secondary';
  highlight?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, subValue, color, highlight }) => (
  <Paper 
    variant="outlined" 
    sx={{ 
      p: 2, 
      flex: 1, 
      borderLeft: 4, 
      borderLeftColor: `${color}.main`,
      bgcolor: highlight ? 'rgba(255, 0, 0, 0.02)' : 'inherit',
      borderColor: highlight ? `${color}.main` : 'divider',
      transition: 'all 0.3s ease'
    }}
  >
    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', display: 'block', mb: 1 }}>
      {label}
    </Typography>
    <Typography variant="h5" sx={{ fontWeight: 800 }}>
      {value}
    </Typography>
    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
      {subValue}
    </Typography>
  </Paper>
);
