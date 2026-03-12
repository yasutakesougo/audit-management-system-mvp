/**
 * 制度遵守ダッシュボード — RegulatoryDashboardPage
 *
 * 監査判定エンジンの結果を集計カード + findings テーブルで表示。
 * デモモード（Repository 未接続）ではサンプルデータで動作確認可能。
 */
import React, { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import GavelIcon from '@mui/icons-material/Gavel';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import { useNavigate } from 'react-router-dom';

import {
  type AuditFinding,
  type AuditFindingSeverity,
  type AuditFindingType,
  type AuditSummary,
  AUDIT_FINDING_TYPE_LABELS,
  buildRegulatoryFindings,
  summarizeFindings,
  _resetFindingCounter,
} from '@/domain/regulatory';
import { buildFindingActions, type FindingAction } from '@/domain/regulatory/buildFindingActions';

// ─────────────────────────────────────────────
// デモデータ
// ─────────────────────────────────────────────

function generateDemoFindings(): AuditFinding[] {
  _resetFindingCounter();
  return buildRegulatoryFindings({
    userProfile: {
      userId: 'U001',
      behaviorScore: 14,
      childBehaviorScore: null,
      disabilitySupportLevel: '4',
      serviceTypes: ['daily_life_care'],
      severeBehaviorSupportEligible: true,
      eligibilityCheckedAt: '2026-02-01',
    },
    sheets: [
      {
        id: 'sheet-1',
        userId: 'U001',
        title: '食事場面の支援計画',
        authoredByStaffId: 'S001',
        applicableAddOnTypes: ['severe_disability_support'],
        nextReviewAt: '2026-06-01',
        deliveredToUserAt: '2026-03-05',
        status: 'active',
        isCurrent: true,
      },
      {
        id: 'sheet-2',
        userId: 'U001',
        title: '移動場面の支援計画',
        authoredByStaffId: 'S002',
        applicableAddOnTypes: ['severe_disability_support'],
        nextReviewAt: '2026-01-15',
        deliveredToUserAt: null,
        status: 'active',
        isCurrent: true,
      },
    ],
    staffProfiles: new Map([
      ['S001', { staffId: 'S001', hasPracticalTraining: true, hasBasicTraining: true, hasBehaviorGuidanceTraining: false, hasCorePersonTraining: false, certificationCheckedAt: '2026-01-15' }],
      ['S002', { staffId: 'S002', hasPracticalTraining: false, hasBasicTraining: true, hasBehaviorGuidanceTraining: false, hasCorePersonTraining: false, certificationCheckedAt: '2026-01-15' }],
    ]),
    records: [
      { id: 'rec-1', planningSheetId: 'sheet-1', recordDate: '2026-03-10' },
    ],
    today: new Date().toISOString().slice(0, 10),
  });
}

// ─────────────────────────────────────────────
// severity 表示ヘルパー
// ─────────────────────────────────────────────

const SEVERITY_CONFIG: Record<AuditFindingSeverity, { color: 'error' | 'warning' | 'info'; label: string; icon: React.ReactNode }> = {
  high: { color: 'error', label: '高', icon: <ErrorOutlineIcon fontSize="small" /> },
  medium: { color: 'warning', label: '中', icon: <WarningAmberIcon fontSize="small" /> },
  low: { color: 'info', label: '低', icon: <InfoOutlinedIcon fontSize="small" /> },
};

// ─────────────────────────────────────────────
// サブコンポーネント
// ─────────────────────────────────────────────

interface SummaryCardProps {
  title: string;
  count: number;
  color: string;
  icon: React.ReactNode;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, count, color, icon }) => (
  <Card
    variant="outlined"
    sx={{
      p: 2.5,
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      borderLeft: `4px solid ${color}`,
      transition: 'box-shadow 0.2s ease-in-out',
      '&:hover': { boxShadow: 3 },
    }}
  >
    <Box sx={{ color, display: 'flex', alignItems: 'center' }}>{icon}</Box>
    <Box>
      <Typography variant="h4" fontWeight={800} color={color}>
        {count}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
    </Box>
  </Card>
);

interface TypeBreakdownProps {
  summary: AuditSummary;
}

const TypeBreakdown: React.FC<TypeBreakdownProps> = ({ summary }) => (
  <Card variant="outlined" sx={{ p: 2.5 }}>
    <Typography variant="subtitle2" fontWeight={700} gutterBottom>
      検出種別
    </Typography>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
      {(Object.entries(summary.byType) as [AuditFindingType, number][]).map(([type, count]) => (
        <Chip
          key={type}
          label={`${AUDIT_FINDING_TYPE_LABELS[type]}: ${count}`}
          size="small"
          variant={count > 0 ? 'filled' : 'outlined'}
          color={count > 0 ? 'warning' : 'default'}
          sx={{ fontWeight: count > 0 ? 700 : 400 }}
        />
      ))}
    </Box>
  </Card>
);

interface FindingsTableProps {
  findings: AuditFinding[];
  filterType: AuditFindingType | 'all';
  filterSeverity: AuditFindingSeverity | 'all';
  onNavigate: (url: string) => void;
}

const FindingsTable: React.FC<FindingsTableProps> = ({ findings, filterType, filterSeverity, onNavigate }) => {
  const filtered = useMemo(() => {
    let result = [...findings];
    if (filterType !== 'all') result = result.filter(f => f.type === filterType);
    if (filterSeverity !== 'all') result = result.filter(f => f.severity === filterSeverity);
    // severity 順: high → medium → low
    const order: Record<AuditFindingSeverity, number> = { high: 0, medium: 1, low: 2 };
    result.sort((a, b) => order[a.severity] - order[b.severity]);
    return result;
  }, [findings, filterType, filterSeverity]);

  if (filtered.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <CheckCircleOutlineIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
        <Typography variant="h6" color="text.secondary">
          該当する検出事項はありません
        </Typography>
        <Typography variant="body2" color="text.secondary">
          すべての制度要件が充足されています
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'grey.50' }}>
            <TableCell sx={{ fontWeight: 700, width: 60 }}>重要度</TableCell>
            <TableCell sx={{ fontWeight: 700, width: 180 }}>検出種別</TableCell>
            <TableCell sx={{ fontWeight: 700, width: 100 }}>利用者</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>メッセージ</TableCell>
            <TableCell sx={{ fontWeight: 700, width: 120 }}>期限</TableCell>
            <TableCell sx={{ fontWeight: 700, width: 160 }}>対応</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filtered.map(f => {
            const cfg = SEVERITY_CONFIG[f.severity];
            return (
              <TableRow key={f.id} hover>
                <TableCell>
                  <Chip
                    icon={cfg.icon as React.ReactElement}
                    label={cfg.label}
                    color={cfg.color}
                    size="small"
                    variant="filled"
                    sx={{ fontWeight: 700 }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>
                    {AUDIT_FINDING_TYPE_LABELS[f.type]}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {f.userName || f.userId}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {f.message}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color={f.overdueDays && f.overdueDays < 0 ? 'error.main' : 'text.secondary'}>
                    {f.dueDate || '—'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {buildFindingActions(f).map((action: FindingAction, i: number) => (
                      <Button
                        key={i}
                        size="small"
                        variant={action.kind === 'execute' ? 'contained' : 'outlined'}
                        color={
                          action.kind === 'execute' ? 'primary'
                            : action.kind === 'evidence' ? 'secondary'
                            : 'inherit'
                        }
                        startIcon={
                          action.kind === 'evidence'
                            ? <PsychologyRoundedIcon sx={{ fontSize: 14 }} />
                            : <OpenInNewRoundedIcon sx={{ fontSize: 14 }} />
                        }
                        onClick={() => onNavigate(action.url)}
                        sx={{
                          fontSize: '0.7rem',
                          textTransform: 'none',
                          py: 0.25,
                          px: 1,
                          minWidth: 'auto',
                        }}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

// ─────────────────────────────────────────────
// メインページ
// ─────────────────────────────────────────────

const RegulatoryDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState<AuditFindingType | 'all'>('all');
  const [filterSeverity, setFilterSeverity] = useState<AuditFindingSeverity | 'all'>('all');

  // デモモード: サンプルデータで動作確認
  const findings = useMemo(() => generateDemoFindings(), []);
  const summary = useMemo(() => summarizeFindings(findings), [findings]);

  return (
    <Container maxWidth="xl" sx={{ py: 3, minHeight: '100vh' }} data-testid="regulatory-dashboard-page">
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <GavelIcon sx={{ fontSize: 32, color: 'primary.main' }} />
        <Box>
          <Typography variant="h5" fontWeight={800}>
            制度遵守ダッシュボード
          </Typography>
          <Typography variant="body2" color="text.secondary">
            支援計画シートの制度要件充足状況と監査リスクを一覧表示
          </Typography>
        </Box>
      </Box>

      {/* 集計カード */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          mb: 3,
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        }}
      >
        <SummaryCard title="要対応 合計" count={summary.total} color="#1976d2" icon={<GavelIcon fontSize="large" />} />
        <SummaryCard title="高リスク" count={summary.high} color="#d32f2f" icon={<ErrorOutlineIcon fontSize="large" />} />
        <SummaryCard title="中リスク" count={summary.medium} color="#ed6c02" icon={<WarningAmberIcon fontSize="large" />} />
        <SummaryCard title="低リスク / 算定候補" count={summary.low} color="#0288d1" icon={<InfoOutlinedIcon fontSize="large" />} />
      </Box>

      {/* 種別内訳 */}
      <Box sx={{ mb: 3 }}>
        <TypeBreakdown summary={summary} />
      </Box>

      {/* フィルター */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="filter-type-label">検出種別</InputLabel>
          <Select
            labelId="filter-type-label"
            label="検出種別"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as AuditFindingType | 'all')}
          >
            <MenuItem value="all">すべて</MenuItem>
            {Object.entries(AUDIT_FINDING_TYPE_LABELS).map(([key, label]) => (
              <MenuItem key={key} value={key}>{label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="filter-severity-label">重要度</InputLabel>
          <Select
            labelId="filter-severity-label"
            label="重要度"
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value as AuditFindingSeverity | 'all')}
          >
            <MenuItem value="all">すべて</MenuItem>
            <MenuItem value="high">高</MenuItem>
            <MenuItem value="medium">中</MenuItem>
            <MenuItem value="low">低</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* findings テーブル */}
      <FindingsTable findings={findings} filterType={filterType} filterSeverity={filterSeverity} onNavigate={(url) => navigate(url)} />
    </Container>
  );
};

export default RegulatoryDashboardPage;
