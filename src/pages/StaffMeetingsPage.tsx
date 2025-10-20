import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import FolderSharedRoundedIcon from '@mui/icons-material/FolderSharedRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import dayjs from 'dayjs';
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';

type MeetingSummary = {
  id: string;
  title: string;
  heldAt: string;
  facilitator: string;
  agendaHighlights: string[];
};

const mockMeetings: MeetingSummary[] = [
  {
    id: '2025-03-12',
    title: '令和6年度 第12回 職員会議',
    heldAt: '2025-03-12T18:00:00+09:00',
    facilitator: '管理者 山本',
    agendaHighlights: ['ケーススタディ共有', '次年度行事計画の確認', 'リスクマネジメント振り返り'],
  },
  {
    id: '2025-02-07',
    title: '令和6年度 第11回 職員会議',
    heldAt: '2025-02-07T18:00:00+09:00',
    facilitator: '主任 川崎',
    agendaHighlights: ['医療的ケア対応状況', '支援記録の品質向上策', '避難訓練の振り返り'],
  },
  {
    id: '2025-01-10',
    title: '令和6年度 第10回 職員会議',
    heldAt: '2025-01-10T18:00:00+09:00',
    facilitator: '管理者 山本',
    agendaHighlights: ['事故・ヒヤリハット共有', '個別支援計画進捗', 'ICT活用状況の確認'],
  },
];

const StaffMeetingsPage: React.FC = () => {
  return (
    <Box>
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <EventNoteRoundedIcon color="primary" />
            <Typography variant="h4" component="h1">
              職員会議
            </Typography>
          </Stack>
          <Typography variant="body1" color="text.secondary">
            定例職員会議の議事録や決定事項、フォローアップを一元管理します。会議後に資料をアップロードし、
            対応状況を把握できるようにしてください。
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip label="年度別議事録アーカイブあり" size="small" color="primary" />
            <Chip label="対応期限アラート運用中" size="small" variant="outlined" />
          </Stack>
        </Stack>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">
                会議の流れ
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                }}
              >
                <Stack spacing={1.5}>
                  <AssignmentTurnedInRoundedIcon color="primary" />
                  <Typography variant="subtitle1">アジェンダ準備</Typography>
                  <Typography variant="body2" color="text.secondary">
                    次回会議の議題を1週間前までに登録し、出席者に共有します。
                  </Typography>
                </Stack>
                <Stack spacing={1.5}>
                  <EventNoteRoundedIcon color="primary" />
                  <Typography variant="subtitle1">議事録作成</Typography>
                  <Typography variant="body2" color="text.secondary">
                    会議当日に書記が議事録を作成し、24時間以内に確認フローへ回します。
                  </Typography>
                </Stack>
                <Stack spacing={1.5}>
                  <FolderSharedRoundedIcon color="primary" />
                  <Typography variant="subtitle1">フォローアップ</Typography>
                  <Typography variant="body2" color="text.secondary">
                    決定事項ごとに担当者・期限を管理し、完了までの進捗を追跡します。
                  </Typography>
                </Stack>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Divider />

        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">最近の会議</Typography>
          <Button
            component={RouterLink}
            to="/archives"
            variant="text"
            size="small"
            color="primary"
          >
            過去の議事録を見る
          </Button>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          }}
        >
          {mockMeetings.map((meeting) => {
            const heldAt = dayjs(meeting.heldAt);
            return (
              <Card
                key={meeting.id}
                variant="outlined"
                sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Stack spacing={1.5}>
                    <Stack spacing={0.5}>
                      <Typography variant="subtitle2" color="text.secondary">
                        開催日: {heldAt.format('YYYY年MM月DD日 (ddd) HH:mm')}
                      </Typography>
                      <Typography variant="h6">{meeting.title}</Typography>
                    </Stack>
                    <Chip label={`司会: ${meeting.facilitator}`} size="small" />
                    <Stack spacing={0.5}>
                      <Typography variant="subtitle2" color="text.secondary">
                        主な議題
                      </Typography>
                      <Stack component="ul" spacing={0.5} sx={{ pl: 2, m: 0 }}>
                        {meeting.agendaHighlights.map((item) => (
                          <Typography component="li" variant="body2" key={item}>
                            {item}
                          </Typography>
                        ))}
                      </Stack>
                    </Stack>
                  </Stack>
                </CardContent>
                <Box sx={{ display: 'flex', gap: 1, px: 2, pb: 2 }}>
                  <Button
                    component={RouterLink}
                    to={`/staff/meetings/${meeting.id}`}
                    variant="contained"
                    color="primary"
                    size="small"
                    sx={{ flexGrow: 1 }}
                  >
                    議事録を開く
                  </Button>
                  <Button
                    component={RouterLink}
                    to={`/staff/meetings/${meeting.id}/follow-up`}
                    variant="outlined"
                    size="small"
                  >
                    対応状況
                  </Button>
                </Box>
              </Card>
            );
          })}
        </Box>
      </Stack>
    </Box>
  );
};

export default StaffMeetingsPage;
