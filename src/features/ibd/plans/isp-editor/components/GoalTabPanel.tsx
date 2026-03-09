import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DoneIcon from '@mui/icons-material/Done';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { useMemo } from 'react';
import { DOMAINS } from '../data/ispRepo';
import { DiffPreview } from './DiffPreview';
import type { ISPComparisonEditorViewProps } from './ISPComparisonEditorView';

export type GoalTabPanelProps = Pick<
  ISPComparisonEditorViewProps,
  | 'currentPlan' | 'previousPlan' | 'activeGoalId' | 'activeGoal' | 'prevGoal'
  | 'copiedId' | 'diff' | 'showSmart' | 'showDiff'
  | 'setActiveGoalId' | 'copyFromPrevious' | 'updateGoalText' | 'toggleDomain'
>;

export const GoalTabPanel: React.FC<GoalTabPanelProps> = ({
  currentPlan, previousPlan, activeGoalId, activeGoal, prevGoal,
  copiedId, diff, showSmart,
  setActiveGoalId, copyFromPrevious, updateGoalText, toggleDomain,
}) => {
  // Active tab index
  const activeTabIndex = useMemo(
    () => currentPlan.goals.findIndex((g) => g.id === activeGoalId),
    [currentPlan.goals, activeGoalId]
  );

  return (
    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* Tab Navigation */}
      <Card elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTabIndex >= 0 ? activeTabIndex : 0}
          onChange={(_e, idx) => {
            const goal = currentPlan.goals[idx];
            if (goal) setActiveGoalId(goal.id);
          }}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="目標項目タブ"
        >
          {currentPlan.goals.map((g) => {
            const prev = previousPlan.goals.find((p) => p.id === g.id);
            const hasChange = g.text && prev && g.text !== prev.text;
            const isEmpty = !g.text.trim();
            return (
              <Tab
                key={g.id}
                label={
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <span>{g.label}</span>
                    {hasChange && (
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'success.main' }}
                        aria-label="変更あり" />
                    )}
                    {isEmpty && (
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'warning.main' }}
                        aria-label="未入力" />
                    )}
                  </Stack>
                }
                id={`tab-${g.id}`}
                aria-controls={`tabpanel-${g.id}`}
                sx={{ textTransform: 'none', fontWeight: activeGoalId === g.id ? 700 : 400, minHeight: 48 }}
              />
            );
          })}
        </Tabs>
      </Card>

      {/* Active Tab Panel — Side-by-side comparison */}
      {activeGoal && (
        <Box
          role="tabpanel"
          id={`tabpanel-${activeGoal.id}`}
          aria-labelledby={`tab-${activeGoal.id}`}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 2.5,
            flex: 1,
          }}
        >
          {/* LEFT: Previous Plan (Read-Only) */}
          <Card elevation={1}>
            <CardHeader
              title={<Chip label="前回確定" size="small" variant="outlined" />}
              action={
                <Typography variant="caption" color="text.secondary">
                  {previousPlan.planPeriod}
                </Typography>
              }
              sx={{ pb: 0 }}
            />
            <CardContent>
              <Card
                variant="outlined"
                sx={{ bgcolor: 'grey.50', borderRadius: 1.5, mb: 1.5 }}
                aria-label={`前回の${activeGoal.label}`}
              >
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="body2" color="text.primary" sx={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                    {prevGoal?.text || '(前回データなし)'}
                  </Typography>
                </CardContent>
              </Card>

              {prevGoal && (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {prevGoal.domains.map((dId) => {
                    const dm = DOMAINS.find((d) => d.id === dId);
                    return dm ? (
                      <Chip
                        key={dId}
                        label={dm.label}
                        size="small"
                        sx={{ bgcolor: dm.bg, color: dm.color, fontWeight: 600, fontSize: 11 }}
                      />
                    ) : null;
                  })}
                </Stack>
              )}
            </CardContent>
          </Card>

          {/* RIGHT: Current Plan (Editable) */}
          <Card
            elevation={2}
            sx={{ border: 2, borderColor: 'primary.light' }}
          >
            <CardHeader
              title={<Chip label="今回更新案" size="small" color="primary" variant="outlined" />}
              action={
                <Tooltip title="前回のテキストを引用します">
                  <span>
                    <Button
                      size="small"
                      variant="outlined"
                      color={copiedId === activeGoal.id ? 'success' : 'primary'}
                      startIcon={copiedId === activeGoal.id ? <DoneIcon /> : <ContentCopyIcon />}
                      onClick={() => copyFromPrevious(activeGoal.id)}
                      disabled={!prevGoal}
                      aria-label={`前回の${activeGoal.label}を引用`}
                    >
                      {copiedId === activeGoal.id ? '引用済' : '前回から引用'}
                    </Button>
                  </span>
                </Tooltip>
              }
              sx={{ pb: 0 }}
            />
            <CardContent>
              <Stack spacing={2}>
                {/* Text Editor */}
                <TextField
                  id={`goal-textarea-${activeGoal.id}`}
                  value={activeGoal.text}
                  onChange={(e) => updateGoalText(activeGoal.id, e.target.value)}
                  placeholder="目標・支援内容を入力してください…"
                  multiline
                  minRows={4}
                  maxRows={12}
                  fullWidth
                  variant="outlined"
                  aria-describedby={showSmart ? 'smart-guide-panel' : undefined}
                  sx={{
                    '& .MuiOutlinedInput-root': { bgcolor: 'grey.50', borderRadius: 1.5 },
                  }}
                />

                {/* Domain Tags */}
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                    5領域タグ：
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {DOMAINS.map((d) => {
                      const isOn = activeGoal.domains.includes(d.id);
                      return (
                        <Chip
                          key={d.id}
                          label={d.label}
                          size="small"
                          clickable
                          icon={isOn ? <DoneIcon sx={{ fontSize: 14 }} /> : undefined}
                          onClick={() => toggleDomain(activeGoal.id, d.id)}
                          aria-pressed={isOn}
                          sx={{
                            bgcolor: isOn ? d.bg : 'background.paper',
                            color: isOn ? d.color : 'text.disabled',
                            borderColor: isOn ? d.color + '60' : 'grey.300',
                            border: 1,
                            fontWeight: isOn ? 700 : 400,
                            minHeight: 32,
                            '&:hover': { bgcolor: isOn ? d.bg : 'grey.100' },
                          }}
                        />
                      );
                    })}
                  </Stack>
                </Box>

                {/* Diff Preview */}
                {diff && <DiffPreview diff={diff} />}
              </Stack>
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
};
