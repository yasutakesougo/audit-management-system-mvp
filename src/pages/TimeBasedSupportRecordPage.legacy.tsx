import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PersonIcon from '@mui/icons-material/Person';
import SearchIcon from '@mui/icons-material/Search';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
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
import React, { useEffect, useMemo, useState } from 'react';
import { ProcedurePanel } from '@/features/daily/components/split-stream/ProcedurePanel';
import { RecordPanel } from '@/features/daily/components/split-stream/RecordPanel';
import { SplitStreamLayout } from '@/features/daily/components/split-stream/SplitStreamLayout';
import { ExtendedTimeSlot, extendedTimeSlotValues } from '../domain/support/step-templates';

// ユーティリティ関数：決定論的ID生成
const generateDeterministicId = (prefix: string, ...identifiers: (string | number)[]): number => {
  const combined = `${prefix}-${identifiers.join('-')}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32bit整数に変換
  }
  return Math.abs(hash);
};

// 時間別支援記録の型定義（ExtendedTimeSlotを使用）
// TODO: 将来的にはsrc/domain/support/types.tsなどに統合予定

interface SupportRecord {
  id: number;
  supportPlanId: string;
  personId: string;
  personName: string;
  date: string;
  timeSlot?: ExtendedTimeSlot;
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

type ProcedureSlotState = {
  slot: ExtendedTimeSlot;
  status: SupportRecord['status'];
  userPlan: string;
  staffPlan: string;
  reporter?: string;
  mood?: SupportRecord['userCondition']['mood'];
};

// 時間別支援記録リストコンポーネント（簡易版）
interface TimeBasedSupportRecordListProps {
  dailyRecord: DailySupportRecord;
  onAddRecord: (record: SupportRecord) => void;
  onUpdateRecord: (record: SupportRecord) => void;
  activeSlot: ExtendedTimeSlot | null;
}

const TimeBasedSupportRecordList: React.FC<TimeBasedSupportRecordListProps> = ({
  dailyRecord,
  onAddRecord,
  onUpdateRecord: _onUpdateRecord,
  activeSlot
}) => {
  const defaultSlot = (timeSlots[0] ?? '09:00-10:00') as ExtendedTimeSlot;
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<ExtendedTimeSlot>(activeSlot ?? defaultSlot);
  const isRecordUnlocked = Boolean(activeSlot);
  const isSlotMatched = activeSlot ? activeSlot === selectedTimeSlot : false;
  const canAddRecord = isRecordUnlocked && isSlotMatched;

  useEffect(() => {
    if (activeSlot) {
      setSelectedTimeSlot(activeSlot);
    }
  }, [activeSlot]);

  const handleAddNewRecord = () => {
    if (!canAddRecord) return;
    const newRecord: SupportRecord = {
      id: generateDeterministicId('time-record', dailyRecord.personId, dailyRecord.date, selectedTimeSlot),
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
    <Card data-testid="time-based-record-list-card">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          時間別記録一覧
        </Typography>

        {/* 新規記録追加 */}
        {/* TODO: 将来的にSupportStepMasterPageからテンプレートを選択できる機能を追加予定 */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }} data-testid="add-new-record-section">
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 150 }} disabled={!isRecordUnlocked}>
              <InputLabel>時間帯選択</InputLabel>
              <Select
                value={selectedTimeSlot}
                onChange={(e) => setSelectedTimeSlot(e.target.value as ExtendedTimeSlot)}
                label="時間帯選択"
                data-testid="timeslot-select"
              >
                {extendedTimeSlotValues.map(slot => (
                  <MenuItem key={slot} value={slot}>
                    {slot}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack spacing={0.5}>
              <Button
                variant="contained"
                size="small"
                disabled={!canAddRecord}
                onClick={handleAddNewRecord}
                data-testid="add-record-button"
              >
                {activeSlot ? `${activeSlot} の記録を開始` : 'Planを確認してください'}
              </Button>
              {!isRecordUnlocked && (
                <Typography variant="caption" color="text.secondary">
                  左のPlanで時間帯をタップすると記録が解放されます。
                </Typography>
              )}
              {isRecordUnlocked && !isSlotMatched && (
                <Typography variant="caption" color="warning.main">
                  選択中の時間帯とPlan確認済みの時間帯が一致していません。
                </Typography>
              )}
            </Stack>
          </Stack>
        </Box>

        {/* 記録一覧表示 */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
          gap: 2
        }} data-testid="records-grid">
          {dailyRecord.records.map((record) => (
            <Card
              key={record.id}
              variant="outlined"
              data-testid={`record-card-${record.timeSlot}`}
              sx={{
                borderColor: record.timeSlot === activeSlot ? 'primary.main' : undefined,
                boxShadow: record.timeSlot === activeSlot ? 3 : undefined,
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
              }}
            >
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

const timeSlots: ExtendedTimeSlot[] = [...extendedTimeSlotValues];

const resolveStatusColor = (status: SupportRecord['status']): 'default' | 'info' | 'success' => {
  switch (status) {
    case '記録済み':
      return 'success';
    case '記録中':
      return 'info';
    default:
      return 'default';
  }
};

// 空の時間ベース記録生成
const generateEmptyTimeBasedRecord = (personId: string, personName: string, date: string, timeSlot: ExtendedTimeSlot): SupportRecord => ({
  id: generateDeterministicId('empty-time-record', personId, date, timeSlot),
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

// モック日次記録生成（時間ベース）- 決定論的データ生成
const generateMockTimeBasedDailyRecord = (user: typeof mockSupportUsers[0], date: string): DailySupportRecord => {
  const records: SupportRecord[] = [];

  // 決定論的な時間帯選択（ユーザーIDと日付に基づく）
  const userIdNum = parseInt(user.id) || 1;
  const dateNum = new Date(date).getDate();
  const sampleTimeSlots = ['09:00-10:00', '11:00-12:00', '14:00-15:00', '16:00-17:00'];

  // ユーザーと日付に基づいて使用する時間帯を決定
  const activeTimeSlots = sampleTimeSlots.filter((_, index) => (userIdNum + dateNum + index) % 3 !== 0);

  activeTimeSlots.forEach((timeSlot, index) => {
    const record = generateEmptyTimeBasedRecord(user.id, user.name, date, timeSlot as ExtendedTimeSlot);

    // 決定論的なサンプルデータを設定
    record.status = '記録済み';

    // 活動データ（時間帯とインデックスに基づく）
    const activityIndex = (userIdNum + index) % 4;
    const activities = [
      {
        planned: '朝の会・健康確認',
        actual: '健康状態確認と朝の挨拶を行いました',
        notes: '体調良好でした',
        staffPlanned: 'バイタルチェックと体調確認',
        staffActual: '丁寧にバイタルチェックを実施',
        staffNotes: '特に問題なく実施'
      },
      {
        planned: '個別作業課題',
        actual: '集中して個別課題に取り組みました',
        notes: '集中力が続いていました',
        staffPlanned: '個別課題の準備と声かけ',
        staffActual: '本人のペースに合わせて課題提供',
        staffNotes: '集中力を維持できるよう環境調整'
      },
      {
        planned: '集団活動・レクリエーション',
        actual: 'グループ活動に積極的に参加しました',
        notes: '他の利用者との交流も見られました',
        staffPlanned: 'グループ活動の進行と見守り',
        staffActual: '適度な声かけで参加を促進',
        staffNotes: '他利用者との良い関係作りを支援'
      },
      {
        planned: '一日の振り返り',
        actual: '一日の振り返りを職員と一緒に行いました',
        notes: '満足そうな表情でした',
        staffPlanned: '振り返りの聞き取りと記録',
        staffActual: '本人の感想をしっかり聞き取り',
        staffNotes: '次回への課題も確認'
      }
    ];

    const activity = activities[activityIndex];
    record.userActivities = {
      planned: `${timeSlot}の予定活動: ${activity.planned}`,
      actual: `実際に行った活動: ${activity.actual}`,
      notes: activity.notes
    };
    record.staffActivities = {
      planned: `職員の予定支援: ${activity.staffPlanned}`,
      actual: `実際の支援: ${activity.staffActual}`,
      notes: activity.staffNotes
    };

    // 決定論的な状態データ
    const moodIndex = (userIdNum + index) % 3;
    const moods = ['良好', '普通', '良好'] as const;
    record.userCondition = {
      mood: moods[moodIndex],
      behavior: activity.actual.replace('実際に行った活動: ', ''),
      communication: `適切なコミュニケーションが取れています - ${activity.notes}`,
      physicalState: `体調：${['良好', '普通', '良好'][moodIndex]} - 特に問題なし`
    };

    // 成果と懸念（決定論的）
    const hasAchievement = (userIdNum + index) % 2 === 0;
    const hasConcern = (userIdNum + index) % 5 === 0;

    record.specialNotes = {
      incidents: index === 2 && (userIdNum % 3 === 0) ? '他の利用者と一緒に歌を歌う場面があった' : undefined,
      concerns: hasConcern ? '少し疲労が見られたため、休憩時間を長めに取りました' : undefined,
      achievements: hasAchievement ? activity.notes : undefined,
      nextTimeConsiderations: `${activity.staffNotes} - 継続的な支援が必要`
    };

    // 担当者（決定論的）
    const staffNames = ['支援員A', '支援員B', '支援員C'];
    record.reporter = {
      name: staffNames[(userIdNum + index) % staffNames.length],
      role: '生活支援員'
    };

    records.push(record);
  });

  const recordedTimeSlots = records.length;
  const completedTimeSlots = records.filter(r => r.status === '記録済み').length;

  return {
    id: generateDeterministicId('daily-time-record', user.id, date),
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

// TODO: 将来的な拡張予定
// 1. SupportStepTemplateとの連携：テンプレート選択機能
// 2. 定義済み支援手順の自動インポート
// 3. 時間帯とテンプレートの適切性チェック
// 4. SharedComponent化：SupportRecordPageとの共通部品抽出

const TimeBasedSupportRecordPage: React.FC = () => {
  // TODO: SupportStepTemplateとの連携機能
  // const [selectedTemplate, setSelectedTemplate] = useState<SupportStepTemplate | null>(null);
  // const [availableTemplates, setAvailableTemplates] = useState<SupportStepTemplate[]>([]);

  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [dailyRecords, setDailyRecords] = useState<Record<string, DailySupportRecord>>({});
  const [activeSlot, setActiveSlot] = useState<ExtendedTimeSlot | null>(null);

  useEffect(() => {
    setActiveSlot(null);
  }, [selectedUser, selectedDate]);

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

  // TODO: 将来的にテンプレートからの記録生成機能
  // const handleCreateFromTemplate = (template: SupportStepTemplate) => {
  //   const newRecord: SupportRecord = {
  //     ...generateEmptyTimeBasedRecord(selectedUser, currentDailyRecord?.personName || '', selectedDate, template.timeSlot),
  //     userActivities: {
  //       planned: template.targetBehavior,
  //       actual: '',
  //       notes: ''
  //     },
  //     staffActivities: {
  //       planned: template.supportMethod,
  //       actual: '',
  //       notes: template.precautions || ''
  //     }
  //   };
  //   handleAddRecord(newRecord);
  // };

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
  const procedureTimeline = useMemo<ProcedureSlotState[]>(() => {
    if (!currentDailyRecord) return [];
    return timeSlots.map((slot) => {
      const record = currentDailyRecord.records.find((r) => r.timeSlot === slot);
      return {
        slot,
        status: record?.status ?? '未記録',
        userPlan: record?.userActivities.planned || '手順未設定',
        staffPlan: record?.staffActivities.planned || '支援未設定',
        reporter: record?.reporter.name,
        mood: record?.userCondition.mood
      };
    });
  }, [currentDailyRecord]);

  return (
    <Container maxWidth="lg" data-testid="time-based-support-record-container">
      <Box py={4}>
        {/* ヘッダー */}
        <Paper elevation={2} sx={{ p: 3, mb: 4, bgcolor: 'primary.50' }} data-testid="time-based-support-record-header">
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
        <Card sx={{ mb: 4 }} data-testid="time-based-support-record-filters">
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
                data-testid="user-search-input"
              />

              <FormControl sx={{ minWidth: 200 }} size="small">
                <InputLabel>利用者選択</InputLabel>
                <Select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  label="利用者選択"
                  data-testid="user-select"
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
                data-testid="record-date-input"
              />
            </Stack>
          </CardContent>
        </Card>

        {/* メイン記録エリア */}
        {selectedUser && currentDailyRecord ? (
          <Box>
            {/* 記録サマリー */}
            <Card sx={{ mb: 4 }} data-testid="time-based-support-record-summary">
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

            <SplitStreamLayout
              plan={(
                <ProcedurePanel title="時間割 / 支援手順">
                  {procedureTimeline.length > 0 ? (
                    procedureTimeline.map((slotInfo) => (
                      <Paper
                        key={slotInfo.slot}
                        variant="outlined"
                        onClick={() => setActiveSlot(slotInfo.slot)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setActiveSlot(slotInfo.slot);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        sx={{
                          p: 2,
                          cursor: 'pointer',
                          borderColor: slotInfo.slot === activeSlot ? 'primary.main' : undefined,
                          boxShadow: slotInfo.slot === activeSlot ? 4 : undefined,
                          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                          textAlign: 'left'
                        }}
                        data-testid={`procedure-slot-${slotInfo.slot}`}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {slotInfo.slot}
                          </Typography>
                          <Stack direction="row" spacing={1} alignItems="center">
                            {slotInfo.slot === activeSlot && (
                              <Chip label="Plan確認済み" color="primary" size="small" />
                            )}
                            <Chip
                              label={slotInfo.status}
                              color={resolveStatusColor(slotInfo.status)}
                              size="small"
                            />
                          </Stack>
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          本人予定: {slotInfo.userPlan}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          職員予定: {slotInfo.staffPlan}
                        </Typography>
                        {slotInfo.mood && (
                          <Chip label={`想定気分: ${slotInfo.mood}`} size="small" sx={{ mt: 0.5 }} />
                        )}
                        {slotInfo.reporter && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                            記録者: {slotInfo.reporter}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary">
                          この枠をタップすると右側の記録がアンロックされます。
                        </Typography>
                      </Paper>
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      右側で記録を追加すると、ここに時間割が表示されます。
                    </Typography>
                  )}
                </ProcedurePanel>
              )}
              record={(
                <RecordPanel title="時間別支援記録">
                  {!activeSlot && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      左のPlanで時間帯を確認すると記録フォームが利用できるようになります。
                    </Alert>
                  )}
                  <Box data-testid="time-based-support-record-list">
                    <TimeBasedSupportRecordList
                      dailyRecord={currentDailyRecord}
                      onAddRecord={handleAddRecord}
                      onUpdateRecord={handleUpdateRecord}
                      activeSlot={activeSlot}
                    />
                  </Box>
                </RecordPanel>
              )}
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