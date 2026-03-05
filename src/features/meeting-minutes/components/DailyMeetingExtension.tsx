/**
 * DailyMeetingExtension — 朝会・夕会専用フォームセクション
 *
 * MeetingMinutesForm にカテゴリが「朝会」「夕会」の場合のみ表示される
 * 追加入力セクション。職員出欠・利用者体調・申し送り連携を提供。
 */
import HandoffSummaryForMeeting from '@/features/handoff/HandoffSummaryForMeeting';
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
  `・夜勤入り: 田中、鈴木\n` +
  `・残業: 佐藤（19:00まで）\n` +
  `・明日の早番: 山田、高橋`;

const USER_PLACEHOLDER_MORNING =
  `例）\n` +
  `・Aさん: 昨夜37.8℃の発熱あり。朝は36.5℃に下降。食欲あり。経過観察。\n` +
  `・Bさん: 本日通院予定（10:00 送迎）。薬の変更の可能性あり。\n` +
  `・Cさん: 昨日夕方に転倒（外傷なし）。本日の活動は様子を見て判断。`;

const USER_PLACEHOLDER_EVENING =
  `例）\n` +
  `・Aさん: 日中36.5℃安定。食事は全量摂取。明日も検温継続。\n` +
  `・Bさん: 通院結果 → 薬変更なし。次回は2週間後。\n` +
  `・Dさん: 午後から気分の落ち込みあり。声かけで改善。夜間の見守り強化を。`;

export const DailyMeetingExtension: React.FC<DailyMeetingExtensionProps> = ({
  category,
  staffAttendance,
  userHealthNotes,
  onStaffAttendanceChange,
  onUserHealthNotesChange,
}) => {
  const isMorning = category === '朝会';
  const dayScope = isMorning ? 'today' : 'today';

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
              ? '出勤状況・利用者の体調・夜間からの申し送りを確認'
              : '日中の状況・夜勤への引き継ぎ・明日の準備事項を確認'}
          </Typography>
        </Stack>

        {/* ── 1. 申し送りサマリー（自動取得） ── */}
        <Box>
          <HandoffSummaryForMeeting
            dayScope={dayScope}
            title={isMorning ? '夜間〜朝の申し送り状況' : '日中の申し送り状況'}
            description={
              isMorning
                ? '昨夜から今朝にかけての申し送りを自動取得しています。'
                : '今日の日中に記録された申し送りを表示しています。'
            }
          />
        </Box>

        <Divider />

        {/* ── 2. 職員の出欠・配置 ── */}
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <GroupIcon color="primary" fontSize="small" />
            <Typography variant="subtitle2" fontWeight={600}>
              {isMorning ? '職員の出欠・配置確認' : '夜勤・翌日の配置'}
            </Typography>
          </Stack>
          <Alert severity="info" variant="outlined" sx={{ mb: 1.5 }}>
            {isMorning
              ? '本日の出勤者、欠勤・遅刻・早退、応援スタッフを記録してください。'
              : '夜勤入りスタッフ、残業者、明日の早番を記録してください。'}
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
              ? '体調不良者、通院予定、夜間の特記事項など、スタッフ全員で共有すべき情報を記録。'
              : '日中の体調変化、活動参加状況、夜間ケアの注意点を記録。'}
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
