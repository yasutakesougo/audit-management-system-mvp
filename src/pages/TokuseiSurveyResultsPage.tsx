import { summarizeTokuseiResponses, type TokuseiSurveyResponse } from '@/domain/assessment/tokusei';
import FeatureChipList from '@/features/assessment/components/FeatureChipList';
import { useTokuseiSurveyResponses } from '@/features/assessment/hooks/useTokuseiSurveyResponses';
import { env } from '@/lib/env';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded';
import { Card, CardContent, CardHeader } from '@mui/material';
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
import OutlinedInput from '@mui/material/OutlinedInput';
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
    <Typography variant="subtitle2" component="span" color="text.secondary" gutterBottom>
      {label}
    </Typography>
    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
      {value ?? '未入力'}
    </Typography>
  </Box>
);

const EmptyState: React.FC<{
  variant: 'all' | 'filtered';
  hasFormsUrl: boolean;
  formsUrl?: string;
  onResetFilters?: () => void;
}> = ({ variant, hasFormsUrl, formsUrl, onResetFilters }) => {
  const title = variant === 'all' ? '特性アンケートの回答がまだありません' : '条件に一致する回答がありません';
  const description =
    variant === 'all'
      ? 'Microsoft Formsで回答が送信されると、ここに表示されます。'
      : '検索や日付フィルタを緩めると表示される可能性があります。';

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={1.5}>
        <Typography variant="h6">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>

        <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
          {variant === 'filtered' && onResetFilters && (
            <Button variant="outlined" onClick={onResetFilters}>
              フィルタをリセット
            </Button>
          )}

          {hasFormsUrl ? (
            <Button
              variant="contained"
              component="a"
              href={formsUrl}
              target="_blank"
              rel="noreferrer"
            >
              Formsで回答を送る
            </Button>
          ) : (
            <Button variant="contained" disabled title="VITE_TOKUSEI_FORMS_URL が未設定です">
              Formsで回答を送る
            </Button>
          )}
        </Stack>

        {!hasFormsUrl && (
          <Typography variant="caption" color="text.secondary">
            管理者向け: .env に VITE_TOKUSEI_FORMS_URL を設定すると、ここにFormsへの導線が表示されます。
          </Typography>
        )}
      </Stack>
    </Paper>
  );
};

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
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [activeResponseId, setActiveResponseId] = useState<number | null>(null);
  const formsUrl = env.VITE_TOKUSEI_FORMS_URL;

  const sortedData = useMemo(
    () =>
      [...data].sort((a, b) => {
        const aTime = a.fillDate ? new Date(a.fillDate).getTime() : 0;
        const bTime = b.fillDate ? new Date(b.fillDate).getTime() : 0;
        return bTime - aTime;
      }),
    [data],
  );

  const userOptions = useMemo(() => buildUserOptions(sortedData), [sortedData]);

  useEffect(() => {
    if (selectedUser === 'all') return;
    if (!userOptions.includes(selectedUser)) {
      setSelectedUser('all');
    }
  }, [selectedUser, userOptions]);

  const filteredResponses = useMemo(() => {
    const lower = searchQuery.trim().toLowerCase();
    return sortedData.filter((response) => {
      if (selectedUser !== 'all' && response.targetUserName !== selectedUser) return false;
      if (lower) {
        const haystack = [response.targetUserName, response.responderName, response.guardianName]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(lower)) return false;
      }
      if (fromDate) {
        const t = new Date(response.fillDate).getTime();
        const from = new Date(fromDate).setHours(0, 0, 0, 0);
        if (Number.isFinite(t) && t < from) return false;
      }
      if (toDate) {
        const t = new Date(response.fillDate).getTime();
        const to = new Date(toDate).setHours(23, 59, 59, 999);
        if (Number.isFinite(t) && t > to) return false;
      }
      return true;
    });
  }, [sortedData, selectedUser, searchQuery, fromDate, toDate]);

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

  const summary = useMemo(() => summarizeTokuseiResponses(sortedData), [sortedData]);

  const showLoadingState = status === 'loading' && data.length === 0;
  const totalCount = data.length;
  const filteredCount = filteredResponses.length;
  const isEmptyAll = status === 'success' && totalCount === 0;
  const isEmptyFiltered = status === 'success' && totalCount > 0 && filteredCount === 0;

  const resetFilters = () => {
    setSelectedUser('all');
    setSearchQuery('');
    setFromDate('');
    setToDate('');
  };

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
          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 220 } }}>
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

          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 240 } }}>
            <InputLabel htmlFor="tokusei-search">検索（氏名・回答者）</InputLabel>
            <OutlinedInput
              id="tokusei-search"
              label="検索（氏名・回答者）"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="例: 佐藤 / 保護者"
            />
          </FormControl>

          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 160 } }}>
            <InputLabel shrink>回答日(開始)</InputLabel>
            <OutlinedInput
              type="date"
              notched
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              label="回答日(開始)"
            />
          </FormControl>

          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 160 } }}>
            <InputLabel shrink>回答日(終了)</InputLabel>
            <OutlinedInput
              type="date"
              notched
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              label="回答日(終了)"
            />
          </FormControl>
          <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={() => void refresh()} disabled={status === 'loading'}>
            最新の回答を取得
          </Button>
          <Button
            variant="text"
            onClick={resetFilters}
            disabled={selectedUser === 'all' && !searchQuery && !fromDate && !toDate}
          >
            フィルターをリセット
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => formsUrl && window.open(formsUrl, '_blank', 'noreferrer')}
            disabled={!formsUrl}
          >
            Formsを開く
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

        {isEmptyAll && (
          <EmptyState variant="all" hasFormsUrl={Boolean(formsUrl)} formsUrl={formsUrl} />
        )}

        {!showLoadingState && !isEmptyAll && (
          isEmptyFiltered ? (
            <EmptyState
              variant="filtered"
              hasFormsUrl={Boolean(formsUrl)}
              formsUrl={formsUrl}
              onResetFilters={resetFilters}
            />
          ) : (
            <Box
              mt={1}
              display="grid"
              gridTemplateColumns={{ xs: '1fr', md: '5fr 7fr' }}
              gap={3}
            >
              <Paper variant="outlined" sx={{ height: '100%' }}>
                <List disablePadding>
                  {filteredResponses.map((response, index) => {
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
                                  {formatDateTime(response.fillDate)}{index === 0 ? '（最新）' : ''}
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
                </List>
              </Paper>

              <Paper variant="outlined" sx={{ p: 2.5, height: '100%' }}>
                {status === 'loading' && !activeResponse && (
                  <Skeleton variant="rectangular" height={300} />
                )}

                {activeResponse ? (
                  <Stack spacing={2}>
                    {/* 基本情報 */}
                    <Card variant="outlined">
                      <CardHeader
                        title="基本情報"
                        titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
                        sx={{ pb: 0.5 }}
                      />
                      <CardContent sx={{ pt: 1.5 }}>
                        <Stack spacing={1.2}>
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Chip
                              label={activeResponse.targetUserName || '対象者未設定'}
                              color="primary"
                            />
                            <Chip
                              label={`回答者: ${activeResponse.responderName || '未設定'}`}
                              variant="outlined"
                            />
                            <Chip
                              label={`記入日時: ${formatDateTime(activeResponse.fillDate)}`}
                              variant="outlined"
                            />
                            {activeResponse.guardianName && (
                              <Chip
                                label={`保護者: ${activeResponse.guardianName}${activeResponse.relation ? `（${activeResponse.relation}）` : ''}`}
                                variant="outlined"
                              />
                            )}
                            {(activeResponse.heightCm != null || activeResponse.weightKg != null) && (
                              <Chip
                                label={[
                                  activeResponse.heightCm != null ? `${activeResponse.heightCm}cm` : null,
                                  activeResponse.weightKg != null ? `${activeResponse.weightKg}kg` : null,
                                ].filter(Boolean).join(' / ')}
                                variant="outlined"
                                size="small"
                              />
                            )}
                          </Stack>

                          {activeResponse.responderEmail && (
                            <Typography variant="body2" color="text.secondary">
                              {`メール: ${activeResponse.responderEmail}`}
                            </Typography>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>

                    {/* 詳細（チップベース Bento Grid レイアウト） */}
                    <Card variant="outlined">
                      <CardHeader
                        title="性格・対人関係"
                        titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
                        sx={{ pb: 0.5 }}
                      />
                      <CardContent sx={{ pt: 1.5 }}>
                        <FeatureChipList value={activeResponse.personality} />
                      </CardContent>
                    </Card>

                    <Card variant="outlined">
                      <CardHeader
                        title="感覚の特徴"
                        titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
                        sx={{ pb: 0.5 }}
                      />
                      <CardContent sx={{ pt: 1.5 }}>
                        <FeatureChipList value={activeResponse.sensoryFeatures} />
                      </CardContent>
                    </Card>

                    <Card variant="outlined">
                      <CardHeader
                        title="行動・コミュニケーション"
                        titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
                        sx={{ pb: 0.5 }}
                      />
                      <CardContent sx={{ pt: 1.5 }}>
                        <FeatureChipList value={activeResponse.behaviorFeatures} />
                      </CardContent>
                    </Card>

                    <Card variant="outlined">
                      <CardHeader
                        title="得意なこと・強み"
                        titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
                        sx={{ pb: 0.5 }}
                      />
                      <CardContent sx={{ pt: 1.5 }}>
                        <TokuseiDetailField label="" value={activeResponse.strengths} />
                      </CardContent>
                    </Card>

                    <Card variant="outlined">
                      <CardHeader
                        title="特記事項"
                        titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
                        sx={{ pb: 0.5 }}
                      />
                      <CardContent sx={{ pt: 1.5 }}>
                        <TokuseiDetailField label="" value={activeResponse.notes} />
                      </CardContent>
                    </Card>
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
          )
        )}
      </Paper>
    </Stack>
  );
};

export default TokuseiSurveyResultsPage;
