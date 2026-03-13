// ---------------------------------------------------------------------------
// SafetyOperationsSummaryCard — 安全管理サマリカード
//
// RegulatoryDashboardPage に組み込む1枚カード。
// P0-1/P0-2/P0-3 の全安全管理サマリを横串で表示し、
// ComplianceDashboard への詳細導線を提供する。
// ---------------------------------------------------------------------------

import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DescriptionIcon from '@mui/icons-material/Description';
import GroupsIcon from '@mui/icons-material/Groups';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import SchoolIcon from '@mui/icons-material/School';
import SecurityIcon from '@mui/icons-material/Security';
import ShieldIcon from '@mui/icons-material/Shield';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useNavigate } from 'react-router-dom';

import {
  useSafetyOperationsSummary,
  type SafetyOperationsSummary,
} from '@/features/safety/hooks/useSafetyOperationsSummary';

// ---------------------------------------------------------------------------
// Level Helpers
// ---------------------------------------------------------------------------

const LEVEL_CONFIG = {
  good: { color: '#2e7d32', label: '基準充足', icon: <CheckCircleIcon /> },
  warning: { color: '#ed6c02', label: '要注意', icon: <WarningAmberIcon /> },
  critical: { color: '#d32f2f', label: '要対応', icon: <ReportProblemIcon /> },
} as const;

// ---------------------------------------------------------------------------
// Mini KPI
// ---------------------------------------------------------------------------

interface MiniKpiProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  met: boolean;
}

const MiniKpi: React.FC<MiniKpiProps> = ({ icon, label, value, met }) => (
  <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 0.75 }}>
    <Box sx={{ color: met ? 'success.main' : 'warning.main', display: 'flex' }}>
      {icon}
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary" noWrap>
        {label}
      </Typography>
    </Box>
    <Typography
      variant="body2"
      fontWeight={700}
      color={met ? 'success.main' : 'warning.main'}
    >
      {value}
    </Typography>
    {met ? (
      <CheckCircleIcon fontSize="small" color="success" />
    ) : (
      <WarningAmberIcon fontSize="small" color="warning" />
    )}
  </Stack>
);

// ---------------------------------------------------------------------------
// Card Content
// ---------------------------------------------------------------------------

interface ContentProps {
  summary: SafetyOperationsSummary;
  onNavigate: () => void;
}

const CardBody: React.FC<ContentProps> = ({ summary, onNavigate }) => {
  const levelCfg = LEVEL_CONFIG[summary.overallLevel];

  return (
    <CardContent>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <ShieldIcon sx={{ color: 'primary.main' }} />
        <Typography variant="subtitle1" fontWeight={700}>
          安全管理サマリ
        </Typography>
        <Chip
          icon={levelCfg.icon as React.ReactElement}
          label={levelCfg.label}
          size="small"
          sx={{
            ml: 'auto',
            bgcolor: `${levelCfg.color}15`,
            color: levelCfg.color,
            fontWeight: 700,
            fontSize: '0.7rem',
          }}
        />
      </Stack>

      {/* Action Required Banner */}
      {summary.actionRequiredCount > 0 && (
        <Box
          sx={{
            bgcolor: `${levelCfg.color}08`,
            border: `1px solid ${levelCfg.color}30`,
            borderRadius: 1,
            px: 2,
            py: 1,
            mb: 2,
          }}
        >
          <Typography variant="body2" fontWeight={700} color={levelCfg.color}>
            要対応事項: {summary.actionRequiredCount}件
          </Typography>
        </Box>
      )}

      {/* Compliance KPIs */}
      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        適正化三要素
      </Typography>

      <MiniKpi
        icon={<GroupsIcon fontSize="small" />}
        label="委員会（年4回）"
        value={`${summary.committee.currentFiscalYearMeetings} / 4回`}
        met={summary.committee.meetsQuarterlyRequirement}
      />
      <MiniKpi
        icon={<DescriptionIcon fontSize="small" />}
        label="指針（7項目充足）"
        value={`${summary.guideline.currentFulfilledItems} / 7`}
        met={summary.guideline.allItemsFulfilled}
      />
      <MiniKpi
        icon={<SchoolIcon fontSize="small" />}
        label="研修（年2回）"
        value={`${summary.training.currentFiscalYearTrainings} / 2回`}
        met={summary.training.meetsBiannualRequirement}
      />

      <Divider sx={{ my: 1.5 }} />

      {/* Incident & Restraint */}
      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        記録状況（直近30日）
      </Typography>

      <Stack direction="row" spacing={2} sx={{ py: 0.5 }}>
        <Box>
          <Typography variant="body2" color="text.secondary">
            インシデント
          </Typography>
          <Typography variant="h6" fontWeight={800}>
            {summary.incident.last30Days}
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
              件
            </Typography>
          </Typography>
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">
            身体拘束
          </Typography>
          <Typography variant="h6" fontWeight={800}>
            {summary.restraint.last30Days}
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
              件
            </Typography>
          </Typography>
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">
            未承認拘束
          </Typography>
          <Typography
            variant="h6"
            fontWeight={800}
            color={summary.restraint.pendingApproval > 0 ? 'error.main' : 'text.primary'}
          >
            {summary.restraint.pendingApproval}
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
              件
            </Typography>
          </Typography>
        </Box>
      </Stack>

      <Divider sx={{ my: 1.5 }} />

      {/* Detail Link */}
      <Button
        fullWidth
        variant="outlined"
        size="small"
        startIcon={<SecurityIcon />}
        endIcon={<OpenInNewRoundedIcon sx={{ fontSize: 14 }} />}
        onClick={onNavigate}
        sx={{
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.8rem',
        }}
      >
        適正化運用ダッシュボードを開く
      </Button>
    </CardContent>
  );
};

// ---------------------------------------------------------------------------
// Exported Card Component
// ---------------------------------------------------------------------------

const SafetyOperationsSummaryCard: React.FC = () => {
  const navigate = useNavigate();
  const { summary, loading } = useSafetyOperationsSummary();

  if (loading) {
    return (
      <Card variant="outlined" data-testid="safety-operations-summary-card">
        <CardContent>
          <LinearProgress />
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  return (
    <Card
      variant="outlined"
      data-testid="safety-operations-summary-card"
      sx={{
        borderLeft: `4px solid ${LEVEL_CONFIG[summary.overallLevel].color}`,
        transition: 'box-shadow 0.2s ease-in-out',
        '&:hover': { boxShadow: 3 },
      }}
    >
      <CardBody
        summary={summary}
        onNavigate={() => navigate('/admin/compliance-dashboard')}
      />
    </Card>
  );
};

export default SafetyOperationsSummaryCard;
