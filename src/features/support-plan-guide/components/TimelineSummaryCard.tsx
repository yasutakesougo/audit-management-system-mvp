import React from 'react';
import { 
  Paper, 
  Typography, 
  Stack, 
  Box, 
  Chip, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText,
  Divider,
  LinearProgress
} from '@mui/material';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import SafetyCheckRoundedIcon from '@mui/icons-material/SafetyCheckRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';

import type { SupportPlanTimelineSummary, SupportPlanGuidance } from '../domain/timeline';
import type { SupportPlanNarrative } from '../domain/narrativeEngine';

interface TimelineSummaryCardProps {
  summary: SupportPlanTimelineSummary;
  guidance: SupportPlanGuidance;
  narrative: SupportPlanNarrative | null;
  isLoading?: boolean;
  onJumpToEvidence?: (sourceType: string, value: any) => void;
}

export const TimelineSummaryCard: React.FC<TimelineSummaryCardProps> = ({
  summary,
  guidance,
  narrative,
  isLoading,
  onJumpToEvidence,
}) => {
  if (isLoading) {
    return (
      <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">
          履歴を解析中...
        </Typography>
        <LinearProgress />
      </Paper>
    );
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'info': return <InfoRoundedIcon color="info" fontSize="small" />;
      case 'warn': return <WarningRoundedIcon color="warning" fontSize="small" />;
      case 'critical': return <ErrorRoundedIcon color="error" fontSize="small" />;
      case 'success': return <CheckCircleRoundedIcon color="success" fontSize="small" />;
      default: return <InfoRoundedIcon fontSize="small" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'info': return 'info.main';
      case 'warn': return 'warning.main';
      case 'critical': return 'error.main';
      case 'success': return 'success.main';
      default: return 'text.secondary';
    }
  };

  return (
    <Paper 
      variant="outlined" 
      sx={{ 
        p: 2, 
        background: 'linear-gradient(145deg, #ffffff 0%, #f8faff 100%)',
        borderLeft: '4px solid',
        borderLeftColor: 'primary.main',
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <TimelineRoundedIcon color="primary" />
          <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 700 }}>
            支援計画タイムライン分析
          </Typography>
        </Stack>

        {/* KPIs */}
        <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              通算バージョン
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {summary.totalVersions} <Typography variant="caption">世代</Typography>
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              構造的変更
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {summary.structuralChanges} <Typography variant="caption">回</Typography>
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              重要安全更新
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {summary.criticalSafetyUpdates} <Typography variant="caption">回</Typography>
            </Typography>
          </Box>
          {summary.stagnantSince && (
            <Box>
              <Typography variant="caption" color="error" sx={{ display: 'block', fontWeight: 600 }}>
                停滞の兆候
              </Typography>
              <Typography variant="body1" color="error.main" sx={{ fontWeight: 700 }}>
                {Math.floor((new Date().getTime() - new Date(summary.stagnantSince).getTime()) / (1000 * 60 * 60 * 24))} 
                <Typography variant="caption" color="inherit"> 日間変更なし</Typography>
              </Typography>
            </Box>
          )}
        </Stack>

        <Divider />

        {/* Insight Narrative (v1 Template / Future AI) */}
        {narrative && (
          <Box 
            sx={{ 
              p: 2, 
              borderRadius: 1, 
              backgroundColor: 'rgba(25, 118, 210, 0.04)',
              border: '1px solid rgba(25, 118, 210, 0.1)'
            }}
          >
            <Stack spacing={1}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <PsychologyRoundedIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  インサイト要約
                </Typography>
              </Stack>
              
              <Typography variant="body2" sx={{ lineHeight: 1.6, fontWeight: 500 }}>
                {narrative.summary.text}
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ mb: 1 }}>
                {narrative.summary.evidence.map((ev, i) => (
                  <Chip 
                    key={i} 
                    label={ev.label} 
                    size="small" 
                    variant="outlined" 
                    onClick={() => onJumpToEvidence?.(ev.sourceType, ev.value)}
                    sx={{ 
                      height: 18, 
                      fontSize: '0.65rem', 
                      color: 'primary.main', 
                      borderColor: 'rgba(25, 118, 210, 0.2)',
                      cursor: onJumpToEvidence ? 'pointer' : 'default'
                    }} 
                  />
                ))}
              </Stack>
              
              {narrative.details.length > 0 && (
                <Box sx={{ my: 1, pl: 1, borderLeft: '2px solid rgba(0,0,0,0.1)' }}>
                  {narrative.details.map((section, i) => (
                    <Box key={i} sx={{ mb: 1 }}>
                      <Typography variant="caption" sx={{ display: 'block', mb: 0.25, color: 'text.secondary', fontWeight: 500 }}>
                        ・{section.text}
                      </Typography>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap">
                        {section.evidence.map((ev, j) => (
                          <Chip 
                            key={j} 
                            label={ev.label} 
                            size="small" 
                            onClick={() => onJumpToEvidence?.(ev.sourceType, ev.value)}
                            sx={{ 
                              height: 16, 
                              fontSize: '0.6rem', 
                              backgroundColor: 'rgba(0,0,0,0.05)', 
                              color: 'text.secondary',
                              cursor: onJumpToEvidence ? 'pointer' : 'default'
                            }} 
                          />
                        ))}
                      </Stack>
                    </Box>
                  ))}
                </Box>
              )}

              <Typography variant="body2" sx={{ mt: 1, fontWeight: 700, p: 1, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.6)' }}>
                導出アクション: {narrative.conclusion.text}
              </Typography>
            </Stack>
          </Box>
        )}

        {/* Guidance Items */}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}>
            <SafetyCheckRoundedIcon fontSize="small" />
            自動判別ガイダンス
          </Typography>
          <List dense disablePadding>
            {guidance.items.map((item, idx) => (
              <ListItem 
                key={idx} 
                sx={{ 
                  borderRadius: 1,
                  mb: 0.5,
                  backgroundColor: 'rgba(0,0,0,0.01)',
                  '&:hover': { backgroundColor: 'rgba(0,0,0,0.03)' }
                }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  {getSeverityIcon(item.severity)}
                </ListItemIcon>
                <ListItemText 
                  primary={item.message}
                  secondary={item.actionLabel}
                  primaryTypographyProps={{ 
                    variant: 'body2', 
                    fontWeight: item.severity === 'critical' ? 700 : 500,
                    color: getSeverityColor(item.severity)
                  }}
                  secondaryTypographyProps={{
                    sx: { fontSize: '0.75rem', mt: 0.5, color: 'text.primary', fontWeight: 600 }
                  }}
                />
              </ListItem>
            ))}
            {guidance.items.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', pl: 1 }}>
                現在、特筆すべきガイダンスはありません。
              </Typography>
            )}
          </List>
        </Box>

        {/* Completed Tasks History */}
        {summary.completedTasks && summary.completedTasks.length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}>
              <HistoryRoundedIcon fontSize="small" color="success" />
              実行済みの修正アクション
            </Typography>
            <Stack spacing={1}>
              {summary.completedTasks.map((task) => (
                <Box 
                  key={task.taskId}
                  sx={{ 
                    p: 1.5, 
                    borderRadius: 1, 
                    backgroundColor: 'rgba(46, 125, 50, 0.03)',
                    border: '1px dashed rgba(46, 125, 50, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <AssignmentTurnedInRoundedIcon sx={{ color: 'success.main', fontSize: 20 }} />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                        {task.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        完了日: {task.executedAt ? new Date(task.executedAt).toLocaleDateString() : '不明'}
                      </Typography>
                    </Box>
                  </Stack>
                  <Chip 
                    label="実行済み" 
                    size="small" 
                    color="success" 
                    variant="outlined" 
                    sx={{ height: 20, fontSize: '0.65rem' }} 
                  />
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
             <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
               <EditNoteRoundedIcon sx={{ fontSize: 14 }} />
               Deterministic Guidance Engine v1.0 (Rule-based)
             </Typography>
        </Box>
      </Stack>
    </Paper>
  );
};
