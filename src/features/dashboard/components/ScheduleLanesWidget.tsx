/**
 * ScheduleLanesWidget — スケジュールレーンの表示ウィジェット
 *
 * DashboardPage の renderScheduleLanes ヘルパーから抽出。
 * 利用者・職員・組織の3レーンを Card 内に並べて表示する
 * 純粋な Presentational コンポーネント。
 */

import type { ScheduleItem, ScheduleLanes } from '@/features/dashboard/sections/impl/ScheduleSection';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import React from 'react';

export interface ScheduleLanesWidgetProps {
  /** カードのタイトル（例: "今日の予定", "明日の予定"） */
  title: string;
  /** 3つのレーンデータ */
  lanes: ScheduleLanes;
}

/**
 * 各レーンを1カラムとして描画する内部コンポーネント
 */
const LaneColumn: React.FC<{ label: string; items: ScheduleItem[] }> = ({ label, items }) => (
  <Grid size={{ xs: 12, md: 4 }}>
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Typography variant="subtitle2" component="span" sx={{ fontWeight: 700, mb: 1 }}>
        {label}
      </Typography>
      <List dense>
        {items.map((item) => (
          <ListItem key={item.id} disableGutters>
            <ListItemText
              primary={`${item.time} ${item.title}`}
              secondary={
                item.location
                  ? `場所: ${item.location}`
                  : item.owner
                    ? `担当: ${item.owner}`
                    : undefined
              }
              primaryTypographyProps={{ variant: 'body2' }}
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  </Grid>
);

/**
 * スケジュールレーンウィジェット
 *
 * 利用者・職員・組織の3レーンを横並びに表示する。
 * StaffOnlySection の朝会・夕会カードで使用。
 */
export const ScheduleLanesWidget: React.FC<ScheduleLanesWidgetProps> = ({ title, lanes }) => (
  <Card>
    <CardContent sx={{ py: 1.25, px: 1.5 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        📅 {title}
      </Typography>
      <Grid container spacing={2}>
        <LaneColumn label="利用者レーン" items={lanes.userLane} />
        <LaneColumn label="職員レーン" items={lanes.staffLane} />
        <LaneColumn label="組織レーン" items={lanes.organizationLane} />
      </Grid>
    </CardContent>
  </Card>
);
