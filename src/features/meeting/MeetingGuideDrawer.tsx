import { HYDRATION_FEATURES, estimatePayloadSize, startFeatureSpan } from '@/hydration/features';
import {
    Close as CloseIcon,
    ListAlt as ListAltIcon,
} from '@mui/icons-material';
import {
    Box,
    Button,
    Chip,
    Divider,
    Drawer,
    IconButton,
    Paper,
    Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { HandoffMiniSummaryForDrawer } from '../handoff/HandoffMiniSummaryForDrawer';
import MeetingStepsChecklist from './MeetingStepsChecklist';
import type { MeetingKind } from './meetingSteps';
import { useCurrentMeeting } from './useCurrentMeeting';

export type MeetingGuideDrawerProps = {
  open: boolean;
  kind: MeetingKind;
  onClose: () => void;
};

const MeetingGuideDrawer: React.FC<MeetingGuideDrawerProps> = ({
  open,
  kind,
  onClose,
}) => {
  // Phase 5B Step 2: useCurrentMeeting統合フック利用
  const currentMeeting = useCurrentMeeting(kind);
  const {
    steps,
    toggleStep,
    priorityUsers,
    error,
    handoffAlert, // Option B: アラート情報を取得
  } = currentMeeting;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const drawerStatsRef = useRef({
    stepCount: steps.length,
    completedSteps: steps.filter((step) => step.completed).length,
    priorityCount: priorityUsers.length,
    bytes: estimatePayloadSize({ steps, priorityUsers }),
  });

  useEffect(() => {
    drawerStatsRef.current = {
      stepCount: steps.length,
      completedSteps: steps.filter((step) => step.completed).length,
      priorityCount: priorityUsers.length,
      bytes: estimatePayloadSize({ steps, priorityUsers }),
    };
  }, [priorityUsers, steps]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const span = startFeatureSpan(HYDRATION_FEATURES.meeting.drawer, {
      kind,
      ...drawerStatsRef.current,
    });
    span({ meta: { status: 'opened' } });
  }, [kind, open]);

  useEffect(() => {
    if (!open || !isMobile) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isMobile, open]);

  useEffect(() => {
    if (!open || !isMobile) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobile, onClose, open]);

  // Step 7C: 申し送りタイムライン連携ナビゲーション
  const navigate = useNavigate();

  const handleOpenHandoffTimeline = () => {
    if (kind === 'morning') {
      // 朝会 → 昨日の申し送り（前日からの引き継ぎ確認）
      navigate('/handoff-timeline', {
        state: {
          dayScope: 'yesterday',
          timeFilter: 'all',
        },
      });
    } else {
      // 夕会 → 今日の申し送り（今日の振り返り）
      navigate('/handoff-timeline', {
        state: {
          dayScope: 'today',
          timeFilter: 'all',
        },
      });
    }
    onClose();
  };

  // エラーハンドリング
  const content = error ? (
    <Box sx={{ width: { xs: '100%', sm: 400, md: 480 }, p: 2 }}>
      <Typography color="error">
        エラー: {error.message}
      </Typography>
    </Box>
  ) : (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* タイトル */}
        <Box sx={{ p: 3, pb: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                {kind === 'morning' ? '📋 朝会進行ガイド' : '📋 夕会進行ガイド'}
              </Typography>
              <Chip
                label={kind === 'morning' ? '9:00-9:15' : '17:15-17:30'}
                size="small"
                color={kind === 'morning' ? 'primary' : 'secondary'}
              />
            </Box>
            <IconButton onClick={onClose} size="small" aria-label="閉じる">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* 説明 */}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {kind === 'morning'
              ? '朝会を効率的に進行するためのステップガイドです。チェックボックスをクリックして進捗を管理できます。'
              : '夕会を円滑に進行するためのステップガイドです。一日の振り返りと翌日への申し送りを整理しましょう。'}
          </Typography>
        </Box>

        {/* スクロール可能コンテンツ */}
        <Box sx={{ flex: 1, overflow: 'auto', px: 3 }}>
          {/* Option A: 申し送りミニサマリー */}
          <HandoffMiniSummaryForDrawer kind={kind} />

          {/* 🎯 今日の重点フォロー */}
          <Typography variant="h6" sx={{ mb: 2, mt: 3, color: 'primary.main' }}>
            🎯 今日の重点フォロー
          </Typography>
          <Paper sx={{ p: 2, mb: 3, bgcolor: 'warning.50' }}>
            {priorityUsers.length > 0 ? (
              priorityUsers.map((user, index) => (
                <Box key={user.id} sx={{ display: 'flex', alignItems: 'center', mb: index < priorityUsers.length - 1 ? 1 : 0 }}>
                  <Chip
                    label={index + 1}
                    size="small"
                    sx={{ mr: 1, minWidth: 24 }}
                    color="warning"
                  />
                  <Typography variant="body2">
                    <strong>{user.name}</strong> - {user.reason}
                  </Typography>
                </Box>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">
                今日は特に重点的にフォローする対象者はありません
              </Typography>
            )}
          </Paper>

          {/* Step 7C: 申し送り連携ボタン */}
          <Box sx={{ mb: 3 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<ListAltIcon />}
              onClick={handleOpenHandoffTimeline}
              sx={{
                py: 1.5,
                borderColor: kind === 'morning' ? 'primary.main' : 'secondary.main',
                color: kind === 'morning' ? 'primary.main' : 'secondary.main',
                '&:hover': {
                  borderColor: kind === 'morning' ? 'primary.dark' : 'secondary.dark',
                  bgcolor: kind === 'morning' ? 'primary.50' : 'secondary.50',
                }
              }}
            >
              {kind === 'morning' ? '📋 詳細を確認する' : '📋 詳細を確認する'}
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}>
              {kind === 'morning'
                ? '昨日の申し送り詳細をすべて確認できます'
                : '今日の申し送り詳細をすべて確認できます'
              }
            </Typography>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* 進行ステップ */}
          <Typography variant="h6" sx={{ mb: 2 }}>
            進行ステップ
          </Typography>
          <Box sx={{ pb: 3 }}>
            <MeetingStepsChecklist
              title={kind === 'morning' ? '朝会進行ステップ' : '夕会進行ステップ'}
              steps={steps}
              onToggleStep={toggleStep}
              colorVariant={kind === 'morning' ? 'primary' : 'secondary'}
              handoffAlert={handoffAlert}
              footerText={
                kind === 'morning'
                  ? '💡 各ステップをクリックすると完了マークできます。約5-10分で朝会が完了します。'
                  : '💡 各ステップをクリックすると完了マークできます。約10-15分で夕会が完了します。'
              }
            />
          </Box>
        </Box>
      </Box>
  );

  if (isMobile) {
    if (!open) {
      return null;
    }

    return (
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          bgcolor: 'background.default',
          zIndex: 1300,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {content}
      </Box>
    );
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100vw', sm: 400, md: 480 },
          maxWidth: '100vw'
        },
      }}
    >
      {content}
    </Drawer>
  );
};

export default MeetingGuideDrawer;