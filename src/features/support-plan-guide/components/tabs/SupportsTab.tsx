/**
 * SupportsTab — 支援内容タブ (Phase 3: 構造化エディタ版)
 *
 * SectionKey: 'supports'
 * form.goals から type === 'support' をフィルタし、
 * StructuredGoalEditor で個別編集する。
 */
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React from 'react';

import StructuredGoalEditor from '@/features/shared/goal/StructuredGoalEditor';
import { findSection } from '../../utils/helpers';
import type { SectionTabProps } from './tabProps';

const SupportsTab: React.FC<SectionTabProps> = ({
  form,
  isAdmin,
  onGoalChange,
  onToggleDomain,
  onAddGoal,
  onDeleteGoal,
}) => {
  const section = findSection('supports');

  // GoalItem[] からフィルタ
  const supportGoals = React.useMemo(
    () => (form.goals ?? []).filter((g) => g.type === 'support'),
    [form.goals],
  );

  return (
    <Stack spacing={3}>
      {/* セクション説明 */}
      {section?.description ? (
        <Typography variant="subtitle1" component="span" sx={{ color: 'text.secondary' }}>
          {section.description}
        </Typography>
      ) : null}

      {/* ── 支援内容一覧 ── */}
      <Stack spacing={2}>
        <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1rem' }}>
          支援内容
        </Typography>

        {supportGoals.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
            支援内容がまだ追加されていません。
          </Typography>
        )}

        {supportGoals.map((goal) => (
          <Card key={goal.id} variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    {goal.label}
                  </Typography>
                  {isAdmin && onDeleteGoal && (
                    <Tooltip title="この支援内容を削除">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => onDeleteGoal(goal.id)}
                        aria-label={`${goal.label}を削除`}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
                <StructuredGoalEditor
                  goal={goal}
                  onChange={(updates) => onGoalChange?.(goal.id, updates)}
                  onToggleDomain={(domainId) => onToggleDomain?.(goal.id, domainId)}
                  isAdmin={isAdmin}
                />
              </Stack>
            </CardContent>
          </Card>
        ))}

        {/* 追加ボタン群 */}
        {isAdmin && onAddGoal && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => onAddGoal('support', '日中支援')}
            >
              ＋ 日中支援を追加
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => onAddGoal('support', '創作・生産活動')}
            >
              ＋ 創作活動を追加
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => onAddGoal('support', '機能訓練')}
            >
              ＋ 機能訓練を追加
            </Button>
          </Stack>
        )}
      </Stack>
    </Stack>
  );
};

export default React.memo(SupportsTab);
