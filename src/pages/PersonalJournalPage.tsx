/**
 * Personal Monthly Journal Page (個人月次業務日誌)
 *
 * Displays a single user's daily records for one month in the exact layout
 * of the legacy Excel business journal (業務日誌01.07.19.xlsx).
 *
 * Layout: rows = days of month, columns match the Excel:
 * 日付 | 曜日 | 出欠 | 朝(送迎) | 帰り(送迎) | 食事 |
 */
import { PersonalJournalControls } from '@/features/attendance/components/personal-journal/PersonalJournalControls';
import {
    MOCK_USERS
} from '@/features/attendance/components/personal-journal/personalJournalHelpers';
import { PersonalJournalLegend } from '@/features/attendance/components/personal-journal/PersonalJournalLegend';
import { personalJournalPrintStyles } from '@/features/attendance/components/personal-journal/personalJournalPrintStyles';
import { PersonalJournalTable } from '@/features/attendance/components/personal-journal/PersonalJournalTable';
import { usePersonalJournalData } from '@/features/attendance/usePersonalJournalData';
import { useHandoffTimeline } from '@/features/handoff/useHandoffTimeline';
import { TESTIDS } from '@/testids';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';

import React from 'react';
import { useSearchParams } from 'react-router-dom';



// ── Component ───────────────────────────────────────────────────────────────

export default function PersonalJournalPage() {
  const now = new Date();
  const [searchParams] = useSearchParams();

  // Deep-link support: ?user=U001&month=2026-03
  const initialUser = searchParams.get('user') ?? MOCK_USERS[0].id;
  const initialMonth = searchParams.get('month'); // "YYYY-MM" or null
  const [selectedUserId, setSelectedUserId] = React.useState<string>(
    MOCK_USERS.some((u) => u.id === initialUser) ? initialUser : MOCK_USERS[0].id,
  );
  const [selectedYear, setSelectedYear] = React.useState(() => {
    if (initialMonth) {
      const y = Number(initialMonth.split('-')[0]);
      if (Number.isFinite(y) && y > 2000) return y;
    }
    return now.getFullYear();
  });
  const [selectedMonth, setSelectedMonth] = React.useState(() => {
    if (initialMonth) {
      const m = Number(initialMonth.split('-')[1]);
      if (Number.isFinite(m) && m >= 1 && m <= 12) return m;
    }
    return now.getMonth() + 1;
  });

  const selectedUser = MOCK_USERS.find((u) => u.id === selectedUserId) ?? MOCK_USERS[0];

  // 申し送りデータ取得（当日分）
  const { todayHandoffs } = useHandoffTimeline('all', 'today');

  const { entries } = usePersonalJournalData(selectedUserId, selectedYear, selectedMonth, todayHandoffs);

  // Month options
  const monthOptions = React.useMemo(() => {
    const options: { value: string; label: string; year: number; month: number }[] = [];
    for (let offset = -6; offset <= 0; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      options.push({
        value: `${y}-${String(m).padStart(2, '0')}`,
        label: `${y}年${m}月`,
        year: y,
        month: m,
      });
    }
    return options;
  }, []);

  const handleMonthChange = (value: string) => {
    const opt = monthOptions.find((o) => o.value === value);
    if (opt) {
      setSelectedYear(opt.year);
      setSelectedMonth(opt.month);
    }
  };

  // Summary stats
  const stats = React.useMemo(() => {
    let attended = 0;
    let absent = 0;
    let late = 0;
    for (const e of entries) {
      if (e.attendance === '出席') attended++;
      if (e.attendance === '欠席') absent++;
      if (e.attendance === '遅刻') { attended++; late++; }
    }
    return { attended, absent, late };
  }, [entries]);



  return (
    <>
    {personalJournalPrintStyles}
    <Container
      maxWidth={false}
      sx={{ px: { xs: 1, md: 2 } }}
      data-testid={TESTIDS['personal-journal-page']}
    >
      <Box sx={{ py: 2 }}>
        <PersonalJournalControls
          selectedUserId={selectedUserId}
          setSelectedUserId={setSelectedUserId}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          handleMonthChange={handleMonthChange}
          monthOptions={monthOptions}
        />

        {/* ── Excel-style Journal Table ────────────────────────────────── */}
        <PersonalJournalTable
          entries={entries}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          selectedUser={selectedUser}
          stats={stats}
        />

        <PersonalJournalLegend />

      </Box>
    </Container>
    </>
  );
}
