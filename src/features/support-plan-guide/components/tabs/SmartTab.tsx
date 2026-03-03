/**
 * SmartTab — SMART目標タブ (Phase 3: 構造化エディタ版)
 *
 * SectionKey: 'smart'
 * form.goals から type === 'long' / 'short' をフィルタし、
 * StructuredGoalEditor で個別編集する。
 */
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React from 'react';

import StructuredGoalEditor from '@/features/shared/goal/StructuredGoalEditor';
import { findSection } from '../../utils/helpers';
import type { SectionTabProps } from './tabProps';

const SmartTab: React.FC<SectionTabProps> = ({
  form,
  isAdmin,
  onGoalChange,
  onToggleDomain,
  onAddGoal,
  onDeleteGoal,
}) => {
  const section = findSection('smart');

  // GoalItem[] からフィルタ
  const longGoals = React.useMemo(
    () => (form.goals ?? []).filter((g) => g.type === 'long'),
    [form.goals],
  );
  const shortGoals = React.useMemo(
    () => (form.goals ?? []).filter((g) => g.type === 'short'),
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

      {/* ── 長期目標 ── */}
      <Stack spacing={2}>
        <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1rem' }}>
          長期目標（6か月以上）
        </Typography>

        {longGoals.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
            長期目標がまだ追加されていません。
          </Typography>
        )}

        {longGoals.map((goal) => (
          <Card key={goal.id} variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    {goal.label}
                  </Typography>
                  {isAdmin && onDeleteGoal && (
                    <Tooltip title="この長期目標を削除">
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

        {isAdmin && onAddGoal && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => onAddGoal('long', `長期目標${longGoals.length > 0 ? `${longGoals.length + 1}` : ''}`)}
            sx={{ alignSelf: 'flex-start' }}
          >
            ＋ 長期目標を追加
          </Button>
        )}
      </Stack>

      <Divider />

      {/* ── 短期目標 ── */}
      <Stack spacing={2}>
        <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1rem' }}>
          短期目標（3か月目安）
        </Typography>

        {shortGoals.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
            短期目標がまだ追加されていません。
          </Typography>
        )}

        {shortGoals.map((goal) => (
          <Card key={goal.id} variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    {goal.label}
                  </Typography>
                  {isAdmin && onDeleteGoal && (
                    <Tooltip title="この短期目標を削除">
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

        {isAdmin && onAddGoal && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => onAddGoal('short', `短期目標${shortGoals.length > 0 ? `${shortGoals.length + 1}` : ''}`)}
            sx={{ alignSelf: 'flex-start' }}
          >
            ＋ 短期目標を追加
          </Button>
        )}
      </Stack>
    </Stack>
  );
};

export default React.memo(SmartTab);
