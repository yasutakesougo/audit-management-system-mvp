/**
 * EditableIntakeSection — 情報収集（インテーク）タブ（編集可能）
 *
 * 編集対象:
 *  - 主訴
 *  - 対象行動の下書き
 *  - 行動関連項目合計点
 *  - 直近30日インシデント
 *  - コミュニケーション手段 / 感覚トリガー / 医療フラグ
 */
import type { DraftBehavior, PlanningIntake } from '@/domain/isp/schema';
import type { ProvenanceEntry } from '@/features/planning-sheet/assessmentBridge';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useCallback } from 'react';
import Button from '@mui/material/Button';

interface Props {
  intake: PlanningIntake;
  onChange: (updated: PlanningIntake) => void;
  /** 出典追跡エントリ（将来 ProvenanceBadgeGroup で使用） */
  provenanceEntries?: ProvenanceEntry[];
}

const EMPTY_DRAFT_BEHAVIOR: DraftBehavior = { name: '', description: '', frequency: '' };

// チップ入力ヘルパー（カンマ区切りで入力 → 配列）
const ChipInput: React.FC<{
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
}> = ({ label, items, onChange: onChangeItems }) => {
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
      <TextField
        label={label}
        size="small"
        placeholder="Enter で追加"
        onKeyDown={handleAdd}
        fullWidth
      />
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        {items.map((item, i) => (
          <Chip key={i} size="small" label={item} onDelete={() => handleDelete(i)} />
        ))}
      </Stack>
    </Stack>
  );
};

export const EditableIntakeSection: React.FC<Props> = ({ intake, onChange }) => {
  const updateDraftBehavior = (idx: number, patch: Partial<DraftBehavior>) => {
    const updated = intake.targetBehaviorsDraft.map((b, i) => (i === idx ? { ...b, ...patch } : b));
    onChange({ ...intake, targetBehaviorsDraft: updated });
  };
  const addDraftBehavior = () => onChange({ ...intake, targetBehaviorsDraft: [...intake.targetBehaviorsDraft, { ...EMPTY_DRAFT_BEHAVIOR }] });
  const removeDraftBehavior = (idx: number) => onChange({ ...intake, targetBehaviorsDraft: intake.targetBehaviorsDraft.filter((_, i) => i !== idx) });

  return (
    <Stack spacing={2.5}>
      <Typography variant="subtitle1" fontWeight={600}>情報収集（インテーク）</Typography>

      <TextField
        label="主訴"
        value={intake.presentingProblem}
        onChange={(e) => onChange({ ...intake, presentingProblem: e.target.value })}
        fullWidth size="small" multiline minRows={2}
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="行動関連項目合計点（0〜24）"
          type="number"
          value={intake.behaviorItemsTotal ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            onChange({ ...intake, behaviorItemsTotal: v ? parseInt(v, 10) : null });
          }}
          inputProps={{ min: 0, max: 24 }}
          size="small" sx={{ minWidth: 200 }}
        />
        <TextField
          label="直近30日インシデント"
          value={intake.incidentSummaryLast30d}
          onChange={(e) => onChange({ ...intake, incidentSummaryLast30d: e.target.value })}
          fullWidth size="small" multiline minRows={2}
        />
      </Stack>

      {/* 対象行動の下書き */}
      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle2" fontWeight={500}>対象行動の下書き</Typography>
          <Button size="small" startIcon={<AddCircleOutlineRoundedIcon />} onClick={addDraftBehavior}>
            追加
          </Button>
        </Stack>
        {intake.targetBehaviorsDraft.map((b, i) => (
          <Paper key={i} variant="outlined" sx={{ p: 1.5 }}>
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Chip size="small" label={`下書き ${i + 1}`} variant="outlined" />
                <Tooltip title="削除">
                  <IconButton size="small" onClick={() => removeDraftBehavior(i)} color="error">
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
              <TextField label="名前" value={b.name} onChange={(e) => updateDraftBehavior(i, { name: e.target.value })} fullWidth size="small" required />
              <TextField label="概要" value={b.description} onChange={(e) => updateDraftBehavior(i, { description: e.target.value })} fullWidth size="small" />
              <TextField label="頻度" value={b.frequency} onChange={(e) => updateDraftBehavior(i, { frequency: e.target.value })} fullWidth size="small" />
            </Stack>
          </Paper>
        ))}
        {intake.targetBehaviorsDraft.length === 0 && (
          <Typography variant="body2" color="text.disabled">下書きがありません</Typography>
        )}
      </Stack>

      {/* チップ入力群 */}
      <ChipInput
        label="コミュニケーション手段"
        items={intake.communicationModes}
        onChange={(items) => onChange({ ...intake, communicationModes: items })}
      />
      <ChipInput
        label="感覚トリガー"
        items={intake.sensoryTriggers}
        onChange={(items) => onChange({ ...intake, sensoryTriggers: items })}
      />
      <ChipInput
        label="医療フラグ"
        items={intake.medicalFlags}
        onChange={(items) => onChange({ ...intake, medicalFlags: items })}
      />
    </Stack>
  );
};
