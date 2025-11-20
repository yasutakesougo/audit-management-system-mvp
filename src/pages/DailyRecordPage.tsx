import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Fab from '@mui/material/Fab';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useMemo, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PersonDaily } from '../domain/daily/types';
import { DailyRecordForm } from '../features/daily/DailyRecordForm';
import { DailyRecordList } from '../features/daily/DailyRecordList';
import { useUsersDemo } from '../features/users/usersStoreDemo';
import { saveDailyRecord, validateDailyRecord } from '../lib/dailyRecordLogic';
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

export default function DailyRecordPage() {
  // Navigation hook for cross-module navigation
  const navigate = useNavigate();

  // URL query parameters for highlighting
  const [searchParams] = useSearchParams();
  const highlightUserId = searchParams.get('userId');
  const highlightDate = searchParams.get('date');

  // 利用者マスタとスケジュールデータ
  const { data: usersData } = useUsersDemo();
  const { data: schedulesData } = useSchedules();

  const [records, setRecords] = useState<PersonDaily[]>(mockRecords);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PersonDaily | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  // Effect to scroll to highlighted record when query params are present
  useEffect(() => {
    if (highlightUserId && highlightDate) {
      // Scroll to highlighted record after a short delay to ensure rendering
      const timer = setTimeout(() => {
        const element = document.querySelector(`[data-testid*="${highlightUserId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [highlightUserId, highlightDate]);

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


  const handleOpenForm = () => {
    setEditingRecord(undefined);
    setFormOpen(true);
  };

  const handleEditRecord = (record: PersonDaily) => {
    setEditingRecord(record);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingRecord(undefined);
  };

  const handleOpenAttendance = (record: PersonDaily) => {
    navigate(`/daily/attendance?userId=${record.personId}&date=${record.date}`);
  };

  const handleSaveRecord = (record: Omit<PersonDaily, 'id'>) => {
    try {
      // バリデーション実行
      const validationResult = validateDailyRecord(record);

      if (!validationResult.isValid) {
        // バリデーションエラーがある場合
        const errorMessage = validationResult.errors.join('\n');
        toast.error(`保存に失敗しました\n\n${errorMessage}`, {
          duration: 6000,
          style: {
            maxWidth: '500px'
          }
        });
        console.error('保存失敗 - バリデーションエラー:', validationResult.errors);
        return;
      }

      // 保存処理実行
      const updatedRecords = saveDailyRecord(
        records,
        record,
        editingRecord?.id
      );

      setRecords(updatedRecords);

      // フォームを閉じる
      handleCloseForm();

      // 成功通知
      const operation = editingRecord ? '更新' : '新規作成';
      toast.success(`日次記録の${operation}が完了しました\n\n利用者: ${record.personName}\n日付: ${record.date}`, {
        duration: 4000,
        style: {
          maxWidth: '400px'
        }
      });

      // 成功ログ
      console.log('保存成功:', {
        operation,
        personName: record.personName,
        date: record.date,
        status: record.status
      });

    } catch (error) {
      // 予期しないエラーをキャッチ
      const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
      toast.error(`システムエラーが発生しました\n\n${errorMessage}`, {
        duration: 8000,
        style: {
          maxWidth: '500px'
        }
      });
      console.error('保存失敗 - システムエラー:', error);
    }
  };

  const handleDeleteRecord = (recordId: number) => {
    const recordToDelete = records.find(r => r.id === recordId);

    setRecords(prev => prev.filter(record => record.id !== recordId));

    if (recordToDelete) {
      toast.success(`${recordToDelete.personName}さんの記録を削除しました`, {
        duration: 3000
      });
    } else {
      toast.error('削除対象の記録が見つかりませんでした', {
        duration: 3000
      });
    }
  };

  const handleGenerateTodayRecords = () => {
    const todayRecords = generateTodayRecords();
    setRecords(todayRecords);
    toast.success(`本日分の記録を32名分作成しました`, {
      duration: 3000
    });
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

    if (missingUsers.length === 0) {
      toast('本日分の記録は全員作成済みです', {
        icon: 'ℹ️',
        duration: 2000
      });
      return;
    }

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
    toast.success(`${missingUsers.length}名分の未作成記録を追加しました`, {
      duration: 3000
    });
  };

  const handleBulkComplete = () => {
    const today = new Date().toISOString().split('T')[0];
    let completedCount = 0;

    setRecords(prev => prev.map(record => {
      if (record.date === today && record.status === '未作成') {
        completedCount++;
        return {
          ...record,
          status: '完了' as const,
          draft: { isDraft: false }
        };
      }
      return record;
    }));

    if (completedCount === 0) {
      toast('本日分の記録で一括完了対象はありませんでした', {
        icon: 'ℹ️',
        duration: 2000
      });
    } else {
      toast.success(`${completedCount}件の記録を一括完了しました`, {
        duration: 3000
      });
    }
  };

  // フィルタリング
  const filteredRecords = records.filter(record => {
    const matchesSearch = !searchQuery ||
      record.personName.includes(searchQuery) ||
      record.personId.includes(searchQuery);

    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
    const matchesDate = !dateFilter || record.date === dateFilter;

    return matchesSearch && matchesStatus && matchesDate;
  });

  return (
    <Container maxWidth="lg" data-testid="records-daily-root">
      <Box sx={{ py: 3 }}>
        {/* ヘッダー */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            支援記録（ケース記録）
          </Typography>
          <Typography variant="body1" color="text.secondary">
            利用者全員の日々の活動状況、問題行動、発作記録を管理します
          </Typography>
        </Box>

        {/* 統計情報（本日分） */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }} data-testid="daily-stats-panel">
          <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }} data-testid="total-records-stat">
            <Typography variant="h6" color="primary">
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <span data-testid="total-records-count">
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
                  data-testid="attendance-rate-chip"
                />
              </Box>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              本日記録数（予定通所者）
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }} data-testid="completed-records-stat">
            <Typography variant="h6" color="success.main" data-testid="completed-count">
              {(() => {
                const today = new Date().toISOString().split('T')[0];
                return records.filter(r => r.date === today && r.status === '完了').length;
              })()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              完了
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }} data-testid="in-progress-records-stat">
            <Typography variant="h6" color="warning.main" data-testid="in-progress-count">
              {(() => {
                const today = new Date().toISOString().split('T')[0];
                return records.filter(r => r.date === today && r.status === '作成中').length;
              })()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              作成中
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }} data-testid="not-started-records-stat">
            <Typography variant="h6" color="text.secondary" data-testid="not-started-count">
              {(() => {
                const today = new Date().toISOString().split('T')[0];
                return records.filter(r => r.date === today && r.status === '未作成').length;
              })()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              未作成
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }} data-testid="absent-records-stat">
            <Typography variant="h6" color="info.main" data-testid="absent-count">
              {todayAttendanceInfo.absentUserIds?.length || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              欠席予定者
            </Typography>
          </Paper>
        </Stack>

        {/* フィルター */}
        <Card sx={{ mb: 3 }} data-testid="filter-panel">
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
                data-testid="search-input"
              />

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>ステータス</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label="ステータス"
                  data-testid="status-filter-select"
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
                data-testid="date-filter-input"
              />

              <Button
                variant="outlined"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setDateFilter('');
                }}
                data-testid="clear-filters-button"
              >
                クリア
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {/* 一括操作ボタン */}
        <Card sx={{ mb: 2 }} data-testid="bulk-operations-card">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              一括操作
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap">
              <Button
                variant="contained"
                onClick={handleGenerateTodayRecords}
                color="primary"
                data-testid="bulk-generate-today-records-button"
              >
                本日分全員作成（32名）
              </Button>
              <Button
                variant="outlined"
                onClick={handleBulkCreateMissing}
                color="secondary"
                data-testid="bulk-create-missing-button"
              >
                未作成分追加
              </Button>
              <Button
                variant="outlined"
                onClick={handleBulkComplete}
                color="success"
                data-testid="bulk-complete-button"
              >
                本日分一括完了
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {/* 記録リスト */}
        <DailyRecordList
          records={filteredRecords}
          onEdit={handleEditRecord}
          onDelete={handleDeleteRecord}
          onOpenAttendance={handleOpenAttendance}
          highlightUserId={highlightUserId}
          highlightDate={highlightDate}
          data-testid="daily-record-list"
        />

        {/* フォームダイアログ */}
        <DailyRecordForm
          open={formOpen}
          onClose={handleCloseForm}
          record={editingRecord}
          onSave={handleSaveRecord}
          data-testid="daily-record-form"
        />

        {/* 新規作成FAB */}
        <Fab
          color="primary"
          aria-label="add"
          onClick={handleOpenForm}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
          }}
          data-testid="add-record-fab"
        >
          <AddIcon />
        </Fab>

        {/* Toast通知 */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              iconTheme: {
                primary: '#4aed88',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ff6b6b',
                secondary: '#fff',
              },
            },
          }}
        />
      </Box>
    </Container>
  );
}