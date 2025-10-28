import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PersonIcon from '@mui/icons-material/Person';
import SearchIcon from '@mui/icons-material/Search';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { useMemo, useState } from 'react';
// 時間別支援記録の型定義
type TimeSlot =
  | '08:00-09:00' | '09:00-10:00' | '10:00-11:00' | '11:00-12:00' | '12:00-13:00'
  | '13:00-14:00' | '14:00-15:00' | '15:00-16:00' | '16:00-17:00' | '17:00-18:00';

interface SupportRecord {
  id: number;
  supportPlanId: string;
  personId: string;
  personName: string;
  date: string;
  timeSlot?: TimeSlot;
  userActivities: {
    planned: string;
    actual: string;
    notes: string;
  };
  staffActivities: {
    planned: string;
    actual: string;
    notes: string;
  };
  userCondition: {
    mood?: '良好' | '普通' | '不安定';
    behavior: string;
    communication?: string;
    physicalState?: string;
  };
  specialNotes: {
    incidents?: string;
    concerns?: string;
    achievements?: string;
    nextTimeConsiderations?: string;
  };
  reporter: {
    name: string;
    role?: string;
  };
  status: '未記録' | '記録中' | '記録済み';
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
    totalTimeSlots: number;
    recordedTimeSlots: number;
    concerningIncidents: number;
    achievementHighlights: number;
    overallProgress: '良好' | '順調' | '要注意';
  };
  dailyNotes?: string;
  completedBy: string;
  completedAt?: string;
  status: '未作成' | '作成中' | '完了';
}

// 時間別支援記録リストコンポーネント（簡易版）
interface TimeBasedSupportRecordListProps {
  dailyRecord: DailySupportRecord;
  onAddRecord: (record: SupportRecord) => void;
  onUpdateRecord: (record: SupportRecord) => void;
}

const TimeBasedSupportRecordList: React.FC<TimeBasedSupportRecordListProps> = ({
  dailyRecord,
  onAddRecord,
  onUpdateRecord: _onUpdateRecord
}) => {
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot>('09:00-10:00');

  const handleAddNewRecord = () => {
    const newRecord: SupportRecord = {
      id: Date.now() + Math.random(),
      supportPlanId: dailyRecord.supportPlanId,
      personId: dailyRecord.personId,
      personName: dailyRecord.personName,
      date: dailyRecord.date,
      timeSlot: selectedTimeSlot,
      userActivities: { planned: '', actual: '', notes: '' },
      staffActivities: { planned: '', actual: '', notes: '' },
      userCondition: { behavior: '' },
      specialNotes: {},
      reporter: { name: '' },
      status: '記録中',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    onAddRecord(newRecord);
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          時間別記録一覧
        </Typography>

        {/* 新規記録追加 */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>時間帯選択</InputLabel>
              <Select
                value={selectedTimeSlot}
                onChange={(e) => setSelectedTimeSlot(e.target.value as TimeSlot)}
                label="時間帯選択"
              >
                {timeSlots.map(slot => (
                  <MenuItem key={slot} value={slot}>
                    {slot}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ px: 2, py: 1, bgcolor: 'white', borderRadius: 1, cursor: 'pointer' }}
                 onClick={handleAddNewRecord}>
              <Typography variant="body2" color="primary">
                + 記録追加
              </Typography>
            </Box>
          </Stack>
        </Box>

        {/* 記録一覧表示 */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
          gap: 2
        }}>
          {dailyRecord.records.map((record) => (
            <Card key={record.id} variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  {record.timeSlot} - {record.status}
                </Typography>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>本人の活動:</strong>
                  </Typography>
                  <Typography variant="body2">
                    {record.userActivities.actual || '未記録'}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>職員の支援:</strong>
                  </Typography>
                  <Typography variant="body2">
                    {record.staffActivities.actual || '未記録'}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>本人の様子:</strong>
                  </Typography>
                  <Typography variant="body2">
                    {record.userCondition.behavior || '未記録'}
                  </Typography>
                  {record.userCondition.mood && (
                    <Chip
                      label={`気分: ${record.userCondition.mood}`}
                      size="small"
                      color={record.userCondition.mood === '良好' ? 'success' : 'default'}
                      sx={{ mt: 1 }}
                    />
                  )}
                </Box>

                {record.specialNotes.achievements && (
                  <Alert severity="success" sx={{ mt: 1 }}>
                    <Typography variant="body2">
                      <strong>成果:</strong> {record.specialNotes.achievements}
                    </Typography>
                  </Alert>
                )}

                {record.specialNotes.concerns && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    <Typography variant="body2">
                      <strong>懸念:</strong> {record.specialNotes.concerns}
                    </Typography>
                  </Alert>
                )}

                {record.reporter.name && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    記録者: {record.reporter.name}
                  </Typography>
                )}
              </CardContent>
            </Card>
          ))}
        </Box>

        {dailyRecord.records.length === 0 && (
          <Alert severity="info">
            まだ記録がありません。上記から時間帯を選択して記録を追加してください。
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

// モックデータ（支援対象者）
const mockSupportUsers = [
  { id: '001', name: '田中太郎', planType: '日常生活', isActive: true },
  { id: '005', name: '佐藤花子', planType: '作業活動', isActive: true },
  { id: '012', name: '山田一郎', planType: 'コミュニケーション', isActive: true },
  { id: '018', name: '鈴木美子', planType: '健康管理', isActive: true },
  { id: '023', name: '高橋次郎', planType: '社会生活', isActive: true },
  { id: '030', name: '中村勇気', planType: '作業活動', isActive: true },
  { id: '032', name: '小林さくら', planType: 'コミュニケーション', isActive: true }
];

const timeSlots: TimeSlot[] = [
  '08:00-09:00', '09:00-10:00', '10:00-11:00', '11:00-12:00', '12:00-13:00',
  '13:00-14:00', '14:00-15:00', '15:00-16:00', '16:00-17:00', '17:00-18:00'
];

// 空の時間ベース記録生成
const generateEmptyTimeBasedRecord = (personId: string, personName: string, date: string, timeSlot: TimeSlot): SupportRecord => ({
  id: Date.now() + Math.random(),
  supportPlanId: `plan-${personId}`,
  personId,
  personName,
  date,
  timeSlot,
  userActivities: {
    planned: '',
    actual: '',
    notes: ''
  },
  staffActivities: {
    planned: '',
    actual: '',
    notes: ''
  },
  userCondition: {
    behavior: ''
  },
  specialNotes: {},
  reporter: {
    name: ''
  },
  status: '未記録',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

// モック日次記録生成（時間ベース）
const generateMockTimeBasedDailyRecord = (user: typeof mockSupportUsers[0], date: string): DailySupportRecord => {
  const records: SupportRecord[] = [];

  // いくつかの時間帯にサンプル記録を生成
  const sampleTimeSlots = ['09:00-10:00', '11:00-12:00', '14:00-15:00', '16:00-17:00'];

  sampleTimeSlots.forEach((timeSlot, index) => {
    const record = generateEmptyTimeBasedRecord(user.id, user.name, date, timeSlot as TimeSlot);

    // サンプルデータを設定
    record.status = '記録済み';
    record.userActivities = {
      planned: `${timeSlot}の予定活動: ${['朝の会・健康確認', '個別作業課題', '集団活動・レクリエーション', '一日の振り返り'][index]}`,
      actual: `実際に行った活動: ${['健康状態確認と朝の挨拶を行いました', '集中して個別課題に取り組みました', 'グループ活動に積極的に参加しました', '一日の振り返りを職員と一緒に行いました'][index]}`,
      notes: `${['体調良好でした', '集中力が続いていました', '他の利用者との交流も見られました', '満足そうな表情でした'][index]}`
    };
    record.staffActivities = {
      planned: `職員の予定支援: ${['バイタルチェックと体調確認', '個別課題の準備と声かけ', 'グループ活動の進行と見守り', '振り返りの聞き取りと記録'][index]}`,
      actual: `実際の支援: ${['丁寧にバイタルチェックを実施', '本人のペースに合わせて課題提供', '適度な声かけで参加を促進', '本人の感想をしっかり聞き取り'][index]}`,
      notes: `${['特に問題なく実施', '集中力を維持できるよう環境調整', '他利用者との良い関係作りを支援', '次回への課題も確認'][index]}`
    };
    record.userCondition = {
      mood: (['良好', '普通', '良好', '良好'] as const)[index],
      behavior: `${['落ち着いて挨拶ができており、表情も明るかった', '真剣に課題に取り組み、分からない時は質問もできていた', '積極的に参加し、笑顔も多く見られた', '一日を振り返りながら、感想を話すことができた'][index]}`,
      communication: `${['「おはようございます」と元気に挨拶', '「これでいいですか？」と確認の質問', '他の利用者と自然に会話', '「楽しかったです」と感想を表現'][index]}`,
      physicalState: `${['体温36.5度、血圧正常', '疲労感なし、集中力良好', '適度な運動で良い汗をかいた', '疲れ過ぎず適度な達成感'][index]}`
    };
    record.specialNotes = {
      incidents: index === 2 ? '他の利用者と一緒に歌を歌う場面があった' : undefined,
      concerns: undefined,
      achievements: `${['朝の体調確認がスムーズになってきた', '集中して課題に取り組む時間が延びた', '他の利用者との交流が自然になった', '自分の感情を言葉で表現できた'][index]}`,
      nextTimeConsiderations: `${['引き続き体調管理に注意', '課題の難易度を少し上げても良さそう', 'グループ活動での役割を検討', '振り返りの時間をもう少し取る'][index]}`
    };
    record.reporter = {
      name: ['支援員A', '支援員B', '支援員A', '支援員C'][index],
      role: '生活支援員'
    };

    records.push(record);
  });

  const recordedTimeSlots = records.length;
  const completedTimeSlots = records.filter(r => r.status === '記録済み').length;

  return {
    id: Date.now(),
    supportPlanId: `plan-${user.id}`,
    personId: user.id,
    personName: user.name,
    date,
    records,
    summary: {
      totalTimeSlots: timeSlots.length,
      recordedTimeSlots,
      concerningIncidents: records.filter(r => r.specialNotes.concerns).length,
      achievementHighlights: records.filter(r => r.specialNotes.achievements).length,
      overallProgress: completedTimeSlots >= 3 ? '良好' : completedTimeSlots >= 2 ? '順調' : '要注意'
    },
    dailyNotes: `${user.name}さんの本日の様子は全体的に${completedTimeSlots >= 3 ? '良好' : '普通'}でした。`,
    completedBy: '支援員A',
    completedAt: new Date().toISOString(),
    status: recordedTimeSlots > 0 ? '作成中' : '未作成'
  };
};

const TimeBasedSupportRecordPage: React.FC = () => {
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [dailyRecords, setDailyRecords] = useState<Record<string, DailySupportRecord>>({});

  // フィルタリングされたユーザー
  const filteredUsers = useMemo(() => {
    return mockSupportUsers.filter(user =>
      user.isActive &&
      user.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  // 現在の日次記録を取得または生成
  const currentDailyRecord = useMemo(() => {
    if (!selectedUser) return null;

    const user = mockSupportUsers.find(u => u.id === selectedUser);
    if (!user) return null;

    const recordKey = `${selectedUser}-${selectedDate}`;

    if (!dailyRecords[recordKey]) {
      // 新しい日次記録を生成
      const newRecord = generateMockTimeBasedDailyRecord(user, selectedDate);
      setDailyRecords(prev => ({
        ...prev,
        [recordKey]: newRecord
      }));
      return newRecord;
    }

    return dailyRecords[recordKey];
  }, [selectedUser, selectedDate, dailyRecords]);

  const handleAddRecord = (record: SupportRecord) => {
    if (!currentDailyRecord) return;

    const recordKey = `${selectedUser}-${selectedDate}`;
    const updatedDailyRecord: DailySupportRecord = {
      ...currentDailyRecord,
      records: [...currentDailyRecord.records, record],
      status: '作成中',
      summary: {
        ...currentDailyRecord.summary,
        recordedTimeSlots: currentDailyRecord.records.length + 1
      }
    };

    setDailyRecords(prev => ({
      ...prev,
      [recordKey]: updatedDailyRecord
    }));
  };

  const handleUpdateRecord = (updatedRecord: SupportRecord) => {
    if (!currentDailyRecord) return;

    const recordKey = `${selectedUser}-${selectedDate}`;
    const updatedRecords = currentDailyRecord.records.map((record: SupportRecord) =>
      record.timeSlot === updatedRecord.timeSlot ? updatedRecord : record
    );

    const updatedDailyRecord: DailySupportRecord = {
      ...currentDailyRecord,
      records: updatedRecords,
      summary: {
        ...currentDailyRecord.summary,
        recordedTimeSlots: updatedRecords.length
      }
    };

    setDailyRecords(prev => ({
      ...prev,
      [recordKey]: updatedDailyRecord
    }));
  };

  const getActiveUsersCount = () => mockSupportUsers.filter(u => u.isActive).length;

  return (
    <Container maxWidth="lg">
      <Box py={4}>
        {/* ヘッダー */}
        <Paper elevation={2} sx={{ p: 3, mb: 4, bgcolor: 'primary.50' }}>
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <AccessTimeIcon color="primary" sx={{ fontSize: 40 }} />
            <Box>
              <Typography variant="h4" fontWeight="bold" color="primary">
                時間別支援手順記録
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                時間ごとの本人のやること、職員のやること、本人の様子、特記事項を記録
              </Typography>
            </Box>
          </Box>

          <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
            <Chip
              icon={<PersonIcon />}
              label={`対象者: ${getActiveUsersCount()}名`}
              color="primary"
              variant="outlined"
            />
            <Chip
              icon={<AssignmentIcon />}
              label={`記録方式: 時間帯別`}
              color="secondary"
              variant="outlined"
            />
            <Chip
              icon={<TrendingUpIcon />}
              label="強度行動障害支援"
              color="success"
              variant="outlined"
            />
          </Stack>
        </Paper>

        {/* フィルター・検索 */}
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
              <SearchIcon />
              記録対象選択
            </Typography>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="end">
              <TextField
                label="利用者名で検索"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{ minWidth: 200 }}
                size="small"
              />

              <FormControl sx={{ minWidth: 200 }} size="small">
                <InputLabel>利用者選択</InputLabel>
                <Select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  label="利用者選択"
                >
                  {filteredUsers.map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.name} ({user.planType})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="記録日"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 160 }}
                size="small"
              />
            </Stack>
          </CardContent>
        </Card>

        {/* メイン記録エリア */}
        {selectedUser && currentDailyRecord ? (
          <Box>
            {/* 記録サマリー */}
            <Card sx={{ mb: 4 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  記録サマリー - {currentDailyRecord.personName} ({selectedDate})
                </Typography>
                <Divider sx={{ my: 2 }} />

                <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', mb: 2 }}>
                  <Chip
                    label={`記録済み時間帯: ${currentDailyRecord.summary.recordedTimeSlots}`}
                    color="info"
                  />
                  <Chip
                    label={`成果のあった時間帯: ${currentDailyRecord.summary.achievementHighlights}`}
                    color="success"
                  />
                  <Chip
                    label={`全体的な進捗: ${currentDailyRecord.summary.overallProgress}`}
                    color={
                      currentDailyRecord.summary.overallProgress === '良好' ? 'success' :
                      currentDailyRecord.summary.overallProgress === '順調' ? 'info' : 'warning'
                    }
                  />
                </Stack>

                {currentDailyRecord.dailyNotes && (
                  <Alert severity="info">
                    <strong>日次コメント:</strong> {currentDailyRecord.dailyNotes}
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* 時間別記録リスト */}
            <TimeBasedSupportRecordList
              dailyRecord={currentDailyRecord}
              onAddRecord={handleAddRecord}
              onUpdateRecord={handleUpdateRecord}
            />
          </Box>
        ) : (
          <Alert severity="info">
            利用者と記録日を選択して、時間別支援手順記録を開始してください。
            <br />
            時間帯ごとに「本人のやること」「職員のやること」「本人の様子」「特記事項」を記録します。
          </Alert>
        )}
      </Box>
    </Container>
  );
};

export default TimeBasedSupportRecordPage;