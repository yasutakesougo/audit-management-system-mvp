import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';

import HandoffSummaryForMeeting from '@/features/handoff/HandoffSummaryForMeeting';
import MeetingStepsChecklist from '@/features/meeting/MeetingStepsChecklist';
import { meetingLogger } from '@/features/meeting/logging/meetingLogger';
import type { MeetingKind } from '@/features/meeting/meetingSteps';
import { useCurrentMeeting } from '@/features/meeting/useCurrentMeeting';
import { TESTIDS, tid } from '@/testids';
// TODO: 将来的にはMeetingGuideDrawerとの連携も予定

/**
 * セッションキーを人間向けの表記に変換
 */
const formatSessionDisplay = (sessionKey: string): string => {
  const [dateStr, kind] = sessionKey.split('_');
  const date = new Date(dateStr);

  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const weekday = weekdays[date.getDay()];

  const kindLabel = kind === 'morning' ? '朝会' : '夕会';
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return `${month}/${day}（${weekday}） ${kindLabel}セッション`;
};

/**
 * 日時をHH:MM形式でフォーマット
 */
const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

const MeetingGuidePage: React.FC = () => {
  const [tab, setTab] = useState<MeetingKind>('morning');

  // Phase 5B: 統合フックで単一情報源化
  const currentMeeting = useCurrentMeeting(tab);
  const {
    sessionKey,
    session,
    steps,
    stats,
    toggleStep,
    priorityUsers,
    handoffAlert, // Option B: アラート情報取得
    loading: sessionLoading,
    error: sessionError,
  } = currentMeeting;

    // Log priority users loading (Phase 5B統合後)
  useEffect(() => {
    if (priorityUsers.length > 0) {
      meetingLogger.priorityUsersLoaded({
        sessionKey,
        kind: tab,
        count: priorityUsers.length,
      });
    }
  }, [priorityUsers.length, sessionKey, tab]);

  const stepsCardTestId = tab === 'morning'
    ? TESTIDS['meeting-guide-morning']
    : TESTIDS['meeting-guide-evening'];

  const handleClearAll = useCallback(() => {
    const completedSteps = steps.filter(step => step.completed);
    completedSteps.forEach(step => {
      void toggleStep(step.id);
    });
  }, [steps, toggleStep]);

  // Log priority users loading
  useEffect(() => {
    if (priorityUsers.length > 0) {
      meetingLogger.priorityUsersLoaded({
        sessionKey,
        kind: tab,
        count: priorityUsers.length,
      });
    }
  }, [priorityUsers.length, sessionKey, tab]);

  if (sessionLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 2 }}>
          会議セッションを読み込み中...
        </Typography>
      </Container>
    );
  }

  if (sessionError) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">
          会議セッションの読み込みに失敗しました: {sessionError.message}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* ページタイトル */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          朝会・夕会 進行ガイド
        </Typography>
        <Chip
          label="司会者用"
          color="primary"
          size="small"
          sx={{ fontWeight: 'bold' }}
        />
      </Stack>

      {/* 説明ブロック */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="body1" sx={{ mb: 1 }}>
          このページは、朝会・夕会の進行をサポートするための「司会者用ガイド」です。
        </Typography>
        <Typography variant="body2" color="text.secondary">
          チェックリストを進行に合わせてオン／オフしながら、
          参加メンバー全員が安心して情報共有できる場づくりを目指します。
        </Typography>
      </Paper>

      {/* 朝会 / 夕会 タブ */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tab}
          onChange={(_, v: MeetingKind) => setTab(v)}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab
            value="morning"
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <span>🌅 朝会（始業前）</span>
                <Chip label="9:00〜" size="small" color="primary" />
              </Stack>
            }
          />
          <Tab
            value="evening"
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <span>🌆 夕会（終業前）</span>
                <Chip label="17:15〜" size="small" color="secondary" />
              </Stack>
            }
          />
        </Tabs>
      </Paper>

      {/* 申し送り状況サマリー */}
      <HandoffSummaryForMeeting />

      {/* メイン2カラム：左=重点フォロー / 右=進行ステップ */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={3}
        alignItems="flex-start"
      >
        {/* 左：今日の重点フォロー */}
        <Box flex={{ xs: 'none', md: 1 }} width="100%">
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              🎯 今日の重点フォロー
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              情緒が不安定な方や、体調が気になる方、環境変化があった方など、
              今日特にフォローしたい利用者の情報をここに集約します。
            </Typography>

            {priorityUsers.length === 0 ? (
              <Typography variant="body2" color="text.disabled">
                （現在、重点フォロー対象者は登録されていません）
              </Typography>
            ) : (
              <Stack spacing={1}>
                {priorityUsers.map((u, index) => (
                  <Paper
                    key={u.id}
                    variant="outlined"
                    sx={{ p: 1.5, display: 'flex', gap: 1 }}
                  >
                    <Chip
                      label={index + 1}
                      size="small"
                      color="warning"
                      sx={{ alignSelf: 'flex-start' }}
                    />
                    <Box>
                      <Typography variant="body2" fontWeight="bold">
                        {u.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {u.reason}
                      </Typography>
                    </Box>
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>
        </Box>

        {/* 右：進行ステップ */}
        <Box flex={{ xs: 'none', md: 2 }} width="100%">
          <Paper sx={{ p: 2, mb: 2 }} {...tid(stepsCardTestId)}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 1.5 }}
            >
              <Typography variant="h6" component="h2">
                {tab === 'morning' ? '🌅 朝会進行ステップ' : '🌆 夕会進行ステップ'}
              </Typography>

              {/* Phase 5A+: リッチなセッション情報表示 */}
              {session ? (
                <Stack spacing={1} alignItems="flex-end">
                  <Chip
                    label={formatSessionDisplay(session.sessionKey)}
                    size="small"
                    color="info"
                    sx={{ fontWeight: 'bold' }}
                  />
                  <Stack direction="row" spacing={1}>
                    <Typography variant="caption" color="text.secondary">
                      作成：{formatTime(new Date(session.createdAt))}
                    </Typography>
                    {session.updatedAt && (
                      <>
                        <Typography variant="caption" color="text.secondary">
                          /
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          更新：{formatTime(new Date(session.updatedAt))}
                        </Typography>
                      </>
                    )}
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <Chip
                      label={`重点フォロー：${priorityUsers.length}名`}
                      size="small"
                      color="warning"
                      variant="outlined"
                    />
                    <Chip
                      label={`完了ステップ：${stats.completedCount}/${stats.totalCount}`}
                      size="small"
                      color="success"
                      variant="outlined"
                    />
                  </Stack>
                </Stack>
              ) : (
                <Chip
                  label="セッション準備中..."
                  size="small"
                  color="default"
                />
              )}
            </Stack>
            <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={handleClearAll}
                aria-label="チェックを全てクリア"
                {...tid(TESTIDS['meeting-guide-clear'])}
              >
                チェックを全てクリア
              </Button>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              チェックリストを上から順番に進めると、
              約{tab === 'morning' ? '5〜10' : '10〜15'}分で会議がスムーズに終了する設計です。
              チェックは自動保存されます（SharePoint）。
            </Typography>

            <Divider sx={{ mb: 2 }} />

            <Box {...tid(TESTIDS['meeting-guide-checklist'])}>
              <MeetingStepsChecklist
                title=""
                steps={steps}
                onToggleStep={toggleStep}
                colorVariant={tab === 'morning' ? 'primary' : 'secondary'}
                handoffAlert={handoffAlert}
                footerText={
                  tab === 'morning'
                    ? '💡 朝の情報共有や申し送りに必要なポイントを漏れなくカバーできる構成です。'
                    : '🌙 一日の振り返りと翌日への準備をセットで確認できる構成です。'
                }
              />
            </Box>
          </Paper>
        </Box>
      </Stack>
    </Container>
  );
};

export default MeetingGuidePage;