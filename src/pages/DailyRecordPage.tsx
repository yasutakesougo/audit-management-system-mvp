import {
    Search as SearchIcon,
    Person as PersonIcon,
    Warning as WarningIcon,
    AccessTime as AccessTimeIcon,
    CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import {
    Box,
    Avatar,
    Button,
    Card,
    CardContent,
    Chip,
    Container,
    FormControl,
    InputLabel,
    List,
    ListItemAvatar,
    ListItemButton,
    ListItemText,
    MenuItem,
    Paper,
    Select,
    Stack,
    TextField,
    Typography
} from '@mui/material';
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { DailyStatus, PersonDaily } from '../domain/daily/types';
import { DailyRecordForm } from '../features/daily/DailyRecordForm';
import { useUsersDemo } from '../features/users/usersStoreDemo';
import { useSchedules } from '../stores/useSchedules';
import { calculateAttendanceRate, getExpectedAttendeeCount } from '../utils/attendanceUtils';

// 32人分の通所者リスト
const mockUsers = [
  '田中太郎', '佐藤花子', '鈴木次郎', '高橋美咲', '山田健一', '渡辺由美', '伊藤雄介',
  '中村恵子', '小林智子', '加藤秀樹', '吉田京子', '清水達也', '松本麻衣', '森田健二',
  '池田理恵', '石井大輔', '橋本真理', '藤田和也', '長谷川瞳', '村上拓海', '坂本彩香',
  '岡田裕太', '近藤美和', '福田誠', '前田愛', '木村康平', '内田千春', '西川雅人',
  '斎藤洋子', '三浦大輔', '小野寺美加', '新井智也'
];

// サンプルの日次記録データ（一部のみ）
const mockRecords: PersonDaily[] = [
  {
    id: 1,
    personId: '001',
    personName: '田中太郎',
    date: new Date().toISOString().split('T')[0],
    status: '完了',
    reporter: { name: '職員A' },
    draft: { isDraft: false },
    kind: 'A',
    data: {
      amActivities: ['散歩', '体操'],
      pmActivities: ['読書', 'テレビ鑑賞'],
      amNotes: '今日は調子が良く、積極的に活動に参加していました。',
      pmNotes: '午後は少し疲れた様子でしたが、落ち着いて過ごしていました。',
      mealAmount: '完食',
      problemBehavior: {
        selfHarm: false,
        violence: false,
        loudVoice: false,
        pica: false,
        other: false,
        otherDetail: ''
      },
      seizureRecord: {
        occurred: false,
        time: '',
        duration: '',
        severity: undefined,
        notes: ''
      },
      specialNotes: '特に問題なく過ごせました。'
    }
  },
  {
    id: 2,
    personId: '002',
    personName: '佐藤花子',
    date: new Date().toISOString().split('T')[0],
    status: '作成中',
    reporter: { name: '職員B' },
    draft: { isDraft: true },
    kind: 'A',
    data: {
      amActivities: ['ラジオ体操'],
      pmActivities: [],
      amNotes: '',
      pmNotes: '',
      mealAmount: '少なめ',
      problemBehavior: {
        selfHarm: false,
        violence: false,
        loudVoice: false,
        pica: false,
        other: false,
        otherDetail: ''
      },
      seizureRecord: {
        occurred: false,
        time: '',
        duration: '',
        severity: undefined,
        notes: ''
      },
      specialNotes: ''
    }
  },
  {
    id: 3,
    personId: '003',
    personName: '鈴木次郎',
    date: new Date().toISOString().split('T')[0],
    status: '未作成',
    reporter: { name: '' },
    draft: { isDraft: true },
    kind: 'A',
    data: {
      amActivities: [],
      pmActivities: [],
      amNotes: '',
      pmNotes: '',
      mealAmount: '完食',
      problemBehavior: {
        selfHarm: false,
        violence: false,
        loudVoice: false,
        pica: false,
        other: false,
        otherDetail: ''
      },
      seizureRecord: {
        occurred: false,
        time: '',
        duration: '',
        severity: undefined,
        notes: ''
      },
      specialNotes: ''
    }
  }
];

// 今日の日付の全通所者分の記録を生成する関数
const generateTodayRecords = (): PersonDaily[] => {
  const today = new Date().toISOString().split('T')[0];
  return mockUsers.map((name, index) => {
    const userId = String(index + 1).padStart(3, '0');
    const statuses: Array<'完了' | '作成中' | '未作成'> = ['完了', '作成中', '未作成'];
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    return {
      id: index + 1,
      personId: userId,
      personName: name,
      date: today,
      status,
      reporter: { name: status === '未作成' ? '' : '職員' + String.fromCharCode(65 + (index % 5)) },
      draft: { isDraft: status !== '完了' },
      kind: 'A' as const,
      data: {
        amActivities: status === '未作成' ? [] : ['活動' + (index % 3 + 1)],
        pmActivities: status === '完了' ? ['活動' + ((index + 1) % 3 + 1)] : [],
        amNotes: status === '完了' ? '順調に過ごしています。' : '',
        pmNotes: status === '完了' ? '問題なく活動できました。' : '',
        mealAmount: (['完食', '多め', '半分', '少なめ', 'なし'] as const)[index % 5],
        problemBehavior: {
          selfHarm: Math.random() > 0.9,
          violence: Math.random() > 0.9,
          loudVoice: Math.random() > 0.85,
          pica: Math.random() > 0.95,
          other: Math.random() > 0.9,
          otherDetail: Math.random() > 0.9 ? 'その他の詳細' : ''
        },
        seizureRecord: {
          occurred: Math.random() > 0.95,
          time: Math.random() > 0.95 ? '14:30' : '',
          duration: Math.random() > 0.95 ? '約3分' : '',
          severity: Math.random() > 0.95 ? (['軽度', '中等度', '重度'] as const)[Math.floor(Math.random() * 3)] : undefined,
          notes: Math.random() > 0.95 ? '発作の詳細' : ''
        },
        specialNotes: status === '完了' && Math.random() > 0.7 ? '特記事項があります。' : ''
      }
    };
  });
};

const statusPriority: Record<DailyStatus, number> = {
  '未作成': 0,
  '作成中': 1,
  '完了': 2,
};

const statusChipPalette: Record<DailyStatus, 'default' | 'warning' | 'success'> = {
  '未作成': 'default',
  '作成中': 'warning',
  '完了': 'success',
};

const statusIconMap: Record<DailyStatus, ReactElement> = {
  '未作成': <WarningIcon fontSize="small" />,
  '作成中': <AccessTimeIcon fontSize="small" />,
  '完了': <CheckCircleIcon fontSize="small" />,
};

export default function DailyRecordPage() {
  // 利用者マスタとスケジュールデータ
  const { data: usersData } = useUsersDemo();
  const { data: schedulesData } = useSchedules();

  const [records, setRecords] = useState<PersonDaily[]>(mockRecords);
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DailyStatus>('all');
  const [dateFilter, setDateFilter] = useState('');

  // 今日の予定通所者数を計算
  const todayAttendanceInfo = useMemo(() => {
    const today = new Date();
    if (!usersData || !schedulesData) {
      // データが読み込まれていない場合は従来の32名固定
      return { expectedCount: 32, attendanceRate: 0 };
    }

    // 型変換（IUserMasterからUserMasterへ）
    const adaptedUsers = usersData.map(user => ({
      Id: user.Id,
      UserID: user.UserID,
      FullName: user.FullName,
      AttendanceDays: user.AttendanceDays || [],
      ServiceStartDate: user.ServiceStartDate || undefined,
      ServiceEndDate: user.ServiceEndDate || undefined
    }));

    // スケジュールデータも型変換
    const adaptedSchedules = schedulesData.map(schedule => ({
      id: schedule.id,
      userId: schedule.userId?.toString() || schedule.personId?.toString(),
      personId: schedule.personId?.toString(),
      title: schedule.title || '',
      startLocal: schedule.startLocal || undefined,
      startUtc: schedule.startUtc || undefined,
      status: schedule.status,
      category: schedule.category || undefined
    }));

    const { expectedCount, absentUserIds } = getExpectedAttendeeCount(
      adaptedUsers,
      adaptedSchedules,
      today
    );

    const todayRecords = records.filter(r => r.date === today.toISOString().split('T')[0]);
    const actualCount = todayRecords.filter(r => r.status === '完了').length;
    const attendanceRate = calculateAttendanceRate(actualCount, expectedCount);

    return { expectedCount, attendanceRate, actualCount, absentUserIds };
  }, [usersData, schedulesData, records]);

  const handleSaveRecord = (updatedRecord: PersonDaily) => {
    setRecords((prevRecords) => {
      const nextRecords = prevRecords.map((record) =>
        record.id === updatedRecord.id ? updatedRecord : record
      );
      const filteredNext = orderRecords(applyFilters(nextRecords));
      const nextIncomplete = (() => {
        const currentIndex = filteredNext.findIndex((record) => record.id === updatedRecord.id);
        const searchOrder =
          currentIndex >= 0
            ? [
                ...filteredNext.slice(currentIndex + 1),
                ...filteredNext.slice(0, currentIndex),
              ]
            : filteredNext;
        return searchOrder.find((record) => record.status !== '完了') ?? null;
      })();

      if (nextIncomplete) {
        setSelectedRecordId(nextIncomplete.id);
      } else if (filteredNext.length > 0) {
        setSelectedRecordId(filteredNext[0].id);
      } else {
        setSelectedRecordId(null);
      }

      return nextRecords;
    });
  };

  const handleGenerateTodayRecords = () => {
    const todayRecords = generateTodayRecords();
    setRecords(todayRecords);
  };

  const handleBulkCreateMissing = () => {
    const today = new Date().toISOString().split('T')[0];
    const existingPersonIds = records
      .filter(record => record.date === today)
      .map(record => record.personId);

    const missingUsers = mockUsers.filter((_, index) => {
      const userId = String(index + 1).padStart(3, '0');
      return !existingPersonIds.includes(userId);
    });

    const newRecords = missingUsers.map((name, index) => {
      const globalIndex = mockUsers.indexOf(name);
      const userId = String(globalIndex + 1).padStart(3, '0');

      return {
        id: Date.now() + index, // 簡易的なID生成
        personId: userId,
        personName: name,
        date: today,
        status: '未作成' as const,
        reporter: { name: '' },
        draft: { isDraft: true },
        kind: 'A' as const,
        data: {
          amActivities: [],
          pmActivities: [],
          amNotes: '',
          pmNotes: '',
          mealAmount: '完食' as const,
          problemBehavior: {
            selfHarm: false,
            violence: false,
            loudVoice: false,
            pica: false,
            other: false,
            otherDetail: ''
          },
          seizureRecord: {
            occurred: false,
            time: '',
            duration: '',
            severity: undefined,
            notes: ''
          },
          specialNotes: ''
        }
      };
    });

    setRecords(prev => [...prev, ...newRecords]);
  };

  const handleBulkComplete = () => {
    const today = new Date().toISOString().split('T')[0];
    setRecords(prev => prev.map(record => {
      if (record.date === today && record.status === '未作成') {
        return {
          ...record,
          status: '完了' as const,
          draft: { isDraft: false }
        };
      }
      return record;
    }));
  };

  const applyFilters = useCallback(
    (source: PersonDaily[]) =>
      source.filter((record) => {
        const matchesSearch =
          !searchQuery ||
          record.personName.includes(searchQuery) ||
          record.personId.includes(searchQuery);

        const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
        const matchesDate = !dateFilter || record.date === dateFilter;

        return matchesSearch && matchesStatus && matchesDate;
      }),
    [searchQuery, statusFilter, dateFilter]
  );

  const orderRecords = useCallback(
    (list: PersonDaily[]) =>
      [...list].sort((a, b) => {
        const statusDiff = statusPriority[a.status] - statusPriority[b.status];
        if (statusDiff !== 0) return statusDiff;
        const nameDiff = a.personName.localeCompare(b.personName, 'ja');
        if (nameDiff !== 0) return nameDiff;
        return a.personId.localeCompare(b.personId, 'ja');
      }),
    []
  );

  const filteredRecords = useMemo(() => applyFilters(records), [applyFilters, records]);
  const sortedRecords = useMemo(() => orderRecords(filteredRecords), [orderRecords, filteredRecords]);
  const selectedRecord = useMemo(
    () => (selectedRecordId != null ? sortedRecords.find((record) => record.id === selectedRecordId) ?? null : sortedRecords[0] ?? null),
    [selectedRecordId, sortedRecords]
  );

  useEffect(() => {
    if (sortedRecords.length === 0) {
      if (selectedRecordId !== null) {
        setSelectedRecordId(null);
      }
      return;
    }
    const exists = selectedRecordId != null && sortedRecords.some((record) => record.id === selectedRecordId);
    if (!exists) {
      setSelectedRecordId(sortedRecords[0].id);
    }
  }, [selectedRecordId, sortedRecords]);

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 3 }}>
        {/* ヘッダー */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            活動日誌
          </Typography>
          <Typography variant="body1" color="text.secondary">
            利用者全員の日々の活動状況、問題行動、発作記録を管理します
          </Typography>
        </Box>

        {/* 統計情報（本日分） */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
          <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }}>
            <Typography variant="h6" color="primary">
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <span>
                  {(() => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const todayRecords = records.filter(r => r.date === todayStr);
                    return todayRecords.length;
                  })()} / {todayAttendanceInfo.expectedCount}
                </span>
                <Chip
                  size="small"
                  label={`${todayAttendanceInfo.attendanceRate}%`}
                  color={
                    todayAttendanceInfo.attendanceRate >= 90
                      ? "success"
                      : todayAttendanceInfo.attendanceRate >= 70
                        ? "warning"
                        : "error"
                  }
                  sx={{ fontSize: '0.7rem' }}
                />
              </Box>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              本日記録数（予定通所者）
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }}>
            <Typography variant="h6" color="success.main">
              {(() => {
                const today = new Date().toISOString().split('T')[0];
                return records.filter(r => r.date === today && r.status === '完了').length;
              })()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              完了
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }}>
            <Typography variant="h6" color="warning.main">
              {(() => {
                const today = new Date().toISOString().split('T')[0];
                return records.filter(r => r.date === today && r.status === '作成中').length;
              })()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              作成中
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }}>
            <Typography variant="h6" color="text.secondary">
              {(() => {
                const today = new Date().toISOString().split('T')[0];
                return records.filter(r => r.date === today && r.status === '未作成').length;
              })()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              未作成
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }}>
            <Typography variant="h6" color="info.main">
              {todayAttendanceInfo.absentUserIds?.length || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              欠席予定者
            </Typography>
          </Paper>
        </Stack>

        {/* フィルター */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              フィルター
            </Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                size="small"
                placeholder="利用者名またはIDで検索"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
                sx={{ minWidth: 200 }}
              />

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>ステータス</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | DailyStatus)}
                  label="ステータス"
                >
                  <MenuItem value="all">すべて</MenuItem>
                  <MenuItem value="完了">完了</MenuItem>
                  <MenuItem value="作成中">作成中</MenuItem>
                  <MenuItem value="未作成">未作成</MenuItem>
                </Select>
              </FormControl>

              <TextField
                size="small"
                type="date"
                label="日付"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 150 }}
              />

              <Button
                variant="outlined"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setDateFilter('');
                }}
              >
                クリア
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {/* 一括操作ボタン */}
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              一括操作
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap">
              <Button
                variant="contained"
                onClick={handleGenerateTodayRecords}
                color="primary"
              >
                本日分全員作成（32名）
              </Button>
              <Button
                variant="outlined"
                onClick={handleBulkCreateMissing}
                color="secondary"
              >
                未作成分追加
              </Button>
              <Button
                variant="outlined"
                onClick={handleBulkComplete}
                color="success"
              >
                本日分一括完了
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems="stretch"
          sx={{ mt: 3 }}
        >
          <Paper
            elevation={0}
            sx={{
              width: { xs: '100%', md: 300 },
              maxHeight: 520,
              overflowY: 'auto',
              border: '1px solid',
              borderColor: 'divider',
              flexShrink: 0,
            }}
          >
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                利用者一覧
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ステータス順に並び替えています
              </Typography>
            </Box>
            {sortedRecords.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
                <Typography variant="body2">条件に合致する利用者がいません</Typography>
              </Box>
            ) : (
              <List disablePadding>
                {sortedRecords.map((record) => {
                  const selected = selectedRecord?.id === record.id;
                  return (
                    <ListItemButton
                      key={record.id}
                      selected={selected}
                      onClick={() => setSelectedRecordId(record.id)}
                      alignItems="flex-start"
                      sx={{
                        py: 1.5,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar
                          sx={{
                            bgcolor:
                              record.status === '完了'
                                ? 'success.light'
                                : record.status === '作成中'
                                  ? 'warning.light'
                                  : 'grey.400',
                            color:
                              record.status === '未作成'
                                ? 'grey.900'
                                : record.status === '作成中'
                                  ? 'warning.contrastText'
                                  : 'white',
                          }}
                        >
                          <PersonIcon fontSize="small" />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={record.personName}
                        secondary={`ID: ${record.personId}`}
                        primaryTypographyProps={{
                          fontWeight: selected ? 'bold' : undefined,
                        }}
                        secondaryTypographyProps={{
                          color: 'text.secondary',
                        }}
                      />
                      <Chip
                        icon={statusIconMap[record.status]}
                        label={record.status}
                        color={statusChipPalette[record.status]}
                        size="small"
                        sx={{ ml: 1 }}
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            )}
          </Paper>

          <Card sx={{ flex: 1, minHeight: { xs: 320, md: 520 } }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <DailyRecordForm
                record={selectedRecord}
                onSave={handleSaveRecord}
              />
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </Container>
  );
}
