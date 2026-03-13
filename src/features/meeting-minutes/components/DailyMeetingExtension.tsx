/**
 * DailyMeetingExtension — 朝会・夕会専用フォームセクション
 *
 * MeetingMinutesForm にカテゴリが「朝会」「夕会」の場合のみ表示される
 * 追加入力セクション。職員出欠・利用者体調・申し送り連携を提供。
 */
import HandoffSummaryForMeeting from '@/features/handoff/HandoffSummaryForMeeting';
import RegulatoryFindingsForMeeting from '@/features/handoff/RegulatoryFindingsForMeeting';
import GroupIcon from '@mui/icons-material/Group';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import {
    Alert,
    Box,
    Chip,
    Divider,
    Paper,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import * as React from 'react';
import type { MeetingCategory } from '../types';

export type DailyMeetingExtensionProps = {
  category: MeetingCategory;
  staffAttendance: string;
  userHealthNotes: string;
  onStaffAttendanceChange: (value: string) => void;
  onUserHealthNotesChange: (value: string) => void;
};

const STAFF_PLACEHOLDER_MORNING =
  `例）\n` +
  `・出勤: 田中、佐藤、鈴木、山田、高橋\n` +
  `・欠勤: 伊藤（体調不良）\n` +
  `・早退予定: 佐藤（15:00～）\n` +
  `・応援: 渡辺（B棟から）`;

const STAFF_PLACEHOLDER_EVENING =
  `例）\n` +
  `・本日出勤: 田中、佐藤、鈴木、山田、高橋\n` +
  `・明日の出勤予定: 山田、高橋、伊藤\n` +
  `・明日の欠勤: 佐藤（有給）`;

const USER_PLACEHOLDER_MORNING =
  `例）\n` +
  `・Aさん: 昨日の活動中に体調不良あり（37.2℃）。本日の活動は様子を見て判断。\n` +
  `・Bさん: 本日通院予定（10:00 送迎）。薬の変更の可能性あり。\n` +
  `・Cさん: 昨日午後に転倒あり（外傷なし）。本日の活動は軽作業に限定。`;

const USER_PLACEHOLDER_EVENING =
  `例）\n` +
  `・Aさん: 日中36.5℃安定。活動に参加。食事は全量摂取。明日も検温継続。\n` +
  `・Bさん: 通院結果 → 薬変更なし。次回は2週間後。\n` +
  `・Dさん: 午後から気分の落ち込みあり。声かけで改善。明日も注意して見守り。`;

export const DailyMeetingExtension: React.FC<DailyMeetingExtensionProps> = ({
  category,
  staffAttendance,
  userHealthNotes,
  onStaffAttendanceChange,
  onUserHealthNotesChange,
}) => {
  const isMorning = category === '朝会';
  const dayScope = isMorning ? 'yesterday' as const : 'today' as const;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderColor: 'primary.light',
        borderWidth: 2,
        borderRadius: 2,
        bgcolor: 'primary.50',
      }}
    >
      <Stack spacing={2.5}>
        {/* Section Header */}
        <Stack direction="row" alignItems="center" spacing={1}>
          <Chip
            label={isMorning ? '☀️ 朝会専用セクション' : '🌆 夕会専用セクション'}
            color="primary"
            size="small"
            sx={{ fontWeight: 600 }}
          />
          <Typography variant="caption" color="text.secondary">
            {isMorning
              ? '出勤状況・利用者の体調・前日からの申し送りを確認'
              : '日中の活動状況・明日への引き継ぎ事項を確認'}
          </Typography>
        </Stack>

        {/* ── 1. 申し送りサマリー（自動取得） ── */}
        <Box>
          <HandoffSummaryForMeeting
            dayScope={dayScope}
            title={isMorning ? '前日の申し送り状況' : '本日の申し送り状況'}
            description={
              isMorning
                ? '前日の日中活動で記録された申し送りを自動取得しています。'
                : '本日の日中に記録された申し送りを表示しています。'
            }
          />
        </Box>

        {/* P6 Phase 2: 制度系 finding 共有カード */}
        <RegulatoryFindingsForMeeting dayScope={dayScope} />

        <Divider />

        {/* ── 2. 職員の出欠・配置 ── */}
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <GroupIcon color="primary" fontSize="small" />
            <Typography variant="subtitle2" fontWeight={600}>
              {isMorning ? '職員の出欠・配置確認' : '本日の出勤状況・翌日の配置'}
            </Typography>
          </Stack>
          <Alert severity="info" variant="outlined" sx={{ mb: 1.5 }}>
            {isMorning
              ? '本日の出勤者、欠勤・遅刻・早退、応援スタッフを記録してください。'
              : '本日の出勤状況と明日の出勤予定を記録してください。'}
          </Alert>
          <TextField
            value={staffAttendance}
            onChange={(e) => onStaffAttendanceChange(e.target.value)}
            fullWidth
            multiline
            minRows={4}
            placeholder={isMorning ? STAFF_PLACEHOLDER_MORNING : STAFF_PLACEHOLDER_EVENING}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'background.paper',
              },
            }}
          />
        </Box>

        <Divider />

        {/* ── 3. 利用者の体調・特記事項 ── */}
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <HealthAndSafetyIcon color="warning" fontSize="small" />
            <Typography variant="subtitle2" fontWeight={600}>
              {isMorning ? '利用者の体調・特記事項' : '日中の利用者の様子'}
            </Typography>
          </Stack>
          <Alert severity="warning" variant="outlined" sx={{ mb: 1.5 }}>
            {isMorning
              ? '前日の活動での体調変化、通院予定、スタッフ全員で共有すべき特記事項を記録。'
              : '日中の活動での体調変化、活動参加状況、明日の注意点を記録。'}
          </Alert>
          <TextField
            value={userHealthNotes}
            onChange={(e) => onUserHealthNotesChange(e.target.value)}
            fullWidth
            multiline
            minRows={5}
            placeholder={isMorning ? USER_PLACEHOLDER_MORNING : USER_PLACEHOLDER_EVENING}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'background.paper',
              },
            }}
          />
        </Box>
      </Stack>
    </Paper>
  );
};
