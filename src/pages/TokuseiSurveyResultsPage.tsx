/**
 * TokuseiSurveyResultsPage.tsx — Orchestrator shell for the Tokusei survey results page.
 *
 * Refactored in NR21. Responsibilities have been extracted to:
 * - tokuseiSurveyHelpers.ts             → formatDateTime, buildUserOptions, applyResponseFilters
 * - useTokuseiSurveyFilter.ts           → all filter / selection state and effects
 * - components/TokuseiEmptyState.tsx    → empty state panel
 * - components/TokuseiResponseDetail.tsx → response detail panel
 */
import TokuseiEmptyState from '@/features/assessment/components/TokuseiEmptyState';
import TokuseiResponseDetail from '@/features/assessment/components/TokuseiResponseDetail';
import { useTokuseiSurveyResponses } from '@/features/assessment/hooks/useTokuseiSurveyResponses';
import { formatDateTime } from '@/features/assessment/tokuseiSurveyHelpers';
import { useTokuseiSurveyFilter } from '@/features/assessment/useTokuseiSurveyFilter';
import { IBDPageHeader } from '@/features/ibd/core/components/IBDPageHeader';
import { env } from '@/lib/env';
import FilterAltOffRoundedIcon from '@mui/icons-material/FilterAltOffRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import OutlinedInput from '@mui/material/OutlinedInput';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React from 'react';

const TokuseiSurveyResultsPage: React.FC = () => {
  const { data, status, error, refresh } = useTokuseiSurveyResponses();
  const formsUrl = env.VITE_TOKUSEI_FORMS_URL;

  const {
    filteredResponses,
    activeResponse,
    activeResponseId,
    setActiveResponseId,
    summary,
    userOptions,
    selectedUser,
    setSelectedUser,
    searchQuery,
    setSearchQuery,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    resetFilters,
    hasActiveFilters,
  } = useTokuseiSurveyFilter(data);

  const showLoadingState = status === 'loading' && data.length === 0;
  const totalCount = data.length;
  const filteredCount = filteredResponses.length;
  const isEmptyAll = status === 'success' && totalCount === 0;
  const isEmptyFiltered = status === 'success' && totalCount > 0 && filteredCount === 0;

  return (
    <Stack spacing={3}>
      {/* ── Page header ── */}
      <IBDPageHeader
        title="特性アンケート結果"
        subtitle="Microsoft Forms 由来の特性ヒアリング結果を SharePoint から自動同期"
        icon={<SupportAgentRoundedIcon />}
        actions={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip label={`回答数: ${summary.totalResponses}`} color="primary" variant="outlined" size="small" />
            <Chip label={`対象者: ${summary.uniqueUsers}`} variant="outlined" size="small" />
            <Chip label={`保護者/関係者: ${summary.uniqueGuardians}`} variant="outlined" size="small" />
            <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
              更新: {summary.latestSubmittedAt ? formatDateTime(summary.latestSubmittedAt) : '未取得'}
            </Typography>
            <Tooltip title="フィルターをリセット" placement="bottom">
              <Box component="span" sx={{ display: 'inline-flex' }}>
                <IconButton
                  onClick={resetFilters}
                  disabled={!hasActiveFilters}
                  size="small"
                  sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, width: 32, height: 32 }}
                >
                  <FilterAltOffRoundedIcon fontSize="small" />
                </IconButton>
              </Box>
            </Tooltip>
            <Tooltip title="最新の回答を取得" placement="bottom">
              <Box component="span" sx={{ display: 'inline-flex' }}>
                <IconButton
                  onClick={() => void refresh()}
                  disabled={status === 'loading'}
                  color="primary"
                  size="small"
                  sx={{ border: '1px solid', borderColor: 'primary.main', borderRadius: 1, width: 32, height: 32 }}
                >
                  <RefreshRoundedIcon fontSize="small" />
                </IconButton>
              </Box>
            </Tooltip>
            <Tooltip title={formsUrl ? 'Formsを開く' : 'VITE_TOKUSEI_FORMS_URL が未設定です'} placement="bottom">
              <Box component="span" sx={{ display: 'inline-flex' }}>
                <Button
                  variant="contained"
                  color="secondary"
                  size="small"
                  onClick={() => formsUrl && window.open(formsUrl, '_blank', 'noreferrer')}
                  disabled={!formsUrl}
                  sx={{ height: 32, whiteSpace: 'nowrap', fontSize: '0.75rem' }}
                >
                  Formsを開く
                </Button>
              </Box>
            </Tooltip>
          </Stack>
        }
      />

      <Paper sx={{ p: 3 }}>
        {/* ── Filter bar ── */}
        <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 2, mb: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 200, flexGrow: { xs: 1, sm: 0 } }}>
            <InputLabel id="tokusei-target-label">対象者フィルター</InputLabel>
            <Select
              labelId="tokusei-target-label"
              label="対象者フィルター"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
            >
              <MenuItem value="all">すべて</MenuItem>
              {userOptions.map((name) => (
                <MenuItem key={name} value={name}>{name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 220, flexGrow: { xs: 1, sm: 0 } }}>
            <InputLabel htmlFor="tokusei-search">検索（氏名・回答者）</InputLabel>
            <OutlinedInput
              id="tokusei-search"
              label="検索（氏名・回答者）"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="例: 佐藤 / 保護者"
            />
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160, flexGrow: { xs: 1, sm: 0 } }}>
            <InputLabel shrink>回答日(開始)</InputLabel>
            <OutlinedInput type="date" notched value={fromDate} onChange={(e) => setFromDate(e.target.value)} label="回答日(開始)" />
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160, flexGrow: { xs: 1, sm: 0 } }}>
            <InputLabel shrink>回答日(終了)</InputLabel>
            <OutlinedInput type="date" notched value={toDate} onChange={(e) => setToDate(e.target.value)} label="回答日(終了)" />
          </FormControl>
        </Stack>

        {/* ── Loading ── */}
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

        {/* ── Error ── */}
        {status === 'error' && error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={<Button color="inherit" size="small" onClick={() => void refresh()}>再試行</Button>}
          >
            {error.message}
          </Alert>
        )}

        {/* ── Empty: no data at all ── */}
        {isEmptyAll && (
          <TokuseiEmptyState variant="all" hasFormsUrl={Boolean(formsUrl)} formsUrl={formsUrl} />
        )}

        {/* ── Content: list + detail ── */}
        {!showLoadingState && !isEmptyAll && (
          isEmptyFiltered ? (
            <TokuseiEmptyState
              variant="filtered"
              hasFormsUrl={Boolean(formsUrl)}
              formsUrl={formsUrl}
              onResetFilters={resetFilters}
            />
          ) : (
            <Box mt={1} display="grid" gridTemplateColumns={{ xs: '1fr', md: '5fr 7fr' }} gap={3}>
              {/* Response list */}
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
                                <Typography fontWeight={600}>
                                  {response.targetUserName || '対象者未入力'}
                                </Typography>
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

              {/* Response detail */}
              <Paper variant="outlined" sx={{ p: 2.5, height: '100%' }}>
                <TokuseiResponseDetail
                  response={activeResponse}
                  isLoading={status === 'loading'}
                />
              </Paper>
            </Box>
          )
        )}
      </Paper>
    </Stack>
  );
};

export default TokuseiSurveyResultsPage;
