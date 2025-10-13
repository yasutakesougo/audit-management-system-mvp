import {
    AccessTime as AccessTimeIcon,
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
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    FormControlLabel,
    FormLabel,
    Paper,
    Radio,
    RadioGroup,
    Stack,
    TextField,
    Typography
} from '@mui/material';
import React, { useState } from 'react';
import { SupportRecord, SupportRecordTimeSlot } from './types';

interface SupportRecordFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (record: Omit<SupportRecord, 'id' | 'createdAt' | 'updatedAt'>) => void;
  timeSlot: SupportRecordTimeSlot;
  initialData?: SupportRecord;
  personId: string;
  personName: string;
  date: string;
}

const TimeBasedSupportRecordForm: React.FC<SupportRecordFormProps> = ({
  open,
  onClose,
  onSave,
  timeSlot,
  initialData,
  personId,
  personName,
  date
}) => {
  const [formData, setFormData] = useState<Omit<SupportRecord, 'id' | 'createdAt' | 'updatedAt'>>({
    supportPlanId: initialData?.supportPlanId || '',
    personId,
    personName,
    date,
    timeSlot,
    userActivities: {
      planned: initialData?.userActivities?.planned || '',
      actual: initialData?.userActivities?.actual || '',
      notes: initialData?.userActivities?.notes || ''
    },
    staffActivities: {
      planned: initialData?.staffActivities?.planned || '',
      actual: initialData?.staffActivities?.actual || '',
      notes: initialData?.staffActivities?.notes || ''
    },
    userCondition: {
      mood: initialData?.userCondition?.mood,
      behavior: initialData?.userCondition?.behavior || '',
      communication: initialData?.userCondition?.communication || '',
      physicalState: initialData?.userCondition?.physicalState || ''
    },
    specialNotes: {
      incidents: initialData?.specialNotes?.incidents || '',
      concerns: initialData?.specialNotes?.concerns || '',
      achievements: initialData?.specialNotes?.achievements || '',
      nextTimeConsiderations: initialData?.specialNotes?.nextTimeConsiderations || ''
    },
    reporter: {
      name: initialData?.reporter?.name || '',
      role: initialData?.reporter?.role || ''
    },
    status: initialData?.status || '未記録'
  });

  const handleSave = () => {
    // 記録内容に応じてステータスを自動設定
    const hasBasicInfo = formData.userActivities.actual || formData.staffActivities.actual || formData.userCondition.behavior;
    const hasAnyContent = hasBasicInfo || formData.specialNotes.incidents || formData.specialNotes.concerns;

    const status: SupportRecord['status'] = hasAnyContent
      ? (hasBasicInfo ? '記録済み' : '要確認')
      : '未記録';

    onSave({
      ...formData,
      status
    });
    onClose();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case '記録済み': return 'success';
      case '要確認': return 'warning';
      case '未記録': return 'default';
      default: return 'default';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <AccessTimeIcon color="primary" />
          <Box>
            <Typography variant="h6">
              時間別支援記録 - {timeSlot}
            </Typography>
            <Typography variant="subtitle2" color="text.secondary">
              {personName} ({date})
            </Typography>
          </Box>
          <Chip
            label={formData.status}
            color={getStatusColor(formData.status)}
            size="small"
          />
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          <Alert severity="info" sx={{ mb: 2 }}>
            この時間帯（{timeSlot}）の記録を入力してください。本人のやること、職員のやること、本人の様子、特記事項を記録します。
          </Alert>

          {/* 本人のやること */}
          <Paper elevation={1} sx={{ p: 2 }}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box display="flex" alignItems="center" gap={1}>
                  <PersonIcon color="primary" />
                  <Typography variant="h6">本人のやること</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    label="予定されていた活動・行動"
                    multiline
                    rows={2}
                    value={formData.userActivities.planned}
                    onChange={(e) => setFormData({
                      ...formData,
                      userActivities: { ...formData.userActivities, planned: e.target.value }
                    })}
                    helperText="この時間帯に本人が行う予定だった活動や行動"
                  />
                  <TextField
                    fullWidth
                    label="実際に行った活動・行動"
                    multiline
                    rows={2}
                    value={formData.userActivities.actual}
                    onChange={(e) => setFormData({
                      ...formData,
                      userActivities: { ...formData.userActivities, actual: e.target.value }
                    })}
                    helperText="実際に本人が行った活動や行動の詳細"
                  />
                  <TextField
                    fullWidth
                    label="補足・気づき"
                    multiline
                    rows={1}
                    value={formData.userActivities.notes}
                    onChange={(e) => setFormData({
                      ...formData,
                      userActivities: { ...formData.userActivities, notes: e.target.value }
                    })}
                    helperText="本人の行動について気づいたこと（任意）"
                  />
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Paper>

          {/* 職員のやること */}
          <Paper elevation={1} sx={{ p: 2 }}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box display="flex" alignItems="center" gap={1}>
                  <WorkIcon color="primary" />
                  <Typography variant="h6">職員のやること</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    label="予定されていた支援・関わり"
                    multiline
                    rows={2}
                    value={formData.staffActivities.planned}
                    onChange={(e) => setFormData({
                      ...formData,
                      staffActivities: { ...formData.staffActivities, planned: e.target.value }
                    })}
                    helperText="この時間帯に職員が行う予定だった支援や関わり"
                  />
                  <TextField
                    fullWidth
                    label="実際に行った支援・関わり"
                    multiline
                    rows={2}
                    value={formData.staffActivities.actual}
                    onChange={(e) => setFormData({
                      ...formData,
                      staffActivities: { ...formData.staffActivities, actual: e.target.value }
                    })}
                    helperText="実際に職員が行った支援や関わりの詳細"
                  />
                  <TextField
                    fullWidth
                    label="支援の工夫・配慮事項"
                    multiline
                    rows={1}
                    value={formData.staffActivities.notes}
                    onChange={(e) => setFormData({
                      ...formData,
                      staffActivities: { ...formData.staffActivities, notes: e.target.value }
                    })}
                    helperText="支援で工夫したことや配慮事項（任意）"
                  />
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Paper>

          {/* 本人の様子 */}
          <Paper elevation={1} sx={{ p: 2 }}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box display="flex" alignItems="center" gap={1}>
                  <VisibilityIcon color="primary" />
                  <Typography variant="h6">本人の様子</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <FormControl component="fieldset">
                    <FormLabel component="legend">気分・態度</FormLabel>
                    <RadioGroup
                      row
                      value={formData.userCondition.mood || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        userCondition: {
                          ...formData.userCondition,
                          mood: e.target.value as SupportRecord['userCondition']['mood']
                        }
                      })}
                    >
                      <FormControlLabel value="良好" control={<Radio />} label="良好" />
                      <FormControlLabel value="普通" control={<Radio />} label="普通" />
                      <FormControlLabel value="不安定" control={<Radio />} label="不安定" />
                      <FormControlLabel value="拒否的" control={<Radio />} label="拒否的" />
                      <FormControlLabel value="無反応" control={<Radio />} label="無反応" />
                    </RadioGroup>
                  </FormControl>

                  <TextField
                    fullWidth
                    required
                    label="行動・様子の詳細"
                    multiline
                    rows={3}
                    value={formData.userCondition.behavior}
                    onChange={(e) => setFormData({
                      ...formData,
                      userCondition: { ...formData.userCondition, behavior: e.target.value }
                    })}
                    helperText="本人の具体的な行動や様子を詳しく記録"
                  />

                  <Box display="flex" gap={2} sx={{ flexWrap: 'wrap' }}>
                    <Box flex={1} minWidth="300px">
                      <TextField
                        fullWidth
                        label="コミュニケーション"
                        multiline
                        rows={2}
                        value={formData.userCondition.communication}
                        onChange={(e) => setFormData({
                          ...formData,
                          userCondition: { ...formData.userCondition, communication: e.target.value }
                        })}
                        helperText="会話や意思表示の様子"
                      />
                    </Box>
                    <Box flex={1} minWidth="300px">
                      <TextField
                        fullWidth
                        label="身体状況"
                        multiline
                        rows={2}
                        value={formData.userCondition.physicalState}
                        onChange={(e) => setFormData({
                          ...formData,
                          userCondition: { ...formData.userCondition, physicalState: e.target.value }
                        })}
                        helperText="体調や身体的な状態"
                      />
                    </Box>
                  </Box>
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Paper>

          {/* 特記事項 */}
          <Paper elevation={1} sx={{ p: 2 }}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box display="flex" alignItems="center" gap={1}>
                  <NoteIcon color="primary" />
                  <Typography variant="h6">特記事項</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    label="特記すべき出来事"
                    multiline
                    rows={2}
                    value={formData.specialNotes.incidents}
                    onChange={(e) => setFormData({
                      ...formData,
                      specialNotes: { ...formData.specialNotes, incidents: e.target.value }
                    })}
                    helperText="いつもと異なる出来事や特別な事象"
                  />

                  <Box display="flex" gap={2} sx={{ flexWrap: 'wrap' }}>
                    <Box flex={1} minWidth="300px">
                      <TextField
                        fullWidth
                        label="懸念事項"
                        multiline
                        rows={2}
                        value={formData.specialNotes.concerns}
                        onChange={(e) => setFormData({
                          ...formData,
                          specialNotes: { ...formData.specialNotes, concerns: e.target.value }
                        })}
                        helperText="今後注意すべき点や心配な点"
                      />
                    </Box>
                    <Box flex={1} minWidth="300px">
                      <TextField
                        fullWidth
                        label="良かった点・成果"
                        multiline
                        rows={2}
                        value={formData.specialNotes.achievements}
                        onChange={(e) => setFormData({
                          ...formData,
                          specialNotes: { ...formData.specialNotes, achievements: e.target.value }
                        })}
                        helperText="成長や改善が見られた点"
                      />
                    </Box>
                  </Box>

                  <TextField
                    fullWidth
                    label="次回への申し送り事項"
                    multiline
                    rows={2}
                    value={formData.specialNotes.nextTimeConsiderations}
                    onChange={(e) => setFormData({
                      ...formData,
                      specialNotes: { ...formData.specialNotes, nextTimeConsiderations: e.target.value }
                    })}
                    helperText="次回同じ時間帯で配慮すべきことや引き継ぎ事項"
                  />
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Paper>

          <Divider />

          {/* 記録者情報 */}
          <Box display="flex" gap={2} sx={{ flexWrap: 'wrap' }}>
            <Box flex={1} minWidth="200px">
              <TextField
                fullWidth
                required
                label="記録者名"
                value={formData.reporter.name}
                onChange={(e) => setFormData({
                  ...formData,
                  reporter: { ...formData.reporter, name: e.target.value }
                })}
              />
            </Box>
            <Box flex={1} minWidth="200px">
              <TextField
                fullWidth
                label="職種・役職"
                value={formData.reporter.role}
                onChange={(e) => setFormData({
                  ...formData,
                  reporter: { ...formData.reporter, role: e.target.value }
                })}
              />
            </Box>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!formData.reporter.name || !formData.userCondition.behavior}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TimeBasedSupportRecordForm;