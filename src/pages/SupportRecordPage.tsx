import { PageHeader } from '@/components/PageHeader';
import type { DailySupportRecord, SupportRecord } from '@/types/support';
import { toLocalDateISO } from '@/utils/getNow';
import { generateMockDailyRecord, generateSupportSteps, type MockSupportUser } from '@/utils/supportRecord';
import AddIcon from '@mui/icons-material/Add';
import AssignmentIcon from '@mui/icons-material/Assignment';
import SearchIcon from '@mui/icons-material/Search';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { useCallback, useMemo, useReducer, useRef, useState } from 'react';
import { LandscapeFab } from '../components/ui/LandscapeFab';

// モックデータ（支援対象者）
const mockSupportUsers: MockSupportUser[] = [
  { id: '001', name: '田中太郎', planType: '日常生活', isActive: true },
  { id: '005', name: '佐藤花子', planType: '作業活動', isActive: true },
  { id: '012', name: '山田一郎', planType: 'コミュニケーション', isActive: true },
  { id: '018', name: '鈴木美子', planType: '健康管理', isActive: true },
  { id: '023', name: '高橋次郎', planType: '社会生活', isActive: true },
  { id: '027', name: '渡辺恵子', planType: '日常生活', isActive: false }, // 一時中止
  { id: '030', name: '中村勇気', planType: '作業活動', isActive: true },
  { id: '032', name: '小林さくら', planType: 'コミュニケーション', isActive: true }
];

const SupportRecordPage: React.FC = () => {
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [dateFilter, setDateFilter] = useState(toLocalDateISO());
  const [searchQuery, setSearchQuery] = useState('');

  // 安定したデータ管理のためのref（レンダリング入力にしない）
  const dailyRecordCacheRef = useRef<Map<string, DailySupportRecord>>(new Map());
  const [refreshTick, forceRefresh] = useReducer((value: number) => value + 1, 0);

  // フィルタリングされた利用者
  const filteredUsers = useMemo(() => mockSupportUsers.filter(user => {
    const matchesSearch = !searchQuery ||
      user.name.includes(searchQuery) ||
      user.id.includes(searchQuery);
    return matchesSearch && user.isActive;
  }), [searchQuery]);

  // 安定したデータ取得
  const getDailyRecord = useCallback((userId: string, date: string): DailySupportRecord | null => {
    const cacheKey = `${userId}-${date}`;

    if (dailyRecordCacheRef.current.has(cacheKey)) {
      return dailyRecordCacheRef.current.get(cacheKey)!;
    }

    const user = mockSupportUsers.find(u => u.id === userId);
    if (!user) return null;

    const newRecord = generateMockDailyRecord(user, date);
    dailyRecordCacheRef.current.set(cacheKey, newRecord);

    return newRecord;
  }, []);

  // 選択された利用者の日々の記録
  const currentDailyRecord = useMemo(() => {
    if (!selectedUser) return null;
    return getDailyRecord(selectedUser, dateFilter);
  }, [selectedUser, dateFilter, getDailyRecord, refreshTick]);

  // 支援手順（選択された利用者用）
  const supportSteps = useMemo(() => {
    if (!selectedUser) return [];
    return generateSupportSteps(selectedUser);
  }, [selectedUser]);

  // 統計情報
  const todayStats = useMemo(() => {
    const activeUsers = filteredUsers;
    const completedCount = Math.floor(activeUsers.length * 0.6); // 60%完了と仮定
    const inProgressCount = Math.floor(activeUsers.length * 0.3); // 30%作成中
    const notStartedCount = activeUsers.length - completedCount - inProgressCount;

    return {
      total: activeUsers.length,
      completed: completedCount,
      inProgress: inProgressCount,
      notStarted: notStartedCount
    };
  }, [filteredUsers]);

  // 記録生成・更新機能（将来の拡張用）
  const handleGenerateTodayRecords = useCallback(() => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('本日分の記録を一括生成');
    }
    // 実際の生成処理をここに実装
    // 生成後にキャッシュをクリアして最新データを表示
    dailyRecordCacheRef.current = new Map();
    forceRefresh();
  }, []);

  // 記録更新機能（将来の拡張用）
  const _handleUpdateRecord = useCallback((record: SupportRecord) => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('記録更新:', record);
    }
    // 実際の更新処理をここに実装
    // 更新後にキャッシュの該当項目を更新
    const cacheKey = `${record.userId}-${record.date}`;
    if (dailyRecordCacheRef.current.has(cacheKey)) {
      const currentRecord = dailyRecordCacheRef.current.get(cacheKey)!;
      const updatedRecords = currentRecord.records.map(r =>
        r.id === record.id ? { ...record, updatedAt: new Date().toISOString() } : r
      );
      const updatedDailyRecord = {
        ...currentRecord,
        records: updatedRecords,
        // サマリーも再計算
        summary: {
          ...currentRecord.summary,
          implementedSteps: updatedRecords.filter(r => r.implemented).length
        }
      };
      dailyRecordCacheRef.current.set(cacheKey, updatedDailyRecord);
      forceRefresh();
    }
  }, []);

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: { xs: 2, sm: 3, md: 4 } }}>
        {/* ヘッダー */}
        <PageHeader
          title="支援手順の実施（行動観察）"
          subtitle="個別支援計画に基づく19項目の支援手順の実施状況を記録・管理します"
        />

        {/* 統計情報（本日分） */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: { xs: 2, sm: 3 } }}>
          <Paper sx={{ p: { xs: 2, sm: 2.5 }, textAlign: 'center', flex: 1 }}>
            <Typography variant="h6" color="primary">
              {todayStats.total}名
            </Typography>
            <Typography variant="body2" color="text.secondary">
              支援対象者
            </Typography>
          </Paper>
          <Paper sx={{ p: { xs: 2, sm: 2.5 }, textAlign: 'center', flex: 1 }}>
            <Typography variant="h6" color="success.main">
              {todayStats.completed}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              記録完了
            </Typography>
          </Paper>
          <Paper sx={{ p: { xs: 2, sm: 2.5 }, textAlign: 'center', flex: 1 }}>
            <Typography variant="h6" color="warning.main">
              {todayStats.inProgress}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              記録作成中
            </Typography>
          </Paper>
          <Paper sx={{ p: { xs: 2, sm: 2.5 }, textAlign: 'center', flex: 1 }}>
            <Typography variant="h6" color="error.main">
              {todayStats.notStarted}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              記録未着手
            </Typography>
          </Paper>
        </Stack>

        {/* フィルター・検索 */}
        <Card sx={{ mb: { xs: 2, sm: 3 } }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              記録対象の選択
            </Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="利用者検索"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="利用者名またはIDで検索"
                size="small"
                sx={{ flex: 1 }}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />

              <TextField
                type="date"
                label="記録日"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                size="small"
                sx={{ minWidth: '150px' }}
              />

              <FormControl size="small" sx={{ minWidth: '200px' }}>
                <InputLabel>利用者選択</InputLabel>
                <Select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  label="利用者選択"
                >
                  <MenuItem value="">選択してください</MenuItem>
                  {filteredUsers.map(user => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.name} ({user.planType})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button
                variant="outlined"
                onClick={handleGenerateTodayRecords}
                startIcon={<AddIcon />}
              >
                本日分生成
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {/* メイン コンテンツ */}
        {selectedUser && currentDailyRecord ? (
          <Card>
            <CardHeader
              title={`支援手順の実施 (${currentDailyRecord.date})`}
              subheader={`実施: ${currentDailyRecord.summary.implementedSteps} / ${currentDailyRecord.summary.totalSteps} 項目`}
            />
            <CardContent>
              <Box sx={{ mb: { xs: 2, sm: 3 } }}>
                <Chip
                  label={`進捗: ${currentDailyRecord.summary.overallProgress}`}
                  color={currentDailyRecord.summary.overallProgress === '良好' ? 'success' :
                         currentDailyRecord.summary.overallProgress === '順調' ? 'info' : 'warning'}
                  variant="outlined"
                />
              </Box>

              <Box sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: { xs: 2, sm: 3 }
              }}>
                {supportSteps.map((step) => {
                  const record = currentDailyRecord.records.find(r => r.stepId === step.id);
                  return (
                    <Card variant="outlined" key={step.id}>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          {step.stepNumber}. {step.title}
                        </Typography>
                        <Chip
                          label={step.category}
                          size="small"
                          sx={{ mb: 1 }}
                        />
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {step.description}
                        </Typography>
                        <Box sx={{ mt: { xs: 1.5, sm: 2 } }}>
                          <Chip
                            label={record?.status || '未実施'}
                            color={record?.status === '実施済み' ? 'success' : 'default'}
                            size="small"
                          />
                        </Box>
                        {record?.userResponse?.notes && (
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            備考: {record.userResponse.notes}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        ) : (
          <Box sx={{ textAlign: 'center', py: { xs: 4, sm: 6, md: 8 } }}>
            <AssignmentIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              利用者を選択してください
            </Typography>
            <Typography variant="body2" color="text.secondary">
              上記のフィルターから記録を確認・編集したい利用者を選択してください
            </Typography>
          </Box>
        )}

        {/* 利用者一覧（サイドバー的表示） */}
        {!selectedUser && (
          <Card sx={{ mt: { xs: 2, sm: 3 } }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <TrendingUpIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                本日の記録状況
              </Typography>

              {filteredUsers.length === 0 ? (
                <Alert severity="info">
                  支援手順の実施対象者が見つかりません。検索条件を確認してください。
                </Alert>
              ) : (
                <Stack spacing={2}>
                  {filteredUsers.map(user => {
                    // 決定論的な進捗データ（ユーザーIDベース）
                    const userIdNum = parseInt(user.id.replace(/\D/g, '')) || 1;
                    const baseProgress = (userIdNum * 17) % 100; // ユーザーIDに基づく基本進捗
                    const dateOffset = new Date(dateFilter).getDate() % 10; // 日付による微調整
                    const progress = Math.min(95, baseProgress + dateOffset);
                    const status = progress >= 80 ? 'completed' : progress >= 40 ? 'inProgress' : 'notStarted';

                    // 決定論的な実装項目数計算
                    const implementedCount = Math.floor((progress / 100) * 19);

                    return (
                      <Box
                        key={user.id}
                        sx={{
                          p: { xs: 2, sm: 2.5 },
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' }
                        }}
                        onClick={() => setSelectedUser(user.id)}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box>
                            <Typography variant="subtitle1" component="span">
                              {user.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {user.planType} - ID: {user.id}
                            </Typography>
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography variant="body2">
                              {implementedCount}/19 項目
                            </Typography>
                            <Chip
                              label={
                                status === 'completed' ? '完了' :
                                status === 'inProgress' ? '作成中' : '未着手'
                              }
                              color={
                                status === 'completed' ? 'success' :
                                status === 'inProgress' ? 'warning' : 'default'
                              }
                              size="small"
                            />
                          </Box>
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </CardContent>
          </Card>
        )}

        {/* フローティングアクションボタン */}
        <LandscapeFab
          icon={<AddIcon />}
          ariaLabel="新規記録作成"
          onClick={handleGenerateTodayRecords}
        />
      </Box>
    </Container>
  );
};

export default SupportRecordPage;
