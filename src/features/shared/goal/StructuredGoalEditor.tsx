/**
 * StructuredGoalEditor — 構造化目標エディタコンポーネント
 *
 * GoalItem を 1 件分編集するための共通 UI。
 * isp-editor / support-plan-guide 双方から利用可能。
 *
 * Features:
 *   - テキスト編集 (TextField, multiline)
 *   - 5 領域ドメインタグ (Chip toggle)
 *   - SMART 基準ガイド表示
 */
import DoneIcon from '@mui/icons-material/Done';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React from 'react';
import type { GoalItem } from './goalTypes';
import { DOMAINS } from './goalTypes';

export interface StructuredGoalEditorProps {
  /** 編集対象の GoalItem */
  goal: GoalItem;
  /** フィールド更新コールバック */
  onChange: (updates: Partial<GoalItem>) => void;
  /** ドメインタグのトグルコールバック */
  onToggleDomain?: (domainId: string) => void;
  /** 管理者モード (false = 読み取り専用) */
  isAdmin: boolean;
}

const StructuredGoalEditor: React.FC<StructuredGoalEditorProps> = ({
  goal,
  onChange,
  onToggleDomain,
  isAdmin,
}) => {
  return (
    <Stack spacing={1.5}>
      {/* ── ラベル編集 ── */}
      <TextField
        size="small"
        value={goal.label}
        onChange={(e) => onChange({ label: e.target.value })}
        placeholder="目標ラベル（例: 長期目標①）"
        disabled={!isAdmin}
        variant="outlined"
        InputProps={{
          sx: { fontWeight: 600, fontSize: '0.95rem' },
        }}
        sx={{ maxWidth: 360 }}
      />

      {/* ── テキスト編集 ── */}
      <TextField
        value={goal.text}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder="目標・支援内容を入力してください…"
        multiline
        minRows={3}
        maxRows={10}
        fullWidth
        disabled={!isAdmin}
        variant="outlined"
        sx={{
          '& .MuiOutlinedInput-root': {
            bgcolor: 'grey.50',
            borderRadius: 1.5,
          },
        }}
      />

      {/* ── 5 領域ドメインタグ ── */}
      <Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mb: 0.5, display: 'block' }}
        >
          5領域タグ：
        </Typography>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          {DOMAINS.map((d) => {
            const isOn = goal.domains.includes(d.id);
            return (
              <Chip
                key={d.id}
                label={d.label}
                size="small"
                clickable={isAdmin}
                icon={isOn ? <DoneIcon sx={{ fontSize: 14 }} /> : undefined}
                onClick={() => {
                  if (!isAdmin) return;
                  onToggleDomain?.(d.id);
                }}
                aria-pressed={isOn}
                sx={{
                  bgcolor: isOn ? d.bg : 'background.paper',
                  color: isOn ? d.color : 'text.disabled',
                  borderColor: isOn ? d.color + '60' : 'grey.300',
                  border: 1,
                  fontWeight: isOn ? 700 : 400,
                  minHeight: 32,
                  '&:hover': isAdmin
                    ? { bgcolor: isOn ? d.bg : 'grey.100' }
                    : {},
                }}
              />
            );
          })}
        </Stack>
      </Box>
    </Stack>
  );
};

export default React.memo(StructuredGoalEditor);
