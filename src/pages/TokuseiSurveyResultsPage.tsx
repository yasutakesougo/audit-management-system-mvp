import { summarizeTokuseiResponses, type TokuseiSurveyResponse } from '@/domain/assessment/tokusei';
import { useTokuseiSurveyResponses } from '@/features/assessment/hooks/useTokuseiSurveyResponses';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useEffect, useMemo, useState } from 'react';

const formatDateTime = (value: string): string => {
  if (!value) return '未入力';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const TokuseiDetailField: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <Box>
    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
      {label}
    </Typography>
    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
      {value ?? '未入力'}
    </Typography>
  </Box>
);

const buildUserOptions = (responses: TokuseiSurveyResponse[]): string[] => {
  const names = new Set<string>();
  responses.forEach((response) => {
    if (response.targetUserName) {
      names.add(response.targetUserName);
    }
  });
  return Array.from(names).sort((a, b) => a.localeCompare(b, 'ja'));
};

const TokuseiSurveyResultsPage: React.FC = () => {
  const { data, status, error, refresh } = useTokuseiSurveyResponses();
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [activeResponseId, setActiveResponseId] = useState<number | null>(null);

  const userOptions = useMemo(() => buildUserOptions(data), [data]);

  useEffect(() => {
    if (selectedUser === 'all') return;
    if (!userOptions.includes(selectedUser)) {
      setSelectedUser('all');
    }
  }, [selectedUser, userOptions]);

  const filteredResponses = useMemo(() => {
    if (selectedUser === 'all') return data;
    return data.filter((response) => response.targetUserName === selectedUser);
  }, [data, selectedUser]);

  useEffect(() => {
    if (!filteredResponses.length) {
      setActiveResponseId(null);
      return;
    }
    if (activeResponseId && filteredResponses.some((response) => response.id === activeResponseId)) {
      return;
    }
    setActiveResponseId(filteredResponses[0].id);
  }, [filteredResponses, activeResponseId]);

  const activeResponse = useMemo(
    () => filteredResponses.find((response) => response.id === activeResponseId) ?? null,
    [filteredResponses, activeResponseId],
  );

  const summary = useMemo(() => summarizeTokuseiResponses(data), [data]);

  const showLoadingState = status === 'loading' && data.length === 0;
  const showEmptyState = status === 'success' && data.length === 0;

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: 3 }} elevation={0}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems={{ md: 'center' }} justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <SupportAgentRoundedIcon color="primary" fontSize="large" />
            <Box>
              <Typography variant="h5" fontWeight={600} gutterBottom>
                特性アンケート結果
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Microsoft Forms 由来の特性ヒアリング結果を SharePoint から自動同期
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <Chip label={`回答数: ${summary.totalResponses}`} color="primary" variant="outlined" />
            <Chip label={`対象者: ${summary.uniqueUsers}`} variant="outlined" />
            <Chip label={`保護者/関係者: ${summary.uniqueGuardians}`} variant="outlined" />
            <Typography variant="body2" color="text.secondary">
              最新更新: {summary.latestSubmittedAt ? formatDateTime(summary.latestSubmittedAt) : '未取得'}
            </Typography>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mb={2} alignItems={{ xs: 'stretch', md: 'center' }}>
          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 240 } }}>
            <InputLabel id="tokusei-target-label">対象者フィルター</InputLabel>
            <Select
              labelId="tokusei-target-label"
              label="対象者フィルター"
              value={selectedUser}
              onChange={(event) => setSelectedUser(event.target.value)}
            >
              <MenuItem value="all">すべて</MenuItem>
              {userOptions.map((name) => (
                <MenuItem key={name} value={name}>
                  {name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={() => void refresh()} disabled={status === 'loading'}>
            最新の回答を取得
          </Button>
        </Stack>

        {showLoadingState && (
          <Box display="flex" justifyContent="center" py={6}>
            <Stack spacing={2} alignItems="center">
              <CircularProgress size={32} />
              <Typography variant="body2" color="text.secondary">
                SharePoint から回答を取得しています…
              </Typography>
            </Stack>
          </Box>
        )}

        {status === 'error' && error && (
          <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => void refresh()}>再試行</Button>}>
            {error.message}
          </Alert>
        )}

        {showEmptyState && (
          <Alert severity="info">まだアンケート結果がありません。Microsoft Forms から回答が送信され次第ここに表示されます。</Alert>
        )}

        {!showLoadingState && !showEmptyState && (
          <Box
            mt={1}
            display="grid"
            gridTemplateColumns={{ xs: '1fr', md: '5fr 7fr' }}
            gap={3}
          >
            <Paper variant="outlined" sx={{ height: '100%' }}>
              <List disablePadding>
                {filteredResponses.map((response) => {
                  const selected = response.id === activeResponseId;
                  return (
                    <React.Fragment key={response.id}>
                      <ListItemButton
                        selected={selected}
                        alignItems="flex-start"
                        onClick={() => setActiveResponseId(response.id)}
                      >
                        <ListItemText
                          primary={
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Typography fontWeight={600}>{response.targetUserName || '対象者未入力'}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatDateTime(response.fillDate)}
                              </Typography>
                            </Stack>
                          }
                          secondary={
                            <Typography variant="body2" color="text.secondary">
                              {response.responderName || '回答者未設定'}
                            </Typography>
                          }
                        />
                      </ListItemButton>
                      <Divider component="li" />
                    </React.Fragment>
                  );
                })}
                {filteredResponses.length === 0 && (
                  <Box p={3} textAlign="center">
                    <Typography variant="body2" color="text.secondary">
                      対象者に一致する回答がありません
                    </Typography>
                  </Box>
                )}
              </List>
            </Paper>

            <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
              {status === 'loading' && !activeResponse && <Skeleton variant="rectangular" height={300} />}
              {activeResponse ? (
                <Stack spacing={2}>
                  <Stack direction="row" spacing={2} flexWrap="wrap">
                    <Chip label={activeResponse.targetUserName || '対象者未設定'} color="primary" />
                    <Chip label={activeResponse.guardianName ? `${activeResponse.guardianName} (${activeResponse.relation ?? '関係未入力'})` : '関係者未入力'} variant="outlined" />
                    <Chip label={`回答者: ${activeResponse.responderName || '未設定'}`} variant="outlined" />
                  </Stack>

                  <Stack direction="row" spacing={2} flexWrap="wrap">
                    <Chip label={`身長: ${activeResponse.heightCm ? `${activeResponse.heightCm} cm` : '未入力'}`} size="small" />
                    <Chip label={`体重: ${activeResponse.weightKg ? `${activeResponse.weightKg} kg` : '未入力'}`} size="small" />
                    <Chip label={`記入日時: ${formatDateTime(activeResponse.fillDate)}`} size="small" />
                  </Stack>

                  <Divider />

                  <TokuseiDetailField label="性格・コミュニケーション" value={activeResponse.personality} />
                  <TokuseiDetailField label="感覚の特徴" value={activeResponse.sensoryFeatures} />
                  <TokuseiDetailField label="行動の特徴" value={activeResponse.behaviorFeatures} />
                  <TokuseiDetailField label="得意なこと・強み" value={activeResponse.strengths} />
                  <TokuseiDetailField label="特記事項" value={activeResponse.notes} />
                </Stack>
              ) : (
                <Box textAlign="center" py={6}>
                  <Typography variant="body1" color="text.secondary">
                    表示する回答を選択してください
                  </Typography>
                </Box>
              )}
            </Paper>
          </Box>
        )}
      </Paper>
    </Stack>
  );
};

export default TokuseiSurveyResultsPage;
