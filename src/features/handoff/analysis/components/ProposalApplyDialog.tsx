/**
 * ProposalApplyDialog — 統一提案反映ダイアログ
 *
 * 3系統（申し送り / ABC / モニタリング）の改善提案を
 * 共通UIで確認・選択・反映するダイアログ。
 *
 * 6層モデル: 統一反映レイヤー（計画更新ワークフロー）
 */
import React from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';

import type {
  ProposalPreviewItem,
  PlanningProposalBundle,
  ProposalSource,
} from '../proposalBundle';
import {
  buildProposalPreview,
  PROPOSAL_SOURCE_LABELS,
} from '../proposalBundle';

// ────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────

interface Props {
  /** 表示するか */
  open: boolean;
  /** 閉じる */
  onClose: () => void;
  /** 提案バンドル一覧 */
  bundles: PlanningProposalBundle[];
  /** 採用確定時のコールバック */
  onApply: (selectedItems: ProposalPreviewItem[], adoptedBy: string) => void;
  /** 現在のユーザー名 */
  currentUserName?: string;
}

// ────────────────────────────────────────────────────────────
// ソースアイコン
// ────────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<ProposalSource, 'info' | 'warning' | 'success'> = {
  handoff: 'info',
  abc: 'warning',
  monitoring: 'success',
};

const ACTION_COLORS: Record<string, 'default' | 'primary' | 'secondary' | 'success'> = {
  add: 'primary',
  append: 'secondary',
  replace: 'default',
  keep: 'success',
};

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export const ProposalApplyDialog: React.FC<Props> = ({
  open,
  onClose,
  bundles,
  onApply,
  currentUserName = '職員',
}) => {
  const preview = React.useMemo(() => buildProposalPreview(bundles), [bundles]);
  const [items, setItems] = React.useState<ProposalPreviewItem[]>([]);

  React.useEffect(() => {
    setItems(preview.items.map(i => ({ ...i })));
  }, [preview]);

  const toggleItem = (index: number) => {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, selected: !item.selected } : item,
    ));
  };

  const selectedCount = items.filter(i => i.selected).length;
  const totalActionable = items.filter(i => i.action !== 'keep').length;

  const handleApply = () => {
    onApply(items, currentUserName);
    onClose();
  };

  // セクションでグループ化
  const groupedBySection = React.useMemo(() => {
    const groups = new Map<string, ProposalPreviewItem[]>();
    for (const item of items) {
      const group = groups.get(item.sectionKey) ?? [];
      group.push(item);
      groups.set(item.sectionKey, group);
    }
    return groups;
  }, [items]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <AutoFixHighRoundedIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>
            改善提案の確認・反映
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {/* ── サマリー ── */}
        <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
          {(['handoff', 'abc', 'monitoring'] as ProposalSource[]).map(src => {
            const count = preview.summary.bySource[src];
            if (count === 0) return null;
            return (
              <Chip
                key={src}
                label={`${PROPOSAL_SOURCE_LABELS[src]}: ${count}件`}
                color={SOURCE_COLORS[src]}
                size="small"
                variant="outlined"
              />
            );
          })}
          <Chip
            label={`${selectedCount}/${totalActionable}件 選択中`}
            color="primary"
            size="small"
            icon={<AssignmentTurnedInRoundedIcon />}
          />
        </Stack>

        {/* ── セクション別提案一覧 ── */}
        {[...groupedBySection.entries()].map(([sectionKey, sectionItems]) => (
          <Box key={sectionKey} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 0.5 }}>
              {sectionKey}
            </Typography>
            <Divider sx={{ mb: 1 }} />
            <Stack spacing={1}>
              {sectionItems.map((item) => {
                const globalIndex = items.indexOf(item);
                return (
                  <Box
                    key={globalIndex}
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1,
                      p: 1,
                      borderRadius: 1,
                      bgcolor: item.selected ? 'action.selected' : 'transparent',
                      '&:hover': { bgcolor: 'action.hover' },
                      opacity: item.action === 'keep' ? 0.6 : 1,
                    }}
                  >
                    <Checkbox
                      checked={item.selected}
                      onChange={() => toggleItem(globalIndex)}
                      size="small"
                      disabled={item.action === 'keep'}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.25 }}>
                        <Chip
                          label={item.sourceLabel}
                          color={SOURCE_COLORS[item.source]}
                          size="small"
                          variant="outlined"
                          sx={{ height: 18, '& .MuiChip-label': { px: 0.5, fontSize: '0.65rem' } }}
                        />
                        <Chip
                          label={item.actionLabel}
                          color={ACTION_COLORS[item.action] as 'default'}
                          size="small"
                          variant="filled"
                          sx={{ height: 18, '& .MuiChip-label': { px: 0.5, fontSize: '0.65rem' } }}
                        />
                        <Typography variant="body2" fontWeight={600}>
                          {item.fieldLabel}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', ml: 0.5 }}>
                        {item.proposedValue}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                        理由: {item.reason}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          </Box>
        ))}

        {items.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            現在、反映候補の提案はありません
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} color="inherit">
          キャンセル
        </Button>
        <Button
          onClick={handleApply}
          variant="contained"
          disabled={selectedCount === 0}
          startIcon={<AssignmentTurnedInRoundedIcon />}
        >
          {selectedCount}件の提案を反映
        </Button>
      </DialogActions>
    </Dialog>
  );
};
