/**
 * AbsentSupportLogForm — 欠席時対応ログ入力フォーム
 *
 * サービス提供実績の「欠席時対応」加算チェック時に展開される
 * 2段構成フォーム（① 欠席連絡受入れ ② 様子伺い）。
 *
 * @module features/service-provision/components/AbsentSupportLogForm
 */

import {
    Divider,
    FormControl,
    FormControlLabel,
    Radio,
    RadioGroup,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import React from 'react';
import type { AbsentSupportLog, FollowUpResult } from '../domain/absentSupportLog';

export interface AbsentSupportLogFormProps {
  absentLog: AbsentSupportLog;
  setLogField: <K extends keyof AbsentSupportLog>(key: K, value: AbsentSupportLog[K]) => void;
}

export const AbsentSupportLogForm: React.FC<AbsentSupportLogFormProps> = React.memo(({
  absentLog,
  setLogField,
}) => (
  <>
    <Divider sx={{ my: 2 }} />
    <Typography variant="subtitle2" sx={{ mb: 1 }}>① 欠席連絡受け入れ</Typography>
    <Stack spacing={1.5} sx={{ mb: 2 }}>
      <TextField
        label="受電日時"
        type="datetime-local"
        size="small"
        value={absentLog.contactDateTime}
        onChange={(e) => setLogField('contactDateTime', e.target.value)}
        InputLabelProps={{ shrink: true }}
      />
      <TextField
        label="連絡者（相手）"
        size="small"
        placeholder="例: 母"
        value={absentLog.contactPerson}
        onChange={(e) => setLogField('contactPerson', e.target.value)}
      />
      <TextField
        label="欠席理由"
        size="small"
        placeholder="例: 発熱"
        value={absentLog.absenceReason}
        onChange={(e) => setLogField('absenceReason', e.target.value)}
      />
      <TextField
        label="対応内容（相談援助）"
        size="small"
        multiline
        minRows={2}
        placeholder="例: 水分摂取・受診を助言"
        value={absentLog.supportContent}
        onChange={(e) => setLogField('supportContent', e.target.value)}
      />
    </Stack>

    <Typography variant="subtitle2" sx={{ mb: 1 }}>② 様子伺い（夕方連絡）</Typography>
    <Stack spacing={1.5} sx={{ mb: 2 }}>
      <FormControl size="small">
        <Typography variant="caption" sx={{ mb: 0.5 }}>結果</Typography>
        <RadioGroup
          row
          value={absentLog.followUpResult}
          onChange={(e) => setLogField('followUpResult', e.target.value as FollowUpResult)}
        >
          <FormControlLabel value="実施" control={<Radio size="small" />} label="実施" />
          <FormControlLabel value="不通" control={<Radio size="small" />} label="不通" />
          <FormControlLabel value="不要" control={<Radio size="small" />} label="不要" />
        </RadioGroup>
      </FormControl>
      <TextField
        label="連絡日時"
        type="datetime-local"
        size="small"
        value={absentLog.followUpDateTime}
        onChange={(e) => setLogField('followUpDateTime', e.target.value)}
        InputLabelProps={{ shrink: true }}
      />
      <TextField
        label="連絡先"
        size="small"
        placeholder="例: 母"
        value={absentLog.followUpTarget}
        onChange={(e) => setLogField('followUpTarget', e.target.value)}
      />
      <TextField
        label="確認内容"
        size="small"
        multiline
        minRows={2}
        placeholder={absentLog.followUpResult === '不通' ? '例: 留守電あり、折返し依頼' : '例: 熱は下がった、明日利用予定'}
        value={absentLog.followUpContent}
        onChange={(e) => setLogField('followUpContent', e.target.value)}
      />
    </Stack>

    <TextField
      label="次回利用予定日"
      type="date"
      size="small"
      value={absentLog.nextPlannedDate}
      onChange={(e) => setLogField('nextPlannedDate', e.target.value)}
      InputLabelProps={{ shrink: true }}
      sx={{ mb: 2 }}
    />
    <Divider sx={{ mb: 2 }} />
  </>
));
AbsentSupportLogForm.displayName = 'AbsentSupportLogForm';
