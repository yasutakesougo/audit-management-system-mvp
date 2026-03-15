/**
 * AbcEvidencePanel — ABC記録の根拠データを氷山PDCAページに表示
 *
 * 選択されたユーザーのABC記録サマリーを表示し、
 * 最新5件のABC一覧、場面別・強度別の集計を可視化する。
 *
 * @module features/ibd/analysis/pdca/components/AbcEvidencePanel
 */

import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';

import type { AbcRecord, AbcIntensity } from '@/domain/abc/abcRecord';
import {
  countStrategyAdoptions,
  getTotalAdoptions,
  STRATEGY_KEYS,
  STRATEGY_LABELS,
  type StrategyAdoptionCounts,
} from '@/domain/isp/countStrategyAdoptions';
import {
  getTopReferencedAbcRecords,
  getTopReferencedPdcaItems,
  type TopReferencedItem,
} from '@/domain/isp/getTopReferencedEvidence';
import { localAbcRecordRepository } from '@/infra/localStorage/localAbcRecordRepository';
import { localEvidenceLinkRepository } from '@/infra/localStorage/localEvidenceLinkRepository';

// ── Constants ──
const ABC_INTENSITY_DISPLAY: Record<AbcIntensity, string> = {
  low: '軽度',
  medium: '中度',
  high: '重度',
};

const MAX_RECENT = 5;

// ── Types ──
interface AbcEvidencePanelProps {
  userId: string;
}

interface AbcSummary {
  total: number;
  todayCount: number;
  thisWeekCount: number;
  byIntensity: Record<AbcIntensity, number>;
  topSettings: { name: string; count: number }[];
  topBehaviors: { name: string; count: number }[];
  riskCount: number;
  recentRecords: AbcRecord[];
}

// ── Helpers ──
function buildSummary(records: AbcRecord[]): AbcSummary {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 6);
  const weekStart = weekAgo.toISOString().slice(0, 10);

  const byIntensity: Record<AbcIntensity, number> = { low: 0, medium: 0, high: 0 };
  const settingCounts: Record<string, number> = {};
  const behaviorCounts: Record<string, number> = {};
  let todayCount = 0;
  let thisWeekCount = 0;
  let riskCount = 0;

  for (const r of records) {
    const d = r.occurredAt.slice(0, 10);
    if (d === today) todayCount++;
    if (d >= weekStart) thisWeekCount++;
    byIntensity[r.intensity]++;
    if (r.riskFlag) riskCount++;
    if (r.setting) {
      settingCounts[r.setting] = (settingCounts[r.setting] || 0) + 1;
    }
    // Extract short behavior (first 15 chars)
    const shortB = r.behavior.slice(0, 15).trim();
    if (shortB) behaviorCounts[shortB] = (behaviorCounts[shortB] || 0) + 1;
  }

  const topSettings = Object.entries(settingCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const topBehaviors = Object.entries(behaviorCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const recentRecords = [...records]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, MAX_RECENT);

  return { total: records.length, todayCount, thisWeekCount, byIntensity, topSettings, topBehaviors, riskCount, recentRecords };
}

// ── Component ──
export const AbcEvidencePanel: React.FC<AbcEvidencePanelProps> = ({ userId }) => {
  const navigate = useNavigate();
  const [records, setRecords] = React.useState<AbcRecord[]>([]);
  const [expanded, setExpanded] = React.useState(true);
  const [adoptionCounts, setAdoptionCounts] = React.useState<StrategyAdoptionCounts | null>(null);
  const [topAbcRecords, setTopAbcRecords] = React.useState<TopReferencedItem[]>([]);
  const [topPdcaItems, setTopPdcaItems] = React.useState<TopReferencedItem[]>([]);

  React.useEffect(() => {
    let disposed = false;
    localAbcRecordRepository.getByUserId(userId).then(r => {
      if (!disposed) setRecords(r);
    });
    return () => { disposed = true; };
  }, [userId]);

  // 戦略別採用件数 + よく参照される根拠を取得
  React.useEffect(() => {
    if (records.length === 0) {
      setAdoptionCounts(null);
      setTopAbcRecords([]);
      setTopPdcaItems([]);
      return;
    }
    const userAbcIds = new Set(records.map(r => r.id));
    const allLinks = localEvidenceLinkRepository.getAll();
    setAdoptionCounts(countStrategyAdoptions(userAbcIds, allLinks));
    setTopAbcRecords(getTopReferencedAbcRecords(userAbcIds, allLinks, records));
    setTopPdcaItems(getTopReferencedPdcaItems(allLinks));
  }, [records]);

  const summary = React.useMemo(() => buildSummary(records), [records]);
  const totalAdoptions = adoptionCounts ? getTotalAdoptions(adoptionCounts) : 0;

  if (summary.total === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            <EditNoteRoundedIcon color="action" fontSize="small" />
            <Typography variant="subtitle2" color="text.secondary">
              ABC根拠データ
            </Typography>
            <Chip label="0件" size="small" variant="outlined" />
          </Stack>
          <Button
            size="small"
            variant="outlined"
            onClick={() => navigate(`/abc-record?userId=${encodeURIComponent(userId)}&source=iceberg-pdca`)}
            sx={{ textTransform: 'none' }}
          >
            ABC記録を作成
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          この利用者のABC記録がまだありません。記録を作成して分析の根拠データを蓄積しましょう。
        </Typography>
      </Paper>
    );
  }

  const intensityColor = (i: AbcIntensity): 'success' | 'warning' | 'error' =>
    i === 'low' ? 'success' : i === 'medium' ? 'warning' : 'error';

  return (
    <Paper variant="outlined" sx={{ mb: 2, overflow: 'hidden' }}>
      {/* ── Header ── */}
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2, py: 1.5, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
        onClick={() => setExpanded(e => !e)}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <EditNoteRoundedIcon color="primary" fontSize="small" />
          <Typography variant="subtitle2" fontWeight={700}>ABC根拠データ</Typography>
          <Chip label={`${summary.total}件`} size="small" color="primary" variant="outlined" />
          {summary.todayCount > 0 && (
            <Chip label={`今日 ${summary.todayCount}`} size="small" color="info" variant="filled" />
          )}
          {summary.riskCount > 0 && (
            <Chip label={`危険 ${summary.riskCount}`} size="small" color="error" variant="filled" />
          )}
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Button
            size="small"
            variant="outlined"
            onClick={(e) => { e.stopPropagation(); navigate(`/abc-record?userId=${encodeURIComponent(userId)}&source=iceberg-pdca`); }}
            sx={{ textTransform: 'none', mr: 1 }}
          >
            ABC記録へ
          </Button>
          <IconButton size="small">
            {expanded ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
          </IconButton>
        </Stack>
      </Stack>

      <Collapse in={expanded}>
        <Divider />
        <Box sx={{ px: 2, py: 1.5 }}>
          <Stack spacing={2}>
            {/* ── Stats Row ── */}
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              <Box sx={{ textAlign: 'center', minWidth: 60 }}>
                <Typography variant="h5" fontWeight={700} color="primary">{summary.total}</Typography>
                <Typography variant="caption" color="text.secondary">総件数</Typography>
              </Box>
              <Box sx={{ textAlign: 'center', minWidth: 60 }}>
                <Typography variant="h5" fontWeight={700} color="info.main">{summary.thisWeekCount}</Typography>
                <Typography variant="caption" color="text.secondary">今週</Typography>
              </Box>
              <Divider orientation="vertical" flexItem />
              {(['low', 'medium', 'high'] as AbcIntensity[]).map(i => (
                <Box key={i} sx={{ textAlign: 'center', minWidth: 50 }}>
                  <Typography variant="h6" fontWeight={700} color={`${intensityColor(i)}.main`}>
                    {summary.byIntensity[i]}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">{ABC_INTENSITY_DISPLAY[i]}</Typography>
                </Box>
              ))}
            </Stack>

            {/* ── Top Settings ── */}
            {summary.topSettings.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>多い場面</Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {summary.topSettings.map(s => (
                    <Chip key={s.name} label={`${s.name} (${s.count})`} size="small" variant="outlined" />
                  ))}
                </Stack>
              </Box>
            )}

            {/* ── Top Behaviors ── */}
            {summary.topBehaviors.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  よく見られる行動
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {summary.topBehaviors.slice(0, 3).map(b => (
                    <Chip key={b.name} label={`${b.name} (${b.count})`} size="small" variant="outlined" color="secondary" />
                  ))}
                </Stack>
              </Box>
            )}

            {/* ── Strategy Adoption Counts ── */}
            {adoptionCounts && totalAdoptions > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  支援計画での採用状況
                </Typography>
                <Stack spacing={0.5}>
                  {STRATEGY_KEYS.map(key => {
                    const count = adoptionCounts[key];
                    const maxCount = Math.max(...STRATEGY_KEYS.map(k => adoptionCounts[k]), 1);
                    const ratio = count / maxCount;
                    return (
                      <Stack key={key} direction="row" alignItems="center" spacing={1}>
                        <Typography variant="caption" sx={{ minWidth: 90 }}>
                          {STRATEGY_LABELS[key]}
                        </Typography>
                        <Box sx={{ flex: 1, height: 6, bgcolor: 'grey.200', borderRadius: 1, overflow: 'hidden' }}>
                          <Box
                            sx={{
                              width: `${ratio * 100}%`,
                              height: '100%',
                              bgcolor: key === 'antecedentStrategies' ? 'info.main'
                                : key === 'teachingStrategies' ? 'success.main'
                                : 'warning.main',
                              borderRadius: 1,
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </Box>
                        <Typography variant="caption" fontWeight={700} sx={{ minWidth: 24, textAlign: 'right' }}>
                          {count}
                        </Typography>
                      </Stack>
                    );
                  })}
                </Stack>
              </Box>
            )}

            {/* ── Top Referenced ABC ── */}
            {topAbcRecords.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  よく参照されるABC
                </Typography>
                <Stack spacing={0.25}>
                  {topAbcRecords.map(item => (
                    <Stack key={item.id} direction="row" alignItems="center" spacing={0.5}>
                      <Typography variant="caption" sx={{ flex: 1 }} noWrap>
                        {item.label}
                      </Typography>
                      <Chip
                        label={`${item.count}回採用`}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ height: 18, fontSize: '0.6rem' }}
                      />
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}

            {/* ── Top Referenced PDCA ── */}
            {topPdcaItems.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  よく参照されるPDCA
                </Typography>
                <Stack spacing={0.25}>
                  {topPdcaItems.map(item => (
                    <Stack key={item.id} direction="row" alignItems="center" spacing={0.5}>
                      <Typography variant="caption" sx={{ flex: 1 }} noWrap>
                        {item.label}
                      </Typography>
                      <Chip
                        label={`${item.count}回採用`}
                        size="small"
                        color="info"
                        variant="outlined"
                        sx={{ height: 18, fontSize: '0.6rem' }}
                      />
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}

            {/* ── Recent Records ── */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                最近のABC記録（{Math.min(summary.total, MAX_RECENT)}件）
              </Typography>
              <Stack spacing={0.75}>
                {summary.recentRecords.map(r => (
                  <Paper
                    key={r.id}
                    variant="outlined"
                    sx={{
                      px: 1.5, py: 0.75,
                      display: 'flex', alignItems: 'center', gap: 1,
                      borderLeftWidth: 3,
                      borderLeftColor: r.riskFlag ? 'error.main' : r.intensity === 'high' ? 'warning.main' : 'grey.300',
                    }}
                  >
                    <Typography variant="caption" color="primary.main" fontWeight={700} sx={{ minWidth: 72 }}>
                      {new Date(r.occurredAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                      {' '}
                      {new Date(r.occurredAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                    {r.setting && (
                      <Chip label={r.setting} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                    )}
                    <Tooltip title={`A: ${r.antecedent}\nB: ${r.behavior}\nC: ${r.consequence}`}>
                      <Typography variant="body2" noWrap sx={{ flex: 1, cursor: 'help' }}>
                        {r.behavior}
                      </Typography>
                    </Tooltip>
                    <Chip
                      label={ABC_INTENSITY_DISPLAY[r.intensity]}
                      size="small"
                      color={intensityColor(r.intensity)}
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.65rem' }}
                    />
                  </Paper>
                ))}
              </Stack>
            </Box>
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
};
