import React, { useState } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import { WeeklySummaryChart } from './WeeklySummaryChart';
import MeetingGuidePage from './MeetingGuidePage';

const TABS = [
  { label: '運営管理情報', value: 'management' },
  { label: '申し送りタイムライン', value: 'timeline' },
  { label: '週次サマリー', value: 'weekly' },
  { label: 'ミーティングガイド', value: 'meeting' },
];

export default function DashboardPage() {
  const [tab, setTab] = useState('management');

  // デモ用: ユーザーIDと週開始日（本日月曜）
  const userIds = ['user001', 'user002', 'user003'];
  const today = new Date();
  const weekStart = new Date(today.setDate(today.getDate() - today.getDay() + 1));
  const weekStartYYYYMMDD = weekStart.toISOString().slice(0, 10);

  return (
    <Box sx={{ width: '100%' }}>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        aria-label="黒ノート機能タブ"
        variant="scrollable"
        scrollButtons="auto"
      >
        {TABS.map((t) => (
          <Tab key={t.value} label={t.label} value={t.value} />
        ))}
      </Tabs>
      <Box sx={{ mt: 2 }}>
        {tab === 'management' && (
          <>
            <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>運営管理情報</h2>
            <p style={{ marginBottom: 16 }}>
              施設運営に関する管理情報やお知らせを表示します。
            </p>
            {/* 管理情報のUIやコンポーネントをここに追加 */}
          </>
        )}
        {tab === 'timeline' && (
          <>
            <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>申し送りタイムライン</h2>
            <p style={{ marginBottom: 16 }}>
              施設内の申し送り事項や記録のタイムラインを表示します。
            </p>
            {/* タイムラインのUIやコンポーネントをここに追加 */}
          </>
        )}
        {tab === 'weekly' && (
          <WeeklySummaryChart userIds={userIds} weekStartYYYYMMDD={weekStartYYYYMMDD} />
        )}
        {tab === 'meeting' && <MeetingGuidePage />}
      </Box>
    </Box>
  );
}
