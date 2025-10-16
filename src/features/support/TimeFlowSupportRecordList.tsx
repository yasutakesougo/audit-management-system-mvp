import {
    Add as AddIcon,
    Edit as EditIcon,
    ExpandLess as ExpandLessIcon,
    ExpandMore as ExpandMoreIcon,
    Note as NoteIcon,
    Person as PersonIcon,
    Schedule as ScheduleIcon,
    Visibility as VisibilityIcon,
    Work as WorkIcon
} from '@mui/icons-material';
import {
    Alert,
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Collapse,
    Divider,
    IconButton,
    LinearProgress,
    Paper,
    Stack,
    Typography
} from '@mui/material';
import React, { useState } from 'react';
import TimeBasedSupportRecordForm from './TimeBasedSupportRecordForm';
import { DailySupportRecord, SupportRecord, SupportRecordTimeSlot } from './types';

// 支援活動テンプレートの型定義
interface SupportActivityTemplate {
  id: string;
  activityName: string;
  specificTime: string;
  duration: number;
  importance: '必須' | '推奨' | '任意';
  description: string;
  userExpectedActions: string;
  staffSupportMethods: string;
  iconEmoji?: string;
}

// デフォルト支援活動テンプレート
const defaultSupportActivities: SupportActivityTemplate[] = [
  {
    id: 'morning-arrival',
    activityName: '朝の受け入れ',
    specificTime: '09:00',
    duration: 30,
    importance: '必須',
    description: '朝の健康確認と一日の準備',
    userExpectedActions: '挨拶をして、持ち物を整理する',
    staffSupportMethods: '体調確認、持ち物チェック、一日の予定説明',
    iconEmoji: '🌅'
  },
  {
    id: 'morning-activity',
    activityName: '午前の活動',
    specificTime: '10:00',
    duration: 90,
    importance: '必須',
    description: '個別支援計画に基づく活動',
    userExpectedActions: '計画された活動に参加する',
    staffSupportMethods: '活動の説明、必要に応じて支援',
    iconEmoji: '🎯'
  },
  {
    id: 'lunch',
    activityName: '昼食',
    specificTime: '12:00',
    duration: 60,
    importance: '必須',
    description: '食事の時間',
    userExpectedActions: '手洗いをして、食事を摂る',
    staffSupportMethods: '食事の準備、必要に応じて食事介助',
    iconEmoji: '🍽️'
  },
  {
    id: 'afternoon-activity',
    activityName: '午後の活動',
    specificTime: '13:30',
    duration: 120,
    importance: '推奨',
    description: '創作活動や社会参加活動',
    userExpectedActions: '活動に集中して取り組む',
    staffSupportMethods: '創作支援、コミュニケーション促進',
    iconEmoji: '🎨'
  },
  {
    id: 'snack-break',
    activityName: 'おやつの時間',
    specificTime: '15:00',
    duration: 30,
    importance: '任意',
    description: '休憩とリフレッシュ',
    userExpectedActions: 'おやつを楽しむ、休憩する',
    staffSupportMethods: 'おやつの準備、リラックスできる環境作り',
    iconEmoji: '☕'
  },
  {
    id: 'end-of-day',
    activityName: '帰りの準備',
    specificTime: '16:00',
    duration: 30,
    importance: '必須',
    description: '一日の振り返りと帰宅準備',
    userExpectedActions: '持ち物をまとめて、挨拶をする',
    staffSupportMethods: '一日の振り返り、持ち物チェック、お迎え対応',
    iconEmoji: '👋'
  }
];

interface TimeFlowSupportRecordListProps {
  dailyRecord: DailySupportRecord;
  onAddRecord: (record: SupportRecord) => void;
  onUpdateRecord: (record: SupportRecord) => void;
}

const TimeFlowSupportRecordList: React.FC<TimeFlowSupportRecordListProps> = ({
  dailyRecord,
  onAddRecord,
  onUpdateRecord
}) => {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<SupportActivityTemplate | null>(null);
  const [editingRecord, setEditingRecord] = useState<SupportRecord | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // デフォルト活動テンプレートを使用
  const supportActivities = defaultSupportActivities.map((activity, index) => ({
    ...activity,
    id: `activity-${index + 1}`
  }));

  const getRecordForActivity = (activity: SupportActivityTemplate): SupportRecord | undefined => {
    // 時間帯を活動時間から推定
    const hour = parseInt(activity.specificTime.split(':')[0]);
    const timeSlot = `${hour.toString().padStart(2, '0')}:00-${(hour + 1).toString().padStart(2, '0')}:00`;
    return dailyRecord.records.find(record =>
      record.timeSlot === timeSlot ||
      record.userActivities?.actual?.includes(activity.activityName)
    );
  };

  const handleAddRecord = (activity: SupportActivityTemplate) => {
    setSelectedActivity(activity);
    setEditingRecord(null);
    setFormOpen(true);
  };

  const handleEditRecord = (record: SupportRecord, activity: SupportActivityTemplate) => {
    setSelectedActivity(activity);
    setEditingRecord(record);
    setFormOpen(true);
  };

  const handleSaveRecord = (recordData: Omit<SupportRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingRecord) {
      const updatedRecord: SupportRecord = {
        ...editingRecord,
        ...recordData,
        updatedAt: new Date().toISOString()
      };
      onUpdateRecord(updatedRecord);
    } else {
      const newRecord: SupportRecord = {
        ...recordData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      onAddRecord(newRecord);
    }
  };

  const toggleExpanded = (activityId: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(activityId)) {
      newExpanded.delete(activityId);
    } else {
      newExpanded.add(activityId);
    }
    setExpandedCards(newExpanded);
  };

  const getStatusColor = (status: SupportRecord['status']) => {
    switch (status) {
      case '記録済み': return 'success';
      case '要確認': return 'warning';
      case '未記録': return 'default';
      default: return 'default';
    }
  };

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case '必須': return 'error';
      case '推奨': return 'warning';
      case '任意': return 'info';
      default: return 'default';
    }
  };

  const getProgressStats = () => {
    const totalActivities = supportActivities.length;
    const recordedActivities = supportActivities.filter(activity => getRecordForActivity(activity)).length;
    const completedActivities = supportActivities.filter(activity => {
      const record = getRecordForActivity(activity);
      return record?.status === '記録済み';
    }).length;

    return {
      totalActivities,
      recordedActivities,
      completedActivities,
      progressPercent: (completedActivities / totalActivities) * 100
    };
  };

  const stats = getProgressStats();

  return (
    <Box>
      {/* 進捗サマリー */}
      <Paper elevation={2} sx={{ p: 3, mb: 4, bgcolor: 'primary.50' }}>
        <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
          <ScheduleIcon color="primary" />
          一日の流れ - 記録進捗
        </Typography>
        <Box sx={{ mb: 2 }}>
          <LinearProgress
            variant="determinate"
            value={stats.progressPercent}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>
        <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
          <Chip
            label={`完了: ${stats.completedActivities}/${stats.totalActivities}活動`}
            color="success"
          />
          <Chip
            label={`記録済み: ${stats.recordedActivities}活動`}
            color="info"
          />
          <Chip
            label={`進捗: ${Math.round(stats.progressPercent)}%`}
            color="primary"
          />
        </Stack>
      </Paper>

      {/* 時間フロー表示 */}
      <Stack spacing={3}>
        {supportActivities.map((activity) => {
          const record = getRecordForActivity(activity);
          const hasRecord = !!record;
          const isExpanded = expandedCards.has(activity.id);

          return (
            <Card
              key={activity.id}
              elevation={hasRecord ? 3 : 1}
              sx={{
                border: hasRecord ? '2px solid' : '1px solid',
                borderColor: hasRecord ? 'success.main' : 'grey.300',
                transition: 'all 0.3s ease-in-out',
                '&:hover': {
                  elevation: hasRecord ? 4 : 2,
                  transform: 'translateY(-2px)'
                }
              }}
            >
              <CardContent>
                {/* ヘッダー部分 */}
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Avatar sx={{ bgcolor: 'primary.main', fontSize: '1.5rem' }}>
                      {activity.iconEmoji || '📅'}
                    </Avatar>
                    <Box>
                      <Typography variant="h6" display="flex" alignItems="center" gap={1}>
                        {activity.specificTime} - {activity.activityName}
                        <Chip
                          label={activity.importance}
                          color={getImportanceColor(activity.importance)}
                          size="small"
                        />
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {activity.description} ({activity.duration}分)
                      </Typography>
                      {hasRecord && (
                        <Chip
                          label={record.status}
                          color={getStatusColor(record.status)}
                          size="small"
                          sx={{ mt: 1 }}
                        />
                      )}
                    </Box>
                  </Box>

                  <Box display="flex" alignItems="center" gap={1}>
                    {hasRecord && (
                      <IconButton
                        onClick={() => toggleExpanded(activity.id)}
                        size="small"
                      >
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    )}
                    {hasRecord ? (
                      <IconButton
                        onClick={() => handleEditRecord(record, activity)}
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                    ) : (
                      <Button
                        onClick={() => handleAddRecord(activity)}
                        startIcon={<AddIcon />}
                        variant="outlined"
                        size="small"
                      >
                        記録
                      </Button>
                    )}
                  </Box>
                </Box>

                {/* 活動内容のプレビュー */}
                <Box mb={2}>
                  <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
                    <Box flex={1} minWidth="250px">
                      <Typography variant="subtitle2" color="primary" display="flex" alignItems="center" gap={0.5}>
                        <PersonIcon fontSize="small" />
                        本人のやること
                      </Typography>
                      <Typography variant="body2" sx={{ pl: 2, color: 'text.secondary' }}>
                        {activity.userExpectedActions}
                      </Typography>
                    </Box>
                    <Box flex={1} minWidth="250px">
                      <Typography variant="subtitle2" color="secondary" display="flex" alignItems="center" gap={0.5}>
                        <WorkIcon fontSize="small" />
                        職員のやること
                      </Typography>
                      <Typography variant="body2" sx={{ pl: 2, color: 'text.secondary' }}>
                        {activity.staffSupportMethods}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>

                {/* 記録詳細（展開時） */}
                <Collapse in={isExpanded && hasRecord}>
                  {hasRecord && record && (
                    <Box>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="subtitle1" gutterBottom display="flex" alignItems="center" gap={1}>
                        <VisibilityIcon color="primary" />
                        記録内容
                      </Typography>

                      <Stack spacing={2}>
                        {/* 実際の活動内容 */}
                        <Box>
                          <Typography variant="subtitle2" fontWeight="bold">実際の活動</Typography>
                          <Box pl={2}>
                            {record.userActivities.actual && (
                              <Typography variant="body2">
                                <strong>本人:</strong> {record.userActivities.actual}
                              </Typography>
                            )}
                            {record.staffActivities.actual && (
                              <Typography variant="body2">
                                <strong>職員:</strong> {record.staffActivities.actual}
                              </Typography>
                            )}
                          </Box>
                        </Box>

                        {/* 本人の様子 */}
                        <Box>
                          <Typography variant="subtitle2" fontWeight="bold">本人の様子</Typography>
                          <Box pl={2}>
                            {record.userCondition.mood && (
                              <Chip
                                label={`気分: ${record.userCondition.mood}`}
                                size="small"
                                sx={{ mr: 1, mb: 1 }}
                              />
                            )}
                            {record.userCondition.behavior && (
                              <Typography variant="body2">
                                {record.userCondition.behavior}
                              </Typography>
                            )}
                          </Box>
                        </Box>

                        {/* 特記事項 */}
                        {(record.specialNotes.incidents || record.specialNotes.concerns ||
                          record.specialNotes.achievements) && (
                          <Box>
                            <Typography variant="subtitle2" fontWeight="bold" display="flex" alignItems="center" gap={0.5}>
                              <NoteIcon fontSize="small" />
                              特記事項
                            </Typography>
                            <Box pl={2}>
                              {record.specialNotes.achievements && (
                                <Alert severity="success" sx={{ mb: 1 }}>
                                  <strong>良かった点:</strong> {record.specialNotes.achievements}
                                </Alert>
                              )}
                              {record.specialNotes.incidents && (
                                <Alert severity="info" sx={{ mb: 1 }}>
                                  <strong>特記事項:</strong> {record.specialNotes.incidents}
                                </Alert>
                              )}
                              {record.specialNotes.concerns && (
                                <Alert severity="warning">
                                  <strong>懸念事項:</strong> {record.specialNotes.concerns}
                                </Alert>
                              )}
                            </Box>
                          </Box>
                        )}

                        <Typography variant="caption" color="text.secondary">
                          記録者: {record.reporter.name}
                          {record.reporter.role && ` (${record.reporter.role})`}
                        </Typography>
                      </Stack>
                    </Box>
                  )}
                </Collapse>

                {/* 未記録の場合のメッセージ */}
                {!hasRecord && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    この活動の記録はまだ入力されていません。「記録」ボタンから入力を開始してください。
                  </Alert>
                )}
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      {/* 記録フォーム */}
      {selectedActivity && (
        <TimeBasedSupportRecordForm
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSave={handleSaveRecord}
          timeSlot={`${parseInt(selectedActivity.specificTime.split(':')[0]).toString().padStart(2, '0')}:00-${(parseInt(selectedActivity.specificTime.split(':')[0]) + 1).toString().padStart(2, '0')}:00` as SupportRecordTimeSlot}
          initialData={editingRecord || undefined}
          personId={dailyRecord.personId}
          personName={dailyRecord.personName}
          date={dailyRecord.date}
        />
      )}
    </Box>
  );
};

export default TimeFlowSupportRecordList;