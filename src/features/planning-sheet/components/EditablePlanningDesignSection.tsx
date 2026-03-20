/**
 * EditablePlanningDesignSection — 支援設計タブ（編集可能）
 *
 * 編集対象:
 *  - 支援課題の優先順位 / 先行事象戦略 / 教授戦略 / 後続事象戦略
 *  - 支援手順（ステップリスト）
 *  - 見直し周期
 *  - 各戦略セクションの根拠ABC/PDCA紐づけ
 */
import type { PlanningDesign, ProcedureStep } from '@/domain/isp/schema';
import type { EvidenceLinkMap, StrategyEvidenceKey, EvidenceLink, EvidenceLinkType } from '@/domain/isp/evidenceLink';
import type { StrategyUsageSummary } from '@/domain/isp/aggregateStrategyUsage';
import type { StrategyUsageTrendResult } from '@/domain/isp/aggregateStrategyUsage';
import type { StrategyCategory } from '@/domain/behavior';
import type { AbcRecord } from '@/domain/abc/abcRecord';
import type { IcebergPdcaItem } from '@/features/ibd/analysis/pdca/types';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useCallback, useState } from 'react';
import { ImportTemplateDialog } from './ImportTemplateDialog';
import { EvidenceLinkSelector } from './EvidenceLinkSelector';
import { StrategyItemBadge, CategoryUsageSummary, StrategyUsageOverview } from './StrategyUsageBadge';
import { StrategyTrendBadge, CategoryTrendSummary } from './StrategyTrendIndicator';

interface Props {
  planning: PlanningDesign;
  onChange: (updated: PlanningDesign) => void;
  /** ABC根拠データ（対象利用者） */
  abcRecords?: AbcRecord[];
  /** PDCA根拠データ（対象利用者） */
  pdcaItems?: IcebergPdcaItem[];
  /** 根拠リンクマップ */
  evidenceLinks?: EvidenceLinkMap;
  /** 根拠リンク変更時 */
  onEvidenceLinksChange?: (updated: EvidenceLinkMap) => void;
  /** 根拠チップクリック時のコールバック（遷移導線用） */
  onEvidenceClick?: (type: EvidenceLinkType, referenceId: string) => void;
  /** 戦略実施回数の集計結果（Phase C-3a） */
  strategyUsage?: StrategyUsageSummary | null;
  /** 戦略実施回数の読み込み中フラグ */
  strategyUsageLoading?: boolean;
  /** Phase C-3b: トレンド結果 */
  trendResult?: StrategyUsageTrendResult | null;
}

// ── ChipInput（再利用） ──
const ChipInput: React.FC<{
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  /** Phase C-3a: 戦略カテゴリ（実施回数表示用） */
  strategyCategory?: StrategyCategory;
  /** Phase C-3a: 集計結果 */
  strategyUsage?: StrategyUsageSummary | null;
  /** Phase C-3b: トレンド結果 */
  trendResult?: StrategyUsageTrendResult | null;
}> = ({ label, items, onChange: onChangeItems, placeholder, strategyCategory, strategyUsage, trendResult }) => {
  const handleAdd = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter') return;
    const input = e.target as HTMLInputElement;
    const val = input.value.trim();
    if (val && !items.includes(val)) {
      onChangeItems([...items, val]);
      input.value = '';
    }
    e.preventDefault();
  }, [items, onChangeItems]);

  const handleDelete = useCallback((idx: number) => {
    onChangeItems(items.filter((_, i) => i !== idx));
  }, [items, onChangeItems]);

  return (
    <Stack spacing={0.5}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <TextField
          label={label}
          size="small"
          placeholder={placeholder ?? 'Enter で追加'}
          onKeyDown={handleAdd}
          fullWidth
        />
        {strategyCategory && strategyUsage && (
          <CategoryUsageSummary category={strategyCategory} summary={strategyUsage} />
        )}
        {strategyCategory && trendResult && (
          <CategoryTrendSummary category={strategyCategory} trendResult={trendResult} />
        )}
      </Stack>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        {items.map((item, i) => (
          <Box key={i} sx={{ display: 'inline-flex', alignItems: 'center' }}>
            <Chip size="small" label={item} onDelete={() => handleDelete(i)} />
            {strategyCategory && strategyUsage && (
              <StrategyItemBadge
                text={item}
                category={strategyCategory}
                summary={strategyUsage}
              />
            )}
            {strategyCategory && trendResult && (
              <StrategyTrendBadge
                text={item}
                category={strategyCategory}
                trendResult={trendResult}
              />
            )}
          </Box>
        ))}
      </Stack>
    </Stack>
  );
};

export const EditablePlanningDesignSection: React.FC<Props> = ({
  planning,
  onChange,
  abcRecords = [],
  pdcaItems = [],
  evidenceLinks,
  onEvidenceLinksChange,
  onEvidenceClick,
  strategyUsage,
  strategyUsageLoading,
  trendResult,
}) => {
  const hasEvidence = abcRecords.length > 0 || pdcaItems.length > 0;

  const handleEvidenceChange = useCallback((key: StrategyEvidenceKey, links: EvidenceLink[]) => {
    if (!evidenceLinks || !onEvidenceLinksChange) return;
    onEvidenceLinksChange({ ...evidenceLinks, [key]: links });
  }, [evidenceLinks, onEvidenceLinksChange]);
  const [importOpen, setImportOpen] = useState(false);

  // ── Procedure Steps ──
  const addStep = () => {
    const nextOrder = planning.procedureSteps.length + 1;
    const newStep: ProcedureStep = { order: nextOrder, instruction: '', staff: '', timing: '' };
    onChange({ ...planning, procedureSteps: [...planning.procedureSteps, newStep] });
  };
  const updateStep = (idx: number, patch: Partial<ProcedureStep>) => {
    const updated = planning.procedureSteps.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange({ ...planning, procedureSteps: updated });
  };
  const removeStep = (idx: number) => {
    const updated = planning.procedureSteps
      .filter((_, i) => i !== idx)
      .map((s, i) => ({ ...s, order: i + 1 })); // re-number
    onChange({ ...planning, procedureSteps: updated });
  };
  const handleImport = useCallback((steps: ProcedureStep[]) => {
    onChange({ ...planning, procedureSteps: steps });
  }, [planning, onChange]);

  return (
    <Stack spacing={3}>
      <Typography variant="subtitle1" fontWeight={600}>支援設計</Typography>

      {/* ── Phase C-3a: 実施状況オーバービュー ── */}
      <StrategyUsageOverview summary={strategyUsage ?? null} loading={strategyUsageLoading} />

      {/* ── 戦略チップ群 + 根拠紐づけ ── */}
      <ChipInput
        label="支援課題の優先順位"
        items={planning.supportPriorities}
        onChange={(items) => onChange({ ...planning, supportPriorities: items })}
        placeholder="優先課題を Enter で追加"
      />

      <ChipInput
        label="先行事象戦略（予防的支援）"
        items={planning.antecedentStrategies}
        onChange={(items) => onChange({ ...planning, antecedentStrategies: items })}
        placeholder="例: スケジュール提示、環境構造化"
        strategyCategory="antecedent"
        strategyUsage={strategyUsage}
        trendResult={trendResult}
      />
      {hasEvidence && evidenceLinks && (
        <EvidenceLinkSelector
          sectionLabel="先行事象戦略"
          links={evidenceLinks.antecedentStrategies}
          onChange={(links) => handleEvidenceChange('antecedentStrategies', links)}
          abcRecords={abcRecords}
          pdcaItems={pdcaItems}
          onEvidenceClick={onEvidenceClick}
        />
      )}

      <ChipInput
        label="教授戦略（代替行動）"
        items={planning.teachingStrategies}
        onChange={(items) => onChange({ ...planning, teachingStrategies: items })}
        placeholder="例: モデリング、タスク分析"
        strategyCategory="teaching"
        strategyUsage={strategyUsage}
        trendResult={trendResult}
      />
      {hasEvidence && evidenceLinks && (
        <EvidenceLinkSelector
          sectionLabel="教授戦略"
          links={evidenceLinks.teachingStrategies}
          onChange={(links) => handleEvidenceChange('teachingStrategies', links)}
          abcRecords={abcRecords}
          pdcaItems={pdcaItems}
          onEvidenceClick={onEvidenceClick}
        />
      )}

      <ChipInput
        label="後続事象戦略（危機対応）"
        items={planning.consequenceStrategies}
        onChange={(items) => onChange({ ...planning, consequenceStrategies: items })}
        placeholder="例: 正の強化、代替行動の強化"
        strategyCategory="consequence"
        strategyUsage={strategyUsage}
        trendResult={trendResult}
      />
      {hasEvidence && evidenceLinks && (
        <EvidenceLinkSelector
          sectionLabel="後続事象戦略"
          links={evidenceLinks.consequenceStrategies}
          onChange={(links) => handleEvidenceChange('consequenceStrategies', links)}
          abcRecords={abcRecords}
          pdcaItems={pdcaItems}
          onEvidenceClick={onEvidenceClick}
        />
      )}

      <Divider />

      {/* ── 支援手順 ── */}
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle2" fontWeight={500}>支援手順</Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" onClick={() => setImportOpen(true)}>
              テンプレートから取り込み
            </Button>
            <Button size="small" startIcon={<AddCircleOutlineRoundedIcon />} onClick={addStep}>
              ステップ追加
            </Button>
          </Stack>
        </Stack>
        <Stack spacing={1.5}>
          {planning.procedureSteps.map((step, i) => (
            <Paper key={i} variant="outlined" sx={{ p: 1.5 }}>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Chip size="small" label={`${step.order}`} variant="outlined" sx={{ mt: 0.5, minWidth: 32 }} />
                <Stack spacing={1} sx={{ flex: 1 }}>
                  <TextField
                    label="手順内容"
                    value={step.instruction}
                    onChange={(e) => updateStep(i, { instruction: e.target.value })}
                    fullWidth size="small" required
                  />
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <TextField
                      label="担当者"
                      value={step.staff}
                      onChange={(e) => updateStep(i, { staff: e.target.value })}
                      fullWidth size="small"
                    />
                    <TextField
                      label="タイミング"
                      value={step.timing}
                      onChange={(e) => updateStep(i, { timing: e.target.value })}
                      fullWidth size="small"
                    />
                  </Stack>
                </Stack>
                <Tooltip title="削除">
                  <IconButton size="small" onClick={() => removeStep(i)} color="error" sx={{ mt: 0.5 }}>
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Paper>
          ))}
          {planning.procedureSteps.length === 0 && (
            <Typography variant="body2" color="text.disabled">手順がまだ登録されていません</Typography>
          )}
        </Stack>
      </Box>

      <Divider />

      {/* ── 見直し周期 ── */}
      <TextField
        label="見直し周期（日）"
        type="number"
        value={planning.reviewCycleDays}
        onChange={(e) => onChange({ ...planning, reviewCycleDays: parseInt(e.target.value, 10) || 180 })}
        inputProps={{ min: 1 }}
        size="small" sx={{ maxWidth: 200 }}
      />

      {/* インポートダイアログ */}
      <ImportTemplateDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
        existingStepCount={planning.procedureSteps.length}
      />
    </Stack>
  );
};
