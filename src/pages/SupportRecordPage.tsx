import AddIcon from '@mui/icons-material/Add';
import AssignmentIcon from '@mui/icons-material/Assignment';
import SearchIcon from '@mui/icons-material/Search';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
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
import React, { useCallback, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

// 支援手順記録の型定義
// TODO: 将来的にsrc/types/support.tsなどの共通モジュールに移動予定
interface SupportStep {
  id: string;
  stepNumber: number;
  category: '朝の準備' | '健康確認' | '活動準備' | 'AM活動' | '昼食準備' | '昼食' | '休憩' | 'PM活動' | '終了準備' | '振り返り' | 'その他';
  title: string;
  description: string;
  targetBehavior: string;
  supportMethod: string;
  duration: number;
  importance: '必須' | '推奨' | '任意';
}

interface SupportRecord {
  id: number;
  supportPlanId: string;
  personId: string;
  personName: string;
  date: string;
  stepId: string;
  stepNumber: number;
  implemented: boolean;
  implementedAt?: string;
  userResponse: {
    mood?: '良好' | '普通' | '不安定';
    participation?: '積極的' | '普通' | '消極的';
    understanding?: '理解良好' | '部分理解';
    notes: string;
  };
  supportEvaluation: {
    effectiveness?: '効果的' | '部分的効果';
    nextAction?: '継続' | '方法変更';
  };
  reporter: {
    name: string;
    role?: string;
  };
  status: '未実施' | '実施済み';
  createdAt: string;
  updatedAt: string;
}

interface DailySupportRecord {
  id: number;
  supportPlanId: string;
  personId: string;
  personName: string;
  date: string;
  records: SupportRecord[];
  summary: {
    totalSteps: number;
    implementedSteps: number;
    effectiveSteps: number;
    improvementNeeded: number;
    overallProgress: '良好' | '順調' | '要注意';
  };
  completedBy: string;
  status: '未作成' | '作成中' | '完了';
}

// デフォルト支援手順テンプレート
// TODO: 将来的にsrc/constants/supportSteps.tsなどに移動予定
const defaultSupportSteps: Omit<SupportStep, 'id'>[] = [
  { stepNumber: 1, category: '朝の準備', title: '朝の挨拶', description: '明るく挨拶をして一日を始める', targetBehavior: '自発的に挨拶する', supportMethod: '職員から先に挨拶し、応答を促す', duration: 5, importance: '必須' },
  { stepNumber: 2, category: '朝の準備', title: '持ち物確認', description: '必要な持ち物を確認する', targetBehavior: '自分で持ち物をチェックする', supportMethod: 'チェックリストを使って一緒に確認', duration: 10, importance: '必須' },
  { stepNumber: 3, category: '健康確認', title: '体調確認', description: '体調や気分を確認する', targetBehavior: '体調について答える', supportMethod: '具体的に質問し、様子を観察', duration: 5, importance: '必須' },
  { stepNumber: 4, category: '活動準備', title: '活動説明', description: '今日の活動予定を説明', targetBehavior: '活動内容を理解する', supportMethod: 'スケジュール表を見せながら説明', duration: 10, importance: '推奨' },
  { stepNumber: 5, category: 'AM活動', title: '作業開始', description: '午前の作業活動を開始', targetBehavior: '指示に従って作業を始める', supportMethod: '手順を示し、必要に応じて補助', duration: 90, importance: '必須' },
  { stepNumber: 6, category: 'AM活動', title: '休憩', description: '適切なタイミングで休憩', targetBehavior: '疲労を感じたら休憩を要求', supportMethod: '様子を見て休憩を促す', duration: 15, importance: '推奨' },
  { stepNumber: 7, category: '昼食準備', title: '手洗い', description: '食事前の手洗い', targetBehavior: '自発的に手洗いをする', supportMethod: '手洗い場に案内し、手順を示す', duration: 5, importance: '必須' },
  { stepNumber: 8, category: '昼食', title: '食事', description: '昼食を摂る', targetBehavior: 'マナーを守って食事する', supportMethod: '必要に応じて食事介助', duration: 45, importance: '必須' },
  { stepNumber: 9, category: '昼食', title: '片付け', description: '食後の片付け', targetBehavior: '自分の食器を片付ける', supportMethod: '片付ける場所を示し、一緒に行う', duration: 10, importance: '推奨' },
  { stepNumber: 10, category: '休憩', title: '昼休み', description: '昼食後の休憩時間', targetBehavior: '適切な休憩を取る', supportMethod: 'リラックスできる環境を提供', duration: 30, importance: '任意' },
  { stepNumber: 11, category: 'PM活動', title: '午後作業', description: '午後の活動開始', targetBehavior: '午後の作業に取り組む', supportMethod: '集中できるよう環境を整える', duration: 90, importance: '必須' },
  { stepNumber: 12, category: 'PM活動', title: 'レクリエーション', description: '楽しい活動時間', targetBehavior: '他者と協力して活動する', supportMethod: '参加しやすい雰囲気作り', duration: 30, importance: '推奨' },
  { stepNumber: 13, category: '終了準備', title: '作業終了', description: '作業を終了し片付け', targetBehavior: '使った道具を片付ける', supportMethod: '片付け方を指導', duration: 15, importance: '必須' },
  { stepNumber: 14, category: '終了準備', title: '清掃活動', description: '使用した場所の清掃', targetBehavior: '自分の作業場所を清掃', supportMethod: '清掃方法を示し、一緒に実施', duration: 15, importance: '推奨' },
  { stepNumber: 15, category: '振り返り', title: '一日の振り返り', description: '今日の活動を振り返る', targetBehavior: '感想や気づきを話す', supportMethod: '質問しながら振り返りを促す', duration: 10, importance: '推奨' },
  { stepNumber: 16, category: '振り返り', title: '明日の確認', description: '明日の予定確認', targetBehavior: '明日の活動を理解', supportMethod: 'スケジュール表で明日の予定説明', duration: 5, importance: '任意' },
  { stepNumber: 17, category: '終了準備', title: '帰りの準備', description: '帰宅準備を行う', targetBehavior: '忘れ物なく準備する', supportMethod: 'チェックリストで確認', duration: 10, importance: '必須' },
  { stepNumber: 18, category: 'その他', title: '連絡帳記入', description: '保護者への連絡事項記入', targetBehavior: '今日の様子を伝える', supportMethod: '本人と一緒に記入', duration: 10, importance: '推奨' },
  { stepNumber: 19, category: 'その他', title: '帰りの挨拶', description: 'お疲れ様の挨拶', targetBehavior: '感謝の気持ちを表現', supportMethod: '職員から挨拶し、応答を促す', duration: 5, importance: '必須' }
];

// モックデータ（支援対象者）
const mockSupportUsers = [
  { id: '001', name: '田中太郎', planType: '日常生活', isActive: true },
  { id: '005', name: '佐藤花子', planType: '作業活動', isActive: true },
  { id: '012', name: '山田一郎', planType: 'コミュニケーション', isActive: true },
  { id: '018', name: '鈴木美子', planType: '健康管理', isActive: true },
  { id: '023', name: '高橋次郎', planType: '社会生活', isActive: true },
  { id: '027', name: '渡辺恵子', planType: '日常生活', isActive: false }, // 一時中止
  { id: '030', name: '中村勇気', planType: '作業活動', isActive: true },
  { id: '032', name: '小林さくら', planType: 'コミュニケーション', isActive: true }
];

// ユーティリティ関数
// TODO: 将来的にsrc/utils/supportRecord.tsなどに移動予定

// デフォルト支援手順の生成
const generateSupportSteps = (personId: string): SupportStep[] => {
  return defaultSupportSteps.map((step, index) => ({
    ...step,
    id: `${personId}-step-${String(index + 1).padStart(2, '0')}`
  }));
};

// 空の記録生成（決定論的IDを使用）
const generateEmptyRecord = (personId: string, personName: string, date: string, step: SupportStep): SupportRecord => ({
  id: parseInt(`${personId.replace(/\D/g, '')}${step.stepNumber.toString().padStart(2, '0')}${date.replace(/-/g, '')}`),
  supportPlanId: `plan-${personId}`,
  personId,
  personName,
  date,
  stepId: step.id,
  stepNumber: step.stepNumber,
  implemented: false,
  userResponse: {
    notes: ''
  },
  supportEvaluation: {},
  reporter: {
    name: ''
  },
  status: '未実施',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

// モック日次記録生成（決定論的データを使用）
const generateMockDailyRecord = (user: typeof mockSupportUsers[0], date: string): DailySupportRecord => {
  const steps = generateSupportSteps(user.id);
  const records = steps.map(step => generateEmptyRecord(user.id, user.name, date, step));

  // 決定論的な実施済みインデックス（ユーザーIDベース）
  const userIdNum = parseInt(user.id.replace(/\D/g, '')) || 1;
  const baseImplemented = [0, 1, 3, 4, 5, 7, 9, 10, 11, 12, 14, 16];
  const implementedIndices = baseImplemented.slice(0, Math.min(baseImplemented.length, 8 + (userIdNum % 8)));

  implementedIndices.forEach(index => {
    if (records[index]) {
      records[index].implemented = true;
      records[index].status = '実施済み';
      records[index].implementedAt = `${9 + Math.floor(index / 2)}:${(index % 2) * 30}`.padEnd(5, '0');

      // 決定論的なレスポンス生成
      const responseIndex = (userIdNum + index) % 3;
      records[index].userResponse = {
        mood: ['良好', '普通', '不安定'][responseIndex] as SupportRecord['userResponse']['mood'],
        participation: ['積極的', '普通', '消極的'][responseIndex] as SupportRecord['userResponse']['participation'],
        understanding: ['理解良好', '部分理解'][(userIdNum + index) % 2] as SupportRecord['userResponse']['understanding'],
        notes: `Step ${index + 1}の実施記録です。本人は${['協力的', '普通', '少し困惑気味'][responseIndex]}でした。`
      };
      records[index].supportEvaluation = {
        effectiveness: ['効果的', '部分的効果'][(userIdNum + index) % 2] as SupportRecord['supportEvaluation']['effectiveness'],
        nextAction: ['継続', '方法変更'][(userIdNum + index) % 2] as SupportRecord['supportEvaluation']['nextAction']
      };
      records[index].reporter = {
        name: '支援員A',
        role: '生活支援員'
      };
    }
  });

  return {
    id: parseInt(`${userIdNum}${date.replace(/-/g, '')}`),
    supportPlanId: `plan-${user.id}`,
    personId: user.id,
    personName: user.name,
    date,
    records,
    summary: {
      totalSteps: 19,
      implementedSteps: implementedIndices.length,
      effectiveSteps: implementedIndices.length - Math.min(2, implementedIndices.length),
      improvementNeeded: Math.min(2, implementedIndices.length),
      overallProgress: implementedIndices.length >= 15 ? '良好' : implementedIndices.length >= 10 ? '順調' : '要注意'
    },
    completedBy: '支援員A',
    status: implementedIndices.length >= 15 ? '完了' : implementedIndices.length >= 5 ? '作成中' : '未作成'
  };
};

const SupportRecordPage: React.FC = () => {
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');

  // 安定したデータ管理のためのstate
  const [dailyRecordCache, setDailyRecordCache] = useState<Map<string, DailySupportRecord>>(new Map());

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

    if (dailyRecordCache.has(cacheKey)) {
      return dailyRecordCache.get(cacheKey)!;
    }

    const user = mockSupportUsers.find(u => u.id === userId);
    if (!user) return null;

    const newRecord = generateMockDailyRecord(user, date);
    setDailyRecordCache(prev => new Map(prev).set(cacheKey, newRecord));

    return newRecord;
  }, [dailyRecordCache]);

  // 選択された利用者の日次記録
  const currentDailyRecord = useMemo(() => {
    if (!selectedUser) return null;
    return getDailyRecord(selectedUser, dateFilter);
  }, [selectedUser, dateFilter, getDailyRecord]);

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
    console.log('本日分の記録を一括生成');
    // 実際の生成処理をここに実装
    // 生成後にキャッシュをクリアして最新データを表示
    setDailyRecordCache(new Map());
  }, []);

  // 記録更新機能（将来の拡張用）
  const _handleUpdateRecord = useCallback((record: SupportRecord) => {
    console.log('記録更新:', record);
    // 実際の更新処理をここに実装
    // 更新後にキャッシュの該当項目を更新
    const cacheKey = `${record.personId}-${record.date}`;
    if (dailyRecordCache.has(cacheKey)) {
      const currentRecord = dailyRecordCache.get(cacheKey)!;
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
      setDailyRecordCache(prev => new Map(prev).set(cacheKey, updatedDailyRecord));
    }
  }, [dailyRecordCache]);

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 3 }}>
        <Alert severity="info" data-testid="support-record-legacy-banner" sx={{ mb: 3 }}>
          <AlertTitle>旧支援記録画面（LEGACY）</AlertTitle>
          現在は新しい日次支援記録画面（タイムライン/テーブル）を主に利用しています。
          この画面は<b>過去データの参照・検証用</b>として残しています。
          <Box mt={1}>
            <Button
              variant="outlined"
              size="small"
              component={RouterLink}
              to="/daily/activity"
              data-testid="support-record-legacy-back"
            >
              新しい支援記録画面へ戻る
            </Button>
          </Box>
        </Alert>

        {/* ヘッダー */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            支援手順記録
          </Typography>
          <Typography variant="body1" color="text.secondary">
            個別支援計画に基づく19項目の支援手順実施状況を記録・管理します
          </Typography>
        </Box>

        {/* 統計情報（本日分） */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
          <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }}>
            <Typography variant="h6" color="primary">
              {todayStats.total}名
            </Typography>
            <Typography variant="body2" color="text.secondary">
              支援対象者
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }}>
            <Typography variant="h6" color="success.main">
              {todayStats.completed}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              記録完了
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }}>
            <Typography variant="h6" color="warning.main">
              {todayStats.inProgress}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              記録作成中
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }}>
            <Typography variant="h6" color="error.main">
              {todayStats.notStarted}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              記録未着手
            </Typography>
          </Paper>
        </Stack>

        {/* フィルター・検索 */}
        <Card sx={{ mb: 3 }}>
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
              title={`支援記録 (${currentDailyRecord.date})`}
              subheader={`実施: ${currentDailyRecord.summary.implementedSteps} / ${currentDailyRecord.summary.totalSteps} 項目`}
            />
            <CardContent>
              <Box sx={{ mb: 3 }}>
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
                gap: 2
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
                        <Box sx={{ mt: 2 }}>
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
          <Box sx={{ textAlign: 'center', py: 6 }}>
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
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <TrendingUpIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                本日の記録状況
              </Typography>

              {filteredUsers.length === 0 ? (
                <Alert severity="info">
                  支援対象者が見つかりません。検索条件を確認してください。
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
                          p: 2,
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
                            <Typography variant="subtitle1">
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
        <Fab
          color="secondary"
          aria-label="新規記録作成"
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
          onClick={handleGenerateTodayRecords}
        >
          <AddIcon />
        </Fab>
      </Box>
    </Container>
  );
};

export default SupportRecordPage;