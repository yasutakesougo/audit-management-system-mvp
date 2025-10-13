import {
    AccessTime as AccessTimeIcon,
    Add as AddIcon,
    Edit as EditIcon,
    ExpandMore as ExpandMoreIcon,
    Note as NoteIcon,
    Person as PersonIcon,
    Visibility as VisibilityIcon,
    Work as WorkIcon
} from '@mui/icons-material';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Divider,
    IconButton,
    LinearProgress,
    Stack,
    Typography
} from '@mui/material';
import React, { useState } from 'react';
import TimeBasedSupportRecordForm from './TimeBasedSupportRecordForm';
import { DailySupportRecord, SupportRecord, SupportRecordTimeSlot } from './types';

interface TimeBasedSupportRecordListProps {
  dailyRecord: DailySupportRecord;
  onAddRecord: (record: SupportRecord) => void;
  onUpdateRecord: (record: SupportRecord) => void;
}

const timeSlots: SupportRecordTimeSlot[] = [
  '08:00-09:00', '09:00-10:00', '10:00-11:00', '11:00-12:00', '12:00-13:00',
  '13:00-14:00', '14:00-15:00', '15:00-16:00', '16:00-17:00', '17:00-18:00'
];

const TimeBasedSupportRecordList: React.FC<TimeBasedSupportRecordListProps> = ({
  dailyRecord,
  onAddRecord,
  onUpdateRecord
}) => {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<SupportRecordTimeSlot>('08:00-09:00');
  const [editingRecord, setEditingRecord] = useState<SupportRecord | null>(null);

  const getRecordForTimeSlot = (timeSlot: SupportRecordTimeSlot): SupportRecord | undefined => {
    return dailyRecord.records.find(record => record.timeSlot === timeSlot);
  };

  const handleAddRecord = (timeSlot: SupportRecordTimeSlot) => {
    setSelectedTimeSlot(timeSlot);
    setEditingRecord(null);
    setFormOpen(true);
  };

  const handleEditRecord = (record: SupportRecord) => {
    setSelectedTimeSlot(record.timeSlot);
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

  const getStatusColor = (status: SupportRecord['status']) => {
    switch (status) {
      case '記録済み': return 'success';
      case '要確認': return 'warning';
      case '未記録': return 'default';
      default: return 'default';
    }
  };

  const getProgressStats = () => {
    const totalSlots = timeSlots.length;
    const recordedSlots = timeSlots.filter(slot => getRecordForTimeSlot(slot)).length;
    const completedSlots = timeSlots.filter(slot => {
      const record = getRecordForTimeSlot(slot);
      return record?.status === '記録済み';
    }).length;

    return {
      totalSlots,
      recordedSlots,
      completedSlots,
      progressPercent: (completedSlots / totalSlots) * 100
    };
  };

  const stats = getProgressStats();

  return (
    <Box>
      {/* 進捗サマリー */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            記録進捗状況
          </Typography>
          <Box sx={{ mb: 2 }}>
            <LinearProgress
              variant="determinate"
              value={stats.progressPercent}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
          <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
            <Chip label={`完了: ${stats.completedSlots}/${stats.totalSlots}時間帯`} color="success" />
            <Chip label={`記録済み: ${stats.recordedSlots}時間帯`} color="info" />
            <Chip label={`進捗: ${Math.round(stats.progressPercent)}%`} color="primary" />
          </Stack>
        </CardContent>
      </Card>

      {/* 時間帯別記録リスト */}
      <Stack spacing={2}>
        {timeSlots.map((timeSlot) => {
          const record = getRecordForTimeSlot(timeSlot);
          const hasRecord = !!record;

          return (
            <Card key={timeSlot} elevation={hasRecord ? 2 : 1}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Box display="flex" alignItems="center" gap={2}>
                    <AccessTimeIcon color="primary" />
                    <Typography variant="h6">{timeSlot}</Typography>
                    {hasRecord && (
                      <Chip
                        label={record.status}
                        color={getStatusColor(record.status)}
                        size="small"
                      />
                    )}
                  </Box>
                  <Box display="flex" gap={1}>
                    {hasRecord ? (
                      <IconButton
                        onClick={() => handleEditRecord(record)}
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                    ) : (
                      <Button
                        onClick={() => handleAddRecord(timeSlot)}
                        startIcon={<AddIcon />}
                        variant="outlined"
                        size="small"
                      >
                        記録を追加
                      </Button>
                    )}
                  </Box>
                </Box>

                {hasRecord ? (
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle1">記録詳細を表示</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={2}>
                        {/* 本人のやること */}
                        <Box>
                          <Box display="flex" alignItems="center" gap={1} mb={1}>
                            <PersonIcon fontSize="small" color="primary" />
                            <Typography variant="subtitle2" fontWeight="bold">本人のやること</Typography>
                          </Box>
                          <Box pl={3}>
                            {record.userActivities.planned && (
                              <Typography variant="body2" color="text.secondary">
                                <strong>予定:</strong> {record.userActivities.planned}
                              </Typography>
                            )}
                            {record.userActivities.actual && (
                              <Typography variant="body2">
                                <strong>実際:</strong> {record.userActivities.actual}
                              </Typography>
                            )}
                            {record.userActivities.notes && (
                              <Typography variant="body2" color="text.secondary">
                                <strong>補足:</strong> {record.userActivities.notes}
                              </Typography>
                            )}
                          </Box>
                        </Box>

                        <Divider />

                        {/* 職員のやること */}
                        <Box>
                          <Box display="flex" alignItems="center" gap={1} mb={1}>
                            <WorkIcon fontSize="small" color="primary" />
                            <Typography variant="subtitle2" fontWeight="bold">職員のやること</Typography>
                          </Box>
                          <Box pl={3}>
                            {record.staffActivities.planned && (
                              <Typography variant="body2" color="text.secondary">
                                <strong>予定:</strong> {record.staffActivities.planned}
                              </Typography>
                            )}
                            {record.staffActivities.actual && (
                              <Typography variant="body2">
                                <strong>実際:</strong> {record.staffActivities.actual}
                              </Typography>
                            )}
                            {record.staffActivities.notes && (
                              <Typography variant="body2" color="text.secondary">
                                <strong>工夫:</strong> {record.staffActivities.notes}
                              </Typography>
                            )}
                          </Box>
                        </Box>

                        <Divider />

                        {/* 本人の様子 */}
                        <Box>
                          <Box display="flex" alignItems="center" gap={1} mb={1}>
                            <VisibilityIcon fontSize="small" color="primary" />
                            <Typography variant="subtitle2" fontWeight="bold">本人の様子</Typography>
                          </Box>
                          <Box pl={3}>
                            {record.userCondition.mood && (
                              <Chip
                                label={`気分: ${record.userCondition.mood}`}
                                size="small"
                                sx={{ mr: 1, mb: 1 }}
                              />
                            )}
                            <Typography variant="body2">
                              <strong>行動・様子:</strong> {record.userCondition.behavior}
                            </Typography>
                            {record.userCondition.communication && (
                              <Typography variant="body2">
                                <strong>コミュニケーション:</strong> {record.userCondition.communication}
                              </Typography>
                            )}
                            {record.userCondition.physicalState && (
                              <Typography variant="body2">
                                <strong>身体状況:</strong> {record.userCondition.physicalState}
                              </Typography>
                            )}
                          </Box>
                        </Box>

                        {/* 特記事項 */}
                        {(record.specialNotes.incidents || record.specialNotes.concerns ||
                          record.specialNotes.achievements || record.specialNotes.nextTimeConsiderations) && (
                          <>
                            <Divider />
                            <Box>
                              <Box display="flex" alignItems="center" gap={1} mb={1}>
                                <NoteIcon fontSize="small" color="primary" />
                                <Typography variant="subtitle2" fontWeight="bold">特記事項</Typography>
                              </Box>
                              <Box pl={3}>
                                {record.specialNotes.incidents && (
                                  <Alert severity="info" sx={{ mb: 1 }}>
                                    <strong>特記すべき出来事:</strong> {record.specialNotes.incidents}
                                  </Alert>
                                )}
                                {record.specialNotes.concerns && (
                                  <Alert severity="warning" sx={{ mb: 1 }}>
                                    <strong>懸念事項:</strong> {record.specialNotes.concerns}
                                  </Alert>
                                )}
                                {record.specialNotes.achievements && (
                                  <Alert severity="success" sx={{ mb: 1 }}>
                                    <strong>良かった点:</strong> {record.specialNotes.achievements}
                                  </Alert>
                                )}
                                {record.specialNotes.nextTimeConsiderations && (
                                  <Typography variant="body2">
                                    <strong>次回への申し送り:</strong> {record.specialNotes.nextTimeConsiderations}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </>
                        )}

                        <Divider />

                        {/* 記録者情報 */}
                        <Typography variant="caption" color="text.secondary">
                          記録者: {record.reporter.name}
                          {record.reporter.role && ` (${record.reporter.role})`}
                        </Typography>
                      </Stack>
                    </AccordionDetails>
                  </Accordion>
                ) : (
                  <Alert severity="info">
                    この時間帯の記録はまだ入力されていません。「記録を追加」ボタンで記録を開始してください。
                  </Alert>
                )}
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      {/* 記録フォーム */}
      <TimeBasedSupportRecordForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSaveRecord}
        timeSlot={selectedTimeSlot}
        initialData={editingRecord || undefined}
        personId={dailyRecord.personId}
        personName={dailyRecord.personName}
        date={dailyRecord.date}
      />
    </Box>
  );
};

export default TimeBasedSupportRecordList;