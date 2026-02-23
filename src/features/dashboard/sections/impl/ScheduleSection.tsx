/**
 * Dashboard Schedule Section Component
 *
 * 責務：「今日の予定」セクションの表示
 * - Page から予定レーンデータを受け取る
 * - JSX 描画のみ
 *
 * 現在：Page の renderSection(case 'schedule') の JSX をそのまま移動
 */

import { Link } from 'react-router-dom';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import React from 'react';

export type ScheduleItem = {
  id: string;
  time: string;
  title: string;
  location?: string;
  owner?: string;
};

export type ScheduleLanes = {
  userLane: ScheduleItem[];
  staffLane: ScheduleItem[];
  organizationLane: ScheduleItem[];
};

export type ScheduleSectionProps = {
  title?: string;
  schedulesEnabled: boolean;
  scheduleLanesToday: ScheduleLanes;
};

export const ScheduleSection: React.FC<ScheduleSectionProps> = (props) => {
  const { title = '今日の予定', schedulesEnabled, scheduleLanesToday } = props;

  return (
    <Paper elevation={3} sx={{ p: { xs: 2, sm: 2.5, md: 3 } }} data-testid="dashboard-section-schedule">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        sx={{ mb: 1.5 }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {schedulesEnabled && (
          <Button
            variant="outlined"
            startIcon={<EventAvailableRoundedIcon />}
            component={Link}
            to="/schedules/week"
            sx={{ alignSelf: { xs: 'stretch', sm: 'auto' } }}
          >
            マスタースケジュールを開く
          </Button>
        )}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        レーンごとの進行状況を確認できます。
      </Typography>
      <Grid container spacing={2}>
        {[
          { label: '利用者レーン', items: scheduleLanesToday.userLane },
          { label: '職員レーン', items: scheduleLanesToday.staffLane },
          { label: '組織レーン', items: scheduleLanesToday.organizationLane },
        ].map(({ label, items }) => (
          <Grid key={label} size={{ xs: 12, md: 4 }}>
            <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                {label}
              </Typography>
              <List dense>
                {items.map((item) => (
                  <ListItem
                    key={item.id}
                    disableGutters
                    alignItems="flex-start"
                    sx={{ py: 0.5 }}
                  >
                    <ListItemText
                      primary={`${item.time} ${item.title}`}
                      secondary={
                        item.location
                          ? `場所: ${item.location}`
                          : item.owner
                            ? `担当: ${item.owner}`
                            : undefined
                      }
                      primaryTypographyProps={{ fontWeight: 600 }}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
};
