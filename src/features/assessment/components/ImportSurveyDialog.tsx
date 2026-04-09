import type { TokuseiSurveyResponse } from '@/domain/assessment/tokusei';
import { useTokuseiSurveyResponses } from '@/features/assessment/hooks/useTokuseiSurveyResponses';
import AssignmentIcon from '@mui/icons-material/Assignment';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import React, { useMemo } from 'react';

type Props = {
  open: boolean;
  targetUserId?: string;
  targetUserName?: string;
  onClose: () => void;
  onSelect: (response: TokuseiSurveyResponse) => void;
};

export const ImportSurveyDialog: React.FC<Props> = ({
  open,
  targetUserId,
  targetUserName,
  onClose,
  onSelect,
}) => {
  const { responses, status } = useTokuseiSurveyResponses();

  const filteredResponses = useMemo(() => {
    if (!targetUserName) return responses;
    const normalize = (value: string) => value
      .normalize('NFKC')
      .replace(/[\p{White_Space}\p{Cf}]+/gu, '')
      .toLowerCase();
    const normalizeName = (value: string) => normalize(value)
      .replace(/[（(].*?[)）]/g, '')
      .replace(/(さん|様|ちゃん|くん)$/u, '');
    const normalizedTarget = normalizeName(targetUserName);
    const matched = responses.filter((response) => {
      const source = normalizeName(response.targetUserName ?? '');
      if (!source || !normalizedTarget) return false;
      return source === normalizedTarget || source.includes(normalizedTarget) || normalizedTarget.includes(source);
    });
    return matched;
  }, [responses, targetUserName]);

  const hasMatch = filteredResponses.length > 0;
  const displayList = (targetUserName && hasMatch) ? filteredResponses : responses;
  const showMatchError = targetUserName && !hasMatch && responses.length > 0;
  const isLoading = status === 'loading';
  const hasError = status === 'error';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        アンケート結果からの取り込み
        {(targetUserName || targetUserId) && (
          <Typography variant="caption" display="block" color="text.secondary">
            対象候補: {targetUserName ?? targetUserId}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers>
        {isLoading && (
          <Typography>読み込み中...</Typography>
        )}
        {!isLoading && hasError && (
          <Typography color="error">アンケートの取得に失敗しました。通信環境を確認して再度お試しください。</Typography>
        )}
        
        {showMatchError && (
          <Box sx={{ mb: 2 }}>
            <Alert severity="warning" variant="outlined">
              <Typography variant="body2" fontWeight={600}>
                「{targetUserName}」の自動一致を確定できませんでした。
              </Typography>
              <Typography variant="caption">
                名前表記の揺れ（空白・旧字体・入力差）を考慮し、全回答を表示しています。該当の回答を選択してください。
              </Typography>
            </Alert>
          </Box>
        )}

        {!isLoading && !hasError && displayList.length === 0 && (
          <Box textAlign="center" py={2}>
            <Typography color="text.secondary">
              登録されているアンケート結果がありません。
            </Typography>
          </Box>
        )}
        {!isLoading && !hasError && displayList.length > 0 && (
          <List>
            {displayList.map((response) => (
              <ListItem key={response.id} disablePadding divider>
                <ListItemButton onClick={() => onSelect(response)}>
                  <ListItemIcon>
                    <AssignmentIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={(
                      <Box display="flex" alignItems="center" gap={1}>
                        {response.targetUserName || '対象者未設定'}
                        <Chip
                          label={response.fillDate ? new Date(response.fillDate).toLocaleDateString() : '日付不明'}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    )}
                    secondary={(
                      <Typography variant="body2" color="text.secondary">
                        回答者: {response.responderName || '未設定'}
                        {response.relation ? ` (${response.relation})` : ''}
                      </Typography>
                    )}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImportSurveyDialog;
