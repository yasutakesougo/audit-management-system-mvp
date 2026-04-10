import React from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import type { IspMeetingDetail } from '@/domain/isp/schema';

export type MeetingDetailSectionProps = {
  meeting: IspMeetingDetail;
  isAdmin: boolean;
  onChange: (updates: Partial<IspMeetingDetail>) => void;
};

const MeetingDetailSection: React.FC<MeetingDetailSectionProps> = ({
  meeting,
  isAdmin,
  onChange,
}) => {
  const [newAttendee, setNewAttendee] = React.useState('');
  const readOnly = !isAdmin;

  const handleAddAttendee = () => {
    if (!newAttendee.trim()) return;
    onChange({
      attendees: [...meeting.attendees, newAttendee.trim()],
    });
    setNewAttendee('');
  };

  const handleRemoveAttendee = (index: number) => {
    const next = [...meeting.attendees];
    next.splice(index, 1);
    onChange({ attendees: next });
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="subtitle1" fontWeight="bold" color="primary">
          🤝 サービス担当者会議・照会記録
        </Typography>
        <Typography variant="body2" color="text.secondary">
          計画作成にあたって実施した会議の実施日、議事内容、出席者を記録します。
        </Typography>

        <TextField
          type="date"
          size="small"
          label="会議実施日"
          value={meeting.meetingDate ?? ''}
          onChange={(e) => onChange({ meetingDate: e.target.value || null })}
          disabled={readOnly}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ maxWidth: 200 }}
          data-testid="compliance-meeting-date"
        />

        <TextField
          size="small"
          label="出席者名簿"
          placeholder="例: 山田太郎、田中花子..."
          value={newAttendee}
          onChange={(e) => setNewAttendee(e.target.value)}
          disabled={readOnly}
          onKeyPress={(e) => e.key === 'Enter' && handleAddAttendee()}
          helperText="氏名を入力してEnterで追加"
          data-testid="compliance-meeting-attendees-input"
        />

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {meeting.attendees.map((name, i) => (
            <Chip
              key={`${name}-${i}`}
              label={name}
              onDelete={readOnly ? undefined : () => handleRemoveAttendee(i)}
              size="small"
            />
          ))}
          {meeting.attendees.length === 0 && (
            <Typography variant="caption" color="text.disabled">
              出席者が登録されていません
            </Typography>
          )}
        </Box>

        <TextField
          size="small"
          label="会議議事要旨"
          value={meeting.meetingMinutes}
          onChange={(e) => onChange({ meetingMinutes: e.target.value })}
          disabled={readOnly}
          multiline
          minRows={3}
          placeholder="例: 本人の移行を再確認し、短期目標の活動頻度について合意した。相談支援事業所よりモニタリング期間の調整あり。"
          data-testid="compliance-meeting-minutes"
        />
      </Stack>
    </Paper>
  );
};

export default React.memo(MeetingDetailSection);
