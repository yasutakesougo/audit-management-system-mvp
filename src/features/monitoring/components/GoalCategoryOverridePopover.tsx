/**
 * @fileoverview 目標カテゴリ手動上書きポップオーバー
 * @description
 * Phase 4-B: GoalProgressCard 内の各目標に
 * 「関連カテゴリを調整」リンクを提供する。
 *
 * - チェックボックスで BehaviorTagCategory を選択
 * - 「自動推論に戻す」ボタンで override をクリア
 * - 保存時に onSave(goalId, categories | null) をコール
 */
import AutorenewIcon from '@mui/icons-material/Autorenew';
import TuneIcon from '@mui/icons-material/Tune';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

import {
  BEHAVIOR_TAG_CATEGORIES,
  type BehaviorTagCategory,
} from '../../daily/domain/behavior/behaviorTag';

// ─── 定数 ────────────────────────────────────────────────

const CATEGORY_KEYS = Object.keys(BEHAVIOR_TAG_CATEGORIES) as BehaviorTagCategory[];

// ─── Props ───────────────────────────────────────────────

export interface GoalCategoryOverridePopoverProps {
  goalId: string;
  /** 現在の関連カテゴリ（override or inferred） */
  currentCategories: BehaviorTagCategory[];
  /** 現在の推論元 */
  source: 'domain-inference' | 'manual';
  /**
   * 保存コールバック
   * - categories: BehaviorTagCategory[] → 手動上書き
   * - categories: null → 自動推論に戻す
   */
  onSave: (goalId: string, categories: BehaviorTagCategory[] | null) => void;
}

// ─── コンポーネント ──────────────────────────────────────

const GoalCategoryOverridePopover: React.FC<GoalCategoryOverridePopoverProps> = ({
  goalId,
  currentCategories,
  source,
  onSave,
}) => {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const [selected, setSelected] = React.useState<Set<BehaviorTagCategory>>(
    () => new Set(currentCategories),
  );

  // currentCategories が外部から変わったら同期
  React.useEffect(() => {
    setSelected(new Set(currentCategories));
  }, [currentCategories]);

  const open = Boolean(anchorEl);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
    // 開くたびに現在値で初期化
    setSelected(new Set(currentCategories));
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleToggle = (cat: BehaviorTagCategory) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const handleSave = () => {
    const cats = Array.from(selected).sort() as BehaviorTagCategory[];
    onSave(goalId, cats.length > 0 ? cats : null);
    handleClose();
  };

  const handleResetToAuto = () => {
    onSave(goalId, null);
    handleClose();
  };

  const sourceLabel = source === 'manual' ? '手動' : '自動';

  return (
    <>
      {/* トリガーリンク */}
      <Typography
        component="span"
        variant="caption"
        onClick={handleOpen}
        data-testid={`goal-override-trigger-${goalId}`}
        sx={{
          color: 'text.secondary',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.3,
          '&:hover': { color: 'primary.main', textDecoration: 'underline' },
        }}
      >
        <TuneIcon sx={{ fontSize: 12 }} />
        {sourceLabel}
      </Typography>

      {/* ポップオーバー本体 */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { p: 2, minWidth: 220 } } }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
          関連カテゴリの調整
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          この目標の進捗判定に使用するカテゴリを選択してください
        </Typography>

        <FormGroup>
          {CATEGORY_KEYS.map((cat) => (
            <FormControlLabel
              key={cat}
              control={
                <Checkbox
                  size="small"
                  checked={selected.has(cat)}
                  onChange={() => handleToggle(cat)}
                  data-testid={`override-checkbox-${cat}`}
                />
              }
              label={
                <Typography variant="body2">
                  {BEHAVIOR_TAG_CATEGORIES[cat]}
                </Typography>
              }
            />
          ))}
        </FormGroup>

        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} justifyContent="space-between">
          <Button
            size="small"
            variant="text"
            color="inherit"
            startIcon={<AutorenewIcon />}
            onClick={handleResetToAuto}
            disabled={source === 'domain-inference'}
            data-testid={`override-reset-${goalId}`}
            sx={{ fontSize: '0.75rem' }}
          >
            自動推論に戻す
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleSave}
            disabled={selected.size === 0}
            data-testid={`override-save-${goalId}`}
          >
            保存
          </Button>
        </Stack>
      </Popover>
    </>
  );
};

export default React.memo(GoalCategoryOverridePopover);
