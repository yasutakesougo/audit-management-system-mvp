import React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckIcon from '@mui/icons-material/Check';
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown';
import EqualizerIcon from '@mui/icons-material/Equalizer';

import { SectionTitle } from '../components/SectionTitle';
import type { FormState } from '../types';
import { calculateMonitoringSchedule } from '@/features/planning-sheet/monitoringSchedule';
import { useReverseBridge } from '@/features/planning-sheet/hooks/useReverseBridge';
import KioskMonitoringEvidencePanel from '@/features/monitoring/components/KioskMonitoringEvidencePanel';
import { AbcEvidenceListPanel, type AbcEvidenceListPanelProps } from '@/features/monitoring/components/AbcEvidenceListPanel';
import type { AbcRecord } from '@/domain/abc/abcRecord';
import type { MonitoringEvidenceLink } from '@/domain/isp/schema/ispPlanningSheetSchema';

interface SectionMonitoringProps {
  form: FormState;
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  userId?: string;
  isAdmin?: boolean;
  abcEvidenceRecords?: AbcRecord[];
  abcEvidenceLoading?: boolean;
  abcEvidencePeriod?: AbcEvidenceListPanelProps['period'];
  abcEvidenceError?: Error | null;
}

export const SectionMonitoring: React.FC<SectionMonitoringProps> = ({
  form,
  updateField,
  userId,
  isAdmin = true,
  abcEvidenceRecords = [],
  abcEvidenceLoading = false,
  abcEvidencePeriod = null,
  abcEvidenceError = null,
}) => {
  const { suggestions, isLoading: isBridgeLoading, error: bridgeError } = useReverseBridge(userId, form.supportStartDate);

  const schedule = React.useMemo(() => {
    if (!form.supportStartDate) return null;
    return calculateMonitoringSchedule(form.supportStartDate, form.monitoringCycleDays);
  }, [form.supportStartDate, form.monitoringCycleDays]);

  const schedulePreview = schedule ? (
    <Alert icon={false} severity="info" sx={{ mt: 1, py: 0.5, px: 2, border: '1px solid #93c5fd', bgcolor: '#eff6ff', borderRadius: 2 }}>
      <Typography variant="caption" color="primary.main" fontWeight={800}>
        🗓️ 次回予定日: {schedule.nextMonitoringDate} （{form.monitoringCycleDays}日周期）
      </Typography>
    </Alert>
  ) : null;

  return (
    <Stack spacing={2}>
      <SectionTitle number={9} title="モニタリング" desc="支援の効果を定量的・定性的に評価する" />
      <TextField label="評価指標" value={form.evaluationIndicator} onChange={e => updateField('evaluationIndicator', e.target.value)} required fullWidth multiline minRows={2}
        placeholder="何を指標とするか（頻度、持続時間、代替行動の使用率など）" />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField label="評価期間" value={form.evaluationPeriod} onChange={e => updateField('evaluationPeriod', e.target.value)} fullWidth
          placeholder="例: 毎月末に月次評価" />
        <TextField type="number" label="モニタリング周期（日）" value={form.monitoringCycleDays} onChange={e => updateField('monitoringCycleDays', Number(e.target.value) || 90)} fullWidth
          inputProps={{ min: 1, max: 365 }} />
      </Stack>
      {schedulePreview}
      <TextField label="評価方法" value={form.evaluationMethod} onChange={e => updateField('evaluationMethod', e.target.value)} fullWidth multiline minRows={2}
        placeholder="ABC記録集計、グラフ化、カンファレンス" />

      {/* Dedicated ABC 記録 (評価根拠候補) */}
      {userId && (
        <AbcEvidenceListPanel
          records={abcEvidenceRecords}
          loading={abcEvidenceLoading}
          error={abcEvidenceError}
          period={abcEvidencePeriod}
          monitoringCycleDays={form.monitoringCycleDays || 90}
          isCited={(form.monitoringEvidenceLinks || []).some(
            (link: MonitoringEvidenceLink) => link.source === 'dedicated-abc' &&
                           link.recordIds.some((id: string) => abcEvidenceRecords.map((r: AbcRecord) => r.id).includes(id))
          )}
          onCiteDraft={(draft, recordIds) => {
            const appendText = (current: string | undefined, append: string) => {
              const cur = (current || '').trim();
              if (!cur) return append;
              if (cur.includes(append.trim())) return cur;
              return `${cur}\n\n${append}`;
            };

            const nextEvaluationMethod = appendText(form.evaluationMethod, draft.evaluationMethod);
            const nextImprovementResult = appendText(form.improvementResult, draft.improvementResult);
            const nextNextSupport = appendText(form.nextSupport, draft.nextSupport);

            const newLink = {
              source: 'dedicated-abc' as const,
              sourceList: 'AbcBehaviorRecords' as const,
              recordIds: recordIds,
              period: {
                from: abcEvidencePeriod?.from || '',
                to: abcEvidencePeriod?.to || '',
              },
              generatedAt: new Date().toISOString(),
              citedFields: ['evaluationMethod', 'improvementResult', 'nextSupport'] as ('evaluationMethod' | 'improvementResult' | 'nextSupport')[],
            };

            const nextLinks = [...(form.monitoringEvidenceLinks || []), newLink];

            updateField('evaluationMethod', nextEvaluationMethod);
            updateField('improvementResult', nextImprovementResult);
            updateField('nextSupport', nextNextSupport);
            updateField('monitoringEvidenceLinks', nextLinks);
          }}
        />
      )}

      {/* キオスク記録（17手順）統計ドラフト */}
      {userId && (
        <KioskMonitoringEvidencePanel
          userId={userId}
          onAppendInsight={(text) => {
            const current = form.improvementResult || '';
            updateField('improvementResult', current ? `${current}\n\n${text}` : text);
          }}
          isAdmin={isAdmin}
        />
      )}

      {/* L3-to-L2 Reverse-Bridge 自動提案 */}
      {userId && (
        <Box sx={{ my: 1 }}>
          {isBridgeLoading && (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fafafc', borderColor: '#e2e8f0', borderStyle: 'dashed', borderRadius: 3 }}>
              <Stack direction="row" spacing={2} alignItems="center" justifyContent="center">
                <CircularProgress size={20} color="secondary" />
                <Typography variant="body2" color="text.secondary" fontWeight={600}>
                  🤖 日々の記録実績（L3）から評価案を自動生成中...
                </Typography>
              </Stack>
            </Paper>
          )}

          {bridgeError && (
            <Alert severity="warning" sx={{ borderRadius: 3 }}>
              実績データの取得・分析に失敗しました。自動提案は一時的に利用できません: {bridgeError.message}
            </Alert>
          )}

          {!isBridgeLoading && !bridgeError && suggestions && (
            <Box
              sx={{
                p: 2.5,
                border: '1px dashed #c084fc',
                bgcolor: '#faf5ff',
                borderRadius: 3,
                transition: 'all 0.3s ease',
                boxShadow: '0 2px 12px rgba(168, 85, 247, 0.05)',
                '&:hover': {
                  borderColor: '#a855f7',
                  boxShadow: '0 4px 20px rgba(168, 85, 247, 0.12)',
                },
              }}
            >
              <Stack spacing={2}>
                {/* ヘッダー */}
                <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <AutoAwesomeIcon sx={{ color: '#a855f7' }} />
                    <Typography variant="subtitle2" fontWeight={800} color="#7c3aed" sx={{ letterSpacing: 0.5 }}>
                      L3支援実績からの評価提案（自動生成）
                    </Typography>
                  </Stack>
                  
                  <Stack direction="row" spacing={1} alignItems="center">
                    {suggestions.confidence !== 'none' && (
                      <Chip
                        label={`確信度: ${
                          suggestions.confidence === 'high' ? '高' :
                          suggestions.confidence === 'medium' ? '中' : '低'
                        }`}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          bgcolor: 
                            suggestions.confidence === 'high' ? '#dcfce7' :
                            suggestions.confidence === 'medium' ? '#ffedd5' : '#f3e8ff',
                          color:
                            suggestions.confidence === 'high' ? '#15803d' :
                            suggestions.confidence === 'medium' ? '#c2410c' : '#6b21a8',
                          border: 'none',
                        }}
                      />
                    )}
                    <Chip label="Human-in-the-Loop" size="small" variant="outlined" sx={{ color: '#a855f7', borderColor: '#d8b4fe', fontWeight: 600 }} />
                  </Stack>
                </Stack>

                {/* 説明 */}
                <Typography variant="caption" color="text.secondary">
                  対象期間内の支援手順実施記録および週次観察記録（L3）を自動的に解析し、§9 モニタリングの改善結果・次の支援方針案を提案します。
                </Typography>

                {/* 定量的メトリクス */}
                <Box sx={{ p: 1.5, bgcolor: '#ffffff', borderRadius: 2, border: '1px solid #f3e8ff' }}>
                  <Stack direction="row" spacing={3} alignItems="center" justifyContent="space-around" flexWrap="wrap" useFlexGap>
                    <Stack alignItems="center" spacing={0.5}>
                      <Typography variant="caption" color="text.secondary">日次記録数</Typography>
                      <Typography variant="body2" fontWeight={800} color="text.primary">
                        {suggestions.stats.recordCount} 件
                      </Typography>
                    </Stack>
                    <Divider orientation="vertical" flexItem />
                    <Stack alignItems="center" spacing={0.5}>
                      <Typography variant="caption" color="text.secondary">手順実施率</Typography>
                      <Typography variant="body2" fontWeight={800} color="#15803d">
                        {suggestions.stats.procedureCompletionRate !== null ? `${suggestions.stats.procedureCompletionRate}%` : '---'}
                      </Typography>
                    </Stack>
                    <Divider orientation="vertical" flexItem />
                    <Stack alignItems="center" spacing={0.5}>
                      <Typography variant="caption" color="text.secondary">BIP誘発率</Typography>
                      <Typography variant="body2" fontWeight={800} color="#b91c1c">
                        {suggestions.stats.bipActivationRate !== null ? `${suggestions.stats.bipActivationRate}%` : '---'}
                      </Typography>
                    </Stack>
                    <Divider orientation="vertical" flexItem />
                    <Stack alignItems="center" spacing={0.5}>
                      <Typography variant="caption" color="text.secondary">週次観察数</Typography>
                      <Typography variant="body2" fontWeight={800} color="#0369a1">
                        {suggestions.stats.observationCount} 件
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>

                {suggestions.confidence === 'none' ? (
                  <Alert severity="info" icon={false} sx={{ py: 1, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                    <Typography variant="body2" fontWeight={600} color="text.secondary">
                      分析データが不足しています
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      指定された評価期間内にL3の支援実績記録が登録されていません。L3モードで記録を入力すると、自動的に評価提案が利用可能になります。
                    </Typography>
                  </Alert>
                ) : (
                  <>
                    {/* 提案コンテンツ */}
                    <Stack spacing={1.5}>
                      {/* 改善結果案 */}
                      <Stack spacing={0.5}>
                        <Typography variant="caption" fontWeight={700} color="#7c3aed">改善結果の提案（前回からの変化）</Typography>
                        <Box sx={{ p: 1.5, bgcolor: '#ffffff', borderRadius: 2, border: '1px solid #e9d5ff', position: 'relative' }}>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', pr: 12, fontSize: '0.825rem', lineHeight: 1.5 }}>
                            {suggestions.improvementResult}
                          </Typography>
                          <Button
                            size="small"
                            variant="outlined"
                            color="secondary"
                            startIcon={<CheckIcon />}
                            sx={{
                              position: 'absolute',
                              right: 8,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              fontSize: '0.7rem',
                              py: 0.25,
                              px: 1,
                              borderRadius: 1.5,
                              borderColor: '#d8b4fe',
                              bgcolor: '#faf5ff',
                              '&:hover': { bgcolor: '#f3e8ff' }
                            }}
                            onClick={() => updateField('improvementResult', suggestions.improvementResult)}
                          >
                            適用
                          </Button>
                        </Box>
                      </Stack>

                      {/* 次の支援方針案 */}
                      <Stack spacing={0.5}>
                        <Typography variant="caption" fontWeight={700} color="#7c3aed">次の支援方針の提案（次回改善アクション）</Typography>
                        <Box sx={{ p: 1.5, bgcolor: '#ffffff', borderRadius: 2, border: '1px solid #e9d5ff', position: 'relative' }}>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', pr: 12, fontSize: '0.825rem', lineHeight: 1.5 }}>
                            {suggestions.nextSupport}
                          </Typography>
                          <Button
                            size="small"
                            variant="outlined"
                            color="secondary"
                            startIcon={<CheckIcon />}
                            sx={{
                              position: 'absolute',
                              right: 8,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              fontSize: '0.7rem',
                              py: 0.25,
                              px: 1,
                              borderRadius: 1.5,
                              borderColor: '#d8b4fe',
                              bgcolor: '#faf5ff',
                              '&:hover': { bgcolor: '#f3e8ff' }
                            }}
                            onClick={() => updateField('nextSupport', suggestions.nextSupport)}
                          >
                            適用
                          </Button>
                        </Box>
                      </Stack>
                    </Stack>

                    {/* 一括反映・根拠データ */}
                    <Stack spacing={1.5}>
                      <Button
                        size="small"
                        variant="contained"
                        color="secondary"
                        startIcon={<KeyboardDoubleArrowDownIcon />}
                        sx={{
                          alignSelf: 'flex-start',
                          bgcolor: '#a855f7',
                          fontWeight: 700,
                          borderRadius: 2,
                          px: 2,
                          py: 0.75,
                          boxShadow: '0 2px 6px rgba(168, 85, 247, 0.2)',
                          '&:hover': { bgcolor: '#9333ea', boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)' }
                        }}
                        onClick={() => {
                          updateField('improvementResult', suggestions.improvementResult);
                          updateField('nextSupport', suggestions.nextSupport);
                        }}
                      >
                        改善結果・支援方針に一括反映する
                      </Button>

                      {/* 根拠サマリー */}
                      <Box sx={{ mt: 1, p: 1.5, bgcolor: '#fdfbfe', borderRadius: 2, border: '1px solid #f3e8ff' }}>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                          <EqualizerIcon sx={{ fontSize: 16, color: '#a855f7' }} />
                          📌 提案根拠データサマリー:
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', lineHeight: 1.4, display: 'block', whiteSpace: 'pre-wrap' }}>
                          {suggestions.evidenceSummary}
                        </Typography>
                      </Box>
                    </Stack>
                  </>
                )}
              </Stack>
            </Box>
          )}
        </Box>
      )}

      <TextField label="改善結果" value={form.improvementResult} onChange={e => updateField('improvementResult', e.target.value)} fullWidth multiline minRows={2}
        placeholder="（評価後に記入）前回からの変化" />
      <TextField label="次の支援方針" value={form.nextSupport} onChange={e => updateField('nextSupport', e.target.value)} fullWidth multiline minRows={2}
        placeholder="（評価後に記入）次の改善アクション" />
    </Stack>
  );
};
