/**
 * 制度遵守ダッシュボード — RegulatoryDashboardPage
 *
 * 監査判定エンジンの結果を集計カード + findings テーブルで表示。
 * 重度障害者支援加算の判定結果も統合して表示。
 * デモモード（Repository 未接続）ではサンプルデータで動作確認可能。
 */
import React, { useCallback, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import GavelIcon from '@mui/icons-material/Gavel';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useNavigate } from 'react-router-dom';

import { summarizeFindings } from '@/domain/regulatory';
import {
  _resetAddonFindingCounter,
  buildSevereAddonFindings,
  summarizeSevereAddonFindings,
} from '@/domain/regulatory/severeAddonFindings';
import { resolveAllFindingEvidence } from '@/domain/regulatory/findingEvidenceSummary';
import SafetyOperationsSummaryCard from '@/features/safety/components/SafetyOperationsSummaryCard';
import { useIcebergEvidence } from '@/features/ibd/analysis/pdca/queries/useIcebergEvidence';
import { useSevereAddonRealData } from '@/features/regulatory/hooks/useSevereAddonRealData';
import { useRegulatoryFindingsRealData } from '@/features/regulatory/hooks/useRegulatoryFindingsRealData';
import { useProcedureRecordRepository } from '@/features/regulatory/hooks/useProcedureRecordRepository';
import { useMonitoringMeetingRepository } from '@/features/monitoring/data/useMonitoringMeetingRepository';
import {
  buildHandoffFromRegularFinding,
  buildHandoffFromAddonFinding,
} from '@/domain/regulatory/findingToHandoff';
import {
  useCreateHandoffFromExternalSource,
} from '@/features/handoff/useCreateHandoffFromExternalSource';
import { useUsers } from '@/features/users/useUsers';
import { useStaff } from '@/stores/useStaff';
import { usePlanningSheetRepositories } from '@/features/planning-sheet/hooks/usePlanningSheetRepositories';
import {
  localWeeklyObservationRepository,
  localQualificationAssignmentRepository,
} from '@/infra/localStorage/localStaffQualificationRepository';

// ── Local (split) ──
import type { AuditFindingSeverity, UnifiedFindingRow } from './regulatory-dashboard/types';
import { unifyFindings } from './regulatory-dashboard/types';
import { generateDemoFindings, generateDemoSevereAddonFindings, generateDemoIcebergEvidence } from './regulatory-dashboard/demoData';
import { SummaryCard, TypeBreakdown, DomainSummary } from './regulatory-dashboard/SummaryPanel';
import { SevereAddonSummaryPanel } from './regulatory-dashboard/SevereAddonPanel';
import { FindingsTable } from './regulatory-dashboard/FindingsTable';

// ─────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────

const RegulatoryDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [filterSeverity, setFilterSeverity] = useState<AuditFindingSeverity | 'all'>('all');
  const [filterSource, setFilterSource] = useState<'all' | 'regular' | 'addon'>('all');
  const [filterDomain, setFilterDomain] = useState<'all' | 'isp' | 'sheet'>('all');
  const [sentFindingKeys, setSentFindingKeys] = useState<Set<string>>(new Set());
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'info' }>({ open: false, message: '', severity: 'success' });
  const createHandoff = useCreateHandoffFromExternalSource();

  // ── データ取得（共通） ──
  const { data: spUsers, status: usersStatus, error: usersError } = useUsers({ selectMode: 'full' });
  const { staff: spStaff, isLoading: staffLoading, error: staffError } = useStaff();
  const planningSheetRepo = usePlanningSheetRepositories();
  const procedureRecordRepo = useProcedureRecordRepository();
  const monitoringMeetingRepo = useMonitoringMeetingRepository();
  const dataLoading = usersStatus === 'loading' || staffLoading;
  const dataError = usersError ? (usersError instanceof Error ? usersError : new Error(String(usersError))) : staffError;

  // 通常 findings — 実データ / デモフォールバック
  const {
    findings: realFindings,
    isLoading: findingsLoading,
    dataSourceLabel: findingsDataSource,
  } = useRegulatoryFindingsRealData(
    spUsers,
    spStaff,
    dataLoading,
    dataError,
    planningSheetRepo,
    procedureRecordRepo,
    monitoringMeetingRepo,
  );
  const findings = useMemo(
    () => (realFindings.length > 0 ? realFindings : generateDemoFindings()),
    [realFindings],
  );
  const summary = useMemo(() => summarizeFindings(findings), [findings]);

  // 加算系 findings — 実データ / デモフォールバック
  const { input: realAddonInput, dataSourceLabel: addonDataSource } = useSevereAddonRealData(
    spUsers,
    spStaff,
    dataLoading,
    dataError,
    planningSheetRepo,
    localWeeklyObservationRepository,
    localQualificationAssignmentRepository,
  );
  const addonFindings = useMemo(() => {
    if (realAddonInput) {
      _resetAddonFindingCounter();
      return buildSevereAddonFindings(realAddonInput);
    }
    return generateDemoSevereAddonFindings();
  }, [realAddonInput]);
  const addonSummary = useMemo(() => summarizeSevereAddonFindings(addonFindings), [addonFindings]);

  // 統合行データ
  const unifiedRows = useMemo(
    () => unifyFindings(findings, addonFindings),
    [findings, addonFindings],
  );

  // 統合 totals
  const totalAll = findings.length + addonFindings.length;
  const totalHigh = summary.high + addonFindings.filter(f => f.severity === 'high').length;
  const totalMedium = summary.medium + addonFindings.filter(f => f.severity === 'medium').length;
  const totalLow = summary.low + addonFindings.filter(f => f.severity === 'low').length;

  // 領域別集計
  const ispCount = (summary.byDomain?.isp || 0) + (addonSummary.byDomain?.isp || 0);
  const sheetCount = (summary.byDomain?.sheet || 0) + (addonSummary.byDomain?.sheet || 0);

  // P2: Iceberg 実データ接続 — useIcebergEvidence + デモフォールバック
  const demoUserId = findings[0]?.userId ?? null;
  const { data: liveEvidence, isLoading: isEvidenceLoading } = useIcebergEvidence(demoUserId);
  const isLiveData = liveEvidence !== null && !isEvidenceLoading;
  const icebergEvidence = useMemo(
    () => liveEvidence ?? generateDemoIcebergEvidence(),
    [liveEvidence],
  );
  const evidenceMap = useMemo(
    () => resolveAllFindingEvidence(findings, icebergEvidence),
    [findings, icebergEvidence],
  );

  // P6: finding → handoff 送信ハンドラ
  const handleSendToHandoff = useCallback(async (row: UnifiedFindingRow) => {
    try {
      const handoffInput = row.source === 'regular' && row.originalRegular
        ? buildHandoffFromRegularFinding(row.originalRegular)
        : row.originalAddon
          ? buildHandoffFromAddonFinding(row.originalAddon)
          : null;

      if (!handoffInput) return;

      const source: import('@/features/handoff/useCreateHandoffFromExternalSource').HandoffExternalSource = {
        sourceType: handoffInput.sourceType,
        sourceId: 0,
        sourceUrl: '/regulatory',
        sourceKey: handoffInput.sourceKey,
        sourceLabel: handoffInput.sourceLabel,
      };

      const result = await createHandoff({
        title: handoffInput.title,
        body: handoffInput.body,
        source,
        category: handoffInput.category,
        severity: handoffInput.severity,
      });

      setSentFindingKeys(prev => {
        const next = new Set(prev);
        next.add(handoffInput.sourceKey);
        return next;
      });

      setSnackbar({
        open: true,
        message: result.created
          ? `申し送りを作成しました：${handoffInput.title}`
          : `既存の申し送りがあります（ID: ${result.itemId}）`,
        severity: result.created ? 'success' : 'info',
      });
    } catch (error) {
      console.error('Failed to create handoff from finding:', error);
      setSnackbar({
        open: true,
        message: '申し送りの作成に失敗しました',
        severity: 'info',
      });
    }
  }, [createHandoff]);

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
            支援計画シートの制度要件充足状況・重度障害者支援加算の判定結果を一覧表示
          </Typography>
        </Box>
        <Chip
          label={isEvidenceLoading ? '根拠データ読込中…' : isLiveData ? 'Live データ' : 'デモデータ'}
          size="small"
          color={isLiveData ? 'success' : 'default'}
          variant={isLiveData ? 'filled' : 'outlined'}
          sx={{ ml: 'auto', fontWeight: 600, fontSize: '0.7rem' }}
        />
        <Chip
          label={findingsLoading ? '通常判定読込中…' : `通常: ${findingsDataSource}`}
          size="small"
          color={findingsDataSource === '実データ' ? 'success' : 'default'}
          variant={findingsDataSource === '実データ' ? 'filled' : 'outlined'}
          sx={{ fontWeight: 600, fontSize: '0.7rem' }}
        />
        <Chip
          label={`加算: ${addonDataSource}`}
          size="small"
          color={addonDataSource === '実データ' ? 'success' : 'default'}
          variant={addonDataSource === '実データ' ? 'filled' : 'outlined'}
          sx={{ fontWeight: 600, fontSize: '0.7rem' }}
        />
      </Box>

      {/* 統合集計カード */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          mb: 3,
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        }}
      >
        <SummaryCard title="要対応 合計" count={totalAll} color="#1976d2" icon={<GavelIcon fontSize="large" />} />
        <SummaryCard title="高リスク" count={totalHigh} color="#d32f2f" icon={<ErrorOutlineIcon fontSize="large" />} />
        <SummaryCard title="中リスク" count={totalMedium} color="#ed6c02" icon={<WarningAmberIcon fontSize="large" />} />
        <SummaryCard title="低リスク / 算定候補" count={totalLow} color="#0288d1" icon={<InfoOutlinedIcon fontSize="large" />} />
      </Box>

      {/* 領域別サマリー行 */}
      <Box sx={{ mb: 3 }}>
        <DomainSummary ispCount={ispCount} sheetCount={sheetCount} />
      </Box>

      {/* 種別内訳 + 加算サマリー + 安全管理サマリ */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          mb: 3,
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 380px' },
        }}
      >
        <TypeBreakdown summary={summary} addonSummary={addonSummary} />
        <SevereAddonSummaryPanel
          addonSummary={addonSummary}
          onNavigate={(url) => navigate(url)}
          onFilterAddon={() => {
            setFilterSource('addon');
            document.getElementById('findings-table-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
        <SafetyOperationsSummaryCard />
      </Box>

      {/* フィルター */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="filter-domain-label">領域</InputLabel>
          <Select
            labelId="filter-domain-label"
            label="領域"
            value={filterDomain}
            onChange={(e) => setFilterDomain(e.target.value as 'all' | 'isp' | 'sheet')}
          >
            <MenuItem value="all">すべての領域</MenuItem>
            <MenuItem value="isp">個別支援計画</MenuItem>
            <MenuItem value="sheet">支援計画シート</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="filter-source-label">検出ソース</InputLabel>
          <Select
            labelId="filter-source-label"
            label="検出ソース"
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value as 'all' | 'regular' | 'addon')}
          >
            <MenuItem value="all">すべてのソース</MenuItem>
            <MenuItem value="regular">制度監査エンジン</MenuItem>
            <MenuItem value="addon">加算判定エンジン</MenuItem>
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

        <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
          {unifiedRows.length} 件の検出事項
          {addonFindings.length > 0 && (
            <Chip
              label={`うち加算 ${addonFindings.length} 件`}
              size="small"
              color="secondary"
              variant="outlined"
              sx={{ ml: 1, fontWeight: 600, fontSize: '0.65rem' }}
            />
          )}
        </Typography>
      </Box>

      {/* 統合 findings テーブル */}
      <Box id="findings-table-section">
        <FindingsTable
          rows={unifiedRows}
          filterSeverity={filterSeverity}
          filterSource={filterSource}
          filterDomain={filterDomain}
          onNavigate={(url) => navigate(url)}
          evidenceMap={evidenceMap}
          onSendToHandoff={handleSendToHandoff}
          sentFindingKeys={sentFindingKeys}
        />
      </Box>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default RegulatoryDashboardPage;
