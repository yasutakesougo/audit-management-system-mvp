/**
 * CallLogPage — 電話・連絡ログページ
 *
 * 設計:
 * - タブで未対応 / 折返し待ち / 完了 / すべて を切り替える
 * - useCallLogs が "all" → status フィルタなし に変換する
 * - このページは Repository / SP を直接知らない（useCallLogs 経由のみ）
 * - 新規受付フォームは PR3 の CallLogQuickDrawer で実装予定
 * - `window.confirm` を使わない → MUI Dialog で代替（PR3 で実装）
 *   現在は updateStatus の button クリックで直接実行
 */

import { PageHeader } from '@/components/PageHeader';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import PhoneIcon from '@mui/icons-material/Phone';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CallLogStatusChip } from '@/features/callLogs/components/CallLogStatusChip';
import { CallLogUrgencyChip } from '@/features/callLogs/components/CallLogUrgencyChip';
import { CallLogQuickDrawer } from '@/features/callLogs/components/CallLogQuickDrawer';
import { useCallLogs, type CallLogTabValue } from '@/features/callLogs/hooks/useCallLogs';
import { filterCallLogs } from '@/features/callLogs/domain/filterCallLogs';
import { getCallbackDueInfo, type CallbackDueLevel } from '@/features/callLogs/domain/callbackDueLabel';
import { parseFilterPreset, getPresetConfig } from '@/features/callLogs/domain/callLogFilterPresets';
import { resolveNextCallAction } from '@/features/callLogs/domain/resolveNextCallAction';
import { groupCallLogsByPriority } from '@/features/callLogs/domain/groupCallLogsByPriority';
import { NextCallHero } from '@/features/callLogs/components/NextCallHero';
import { CallLogPriorityQueue } from '@/features/callLogs/components/CallLogPriorityQueue';
import { CTA_EVENTS, recordCtaClick } from '@/features/today/telemetry/recordCtaClick';
import type { CallLog } from '@/domain/callLogs/schema';

// ─── 日時フォーマットヘルパー ─────────────────────────────────────────────────

const formatDateTime = (iso: string): string => {
  try {
    return new Intl.DateTimeFormat('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

// ─── 期限チップカラーマップ ─────────────────────────────────────────────────────

const DUE_CHIP_COLOR: Record<CallbackDueLevel, 'error' | 'warning' | 'default' | 'info'> = {
  overdue: 'error',
  'due-soon': 'warning',
  'due-later': 'default',
  none: 'default',
};

// ─── タブ定義 ─────────────────────────────────────────────────────────────────

const TABS: { value: CallLogTabValue; label: string }[] = [
  { value: 'new', label: '未対応' },
  { value: 'callback_pending', label: '折返し待ち' },
  { value: 'done', label: '完了' },
  { value: 'all', label: 'すべて' },
];

// ─── ログ行コンポーネント ──────────────────────────────────────────────────────

type CallLogRowProps = {
  log: CallLog;
  onMarkDone: (id: string) => void;
  isUpdating: boolean;
};

const CallLogRow: React.FC<CallLogRowProps> = ({ log, onMarkDone, isUpdating }) => {
  const dueInfo = getCallbackDueInfo(log);

  return (
  <ListItem
    divider
    data-testid={`call-log-row-${log.id}`}
    secondaryAction={
      log.status !== 'done' ? (
        <Tooltip title="完了にする">
          <span>
            <IconButton
              size="small"
              color="success"
              onClick={() => onMarkDone(log.id)}
              disabled={isUpdating}
              data-testid={`call-log-done-btn-${log.id}`}
              aria-label={`${log.callerName}からの連絡を完了にする`}
            >
              <CheckCircleOutlineIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      ) : null
    }
    sx={{ py: 1.5 }}
  >
    <ListItemText
      primary={
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
          <Typography variant="body2" fontWeight={600}>
            {log.subject}
          </Typography>
          <CallLogStatusChip status={log.status} />
          <CallLogUrgencyChip urgency={log.urgency} />
        </Stack>
      }
      secondary={
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" mt={0.5}>
          <Typography variant="caption" color="text.secondary">
            {formatDateTime(log.receivedAt)}
          </Typography>
          <Chip
            label={`発信: ${log.callerName}${log.callerOrg ? ` (${log.callerOrg})` : ''}`}
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.7rem', height: 20 }}
          />
          <Chip
            label={`担当: ${log.targetStaffName}`}
            size="small"
            variant="outlined"
            color="primary"
            sx={{ fontSize: '0.7rem', height: 20 }}
          />
          {log.relatedUserName && (
            <Chip
              icon={<PersonOutlineIcon sx={{ fontSize: 14 }} />}
              label={log.relatedUserName}
              size="small"
              variant="outlined"
              color="secondary"
              sx={{ fontSize: '0.7rem', height: 20 }}
              data-testid={`call-log-related-user-${log.id}`}
            />
          )}
          {dueInfo.level !== 'none' && (
            <Chip
              icon={<AccessTimeIcon sx={{ fontSize: 14 }} />}
              label={dueInfo.label}
              size="small"
              variant={dueInfo.level === 'overdue' ? 'filled' : 'outlined'}
              color={DUE_CHIP_COLOR[dueInfo.level]}
              sx={{ fontSize: '0.7rem', height: 20, fontWeight: dueInfo.level === 'overdue' ? 700 : 400 }}
              data-testid={`call-log-due-chip-${log.id}`}
            />
          )}
        </Stack>
      }
    />
  </ListItem>
  );
};

// ─── Page ────────────────────────────────────────────────────────────────────

export const CallLogPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<CallLogTabValue>('new');
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ── フィルタ state ──
  const [keyword, setKeyword] = useState('');
  const [onlyWithRelatedUser, setOnlyWithRelatedUser] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // ── URL search params からフィルタプリセットを復元 ──
  useEffect(() => {
    const filterParam = searchParams.get('filter');
    const preset = parseFilterPreset(filterParam);
    if (preset) {
      const config = getPresetConfig(preset);
      setActiveTab(config.tab);
      setKeyword(config.keyword);
      setOnlyWithRelatedUser(config.onlyWithRelatedUser);
      setActivePreset(config.label);
      // 消費後に URL から filter param を削除（ブラウザバック時に再適用されないように）
      searchParams.delete('filter');
      setSearchParams(searchParams, { replace: true });
    }
  }, []); // eslint-disable-line

  const { logs, isLoading, error, updateStatus, refresh } = useCallLogs({
    activeTab,
  });

  // ── ZONE A/B 用: 全ログ取得（タブに依存しない） ──
  const { logs: allLogs } = useCallLogs({ activeTab: 'all' });

  const nextAction = useMemo(
    () => resolveNextCallAction(allLogs ?? []),
    [allLogs],
  );

  const priorityGroups = useMemo(
    () => groupCallLogsByPriority(allLogs ?? []),
    [allLogs],
  );

  // ── クライアントサイドフィルタ適用 ──
  const filteredLogs = useMemo(() => {
    if (!logs) return undefined;
    return filterCallLogs(logs, {
      keyword,
      onlyWithRelatedUser,
    });
  }, [logs, keyword, onlyWithRelatedUser]);

  const handleTabChange = (_: React.SyntheticEvent, value: CallLogTabValue) => {
    setActiveTab(value);
  };

  const handleMarkDone = (id: string) => {
    updateStatus.mutate({ id, status: 'done' });
  };

  // ── ZONE A: Hero 「完了にする」 ──
  const handleHeroDone = (id: string) => {
    recordCtaClick({
      ctaId: CTA_EVENTS.CALLLOG_HERO_DONE,
      sourceComponent: 'NextCallHero',
      stateType: 'widget-action',
      priority: nextAction?.reason,
    });
    updateStatus.mutate({ id, status: 'done' });
  };

  // ── ZONE B: Queue 行クリック ──
  const handlePriorityItemClick = () => {
    recordCtaClick({
      ctaId: CTA_EVENTS.CALLLOG_PRIORITY_ITEM,
      sourceComponent: 'CallLogPriorityQueue',
      stateType: 'widget-action',
    });
  };

  // ── ZONE B: Queue 「完了にする」 ──
  const handlePriorityDone = (id: string) => {
    recordCtaClick({
      ctaId: CTA_EVENTS.CALLLOG_PRIORITY_DONE,
      sourceComponent: 'CallLogPriorityQueue',
      stateType: 'widget-action',
    });
    updateStatus.mutate({ id, status: 'done' });
  };

  const isUpdating = updateStatus.isPending;
  const hasActiveFilter = !!keyword.trim() || onlyWithRelatedUser || !!activePreset;

  const handleClearFilters = () => {
    setKeyword('');
    setOnlyWithRelatedUser(false);
    setActivePreset(null);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <Container maxWidth="lg" sx={{ py: 2 }} data-testid="call-log-page">
      {/* ヘッダー */}
      <PageHeader
        title="電話・連絡ログ"
        subtitle="受電・伝言の受付と対応管理"
        icon={<PhoneIcon />}
        headingId="call-log-page-heading"
        actions={
          <Stack direction="row" spacing={1}>
            <Tooltip title="更新">
              <IconButton
                size="small"
                onClick={refresh}
                disabled={isLoading}
                data-testid="call-log-refresh-btn"
                aria-label="一覧を更新"
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              data-testid="call-log-new-btn"
              onClick={() => setDrawerOpen(true)}
            >
              新規受付
            </Button>
          </Stack>
        }
      />

      {/* ── ZONE A: Next Call Hero ── */}
      <NextCallHero
        action={nextAction}
        onMarkDone={handleHeroDone}
        isUpdating={isUpdating}
      />

      {/* ── ZONE B: Priority Queue ── */}
      <CallLogPriorityQueue
        groups={priorityGroups}
        heroLogId={nextAction?.log.id}
        onMarkDone={handlePriorityDone}
        isUpdating={isUpdating}
        onItemClick={handlePriorityItemClick}
      />

      <Divider sx={{ my: 2 }} />

      {/* タブ */}
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        aria-label="電話ログ表示フィルタ"
        sx={{ mb: 2 }}
        data-testid="call-log-tabs"
      >
        {TABS.map((tab) => (
          <Tab
            key={tab.value}
            value={tab.value}
            label={tab.label}
            id={`call-log-tab-${tab.value}`}
            aria-controls={`call-log-tabpanel-${tab.value}`}
            data-testid={`call-log-tab-${tab.value}`}
          />
        ))}
      </Tabs>

      {/* フィルタバー */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ sm: 'center' }}
        sx={{ mb: 2 }}
        data-testid="call-log-filter-bar"
      >
        <TextField
          size="small"
          placeholder="キーワード検索…"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
            endAdornment: keyword ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => setKeyword('')}
                  aria-label="検索をクリア"
                  data-testid="call-log-keyword-clear"
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
          inputProps={{
            'data-testid': 'call-log-keyword-input',
          }}
          sx={{ minWidth: 200, flexGrow: 1, maxWidth: 400 }}
        />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={onlyWithRelatedUser}
              onChange={(e) => setOnlyWithRelatedUser(e.target.checked)}
              data-testid="call-log-filter-related-user-toggle"
            />
          }
          label={
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <PersonOutlineIcon sx={{ fontSize: 16 }} />
              利用者紐付けあり
            </Typography>
          }
        />
        {hasActiveFilter && (
          <Button
            size="small"
            onClick={handleClearFilters}
            data-testid="call-log-filter-clear-all"
          >
            フィルタ解除
          </Button>
        )}
      </Stack>

      {/* コンテンツ */}
      <Box
        role="tabpanel"
        id={`call-log-tabpanel-${activeTab}`}
        aria-labelledby={`call-log-tab-${activeTab}`}
        data-testid="call-log-tabpanel"
      >
        {/* ローディング状態 */}
        {isLoading && (
          <Box display="flex" justifyContent="center" py={6} data-testid="call-log-loading">
            <CircularProgress size={32} aria-label="読み込み中" />
          </Box>
        )}

        {/* エラー状態 */}
        {!isLoading && error && (
          <Alert
            severity="error"
            sx={{ mt: 2 }}
            data-testid="call-log-error"
            action={
              <Button color="inherit" size="small" onClick={refresh}>
                再試行
              </Button>
            }
          >
            データの取得に失敗しました。ネットワーク接続を確認して再試行してください。
          </Alert>
        )}

        {/* 更新エラー */}
        {updateStatus.isError && (
          <Alert severity="error" sx={{ mt: 1 }} data-testid="call-log-update-error">
            ステータスの更新に失敗しました。
          </Alert>
        )}

        {/* 空状態（データ自体が0件） */}
        {!isLoading && !error && filteredLogs && filteredLogs.length === 0 && !hasActiveFilter && (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            py={8}
            gap={1}
            data-testid="call-log-empty"
          >
            <PhoneIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
            <Typography variant="body2" color="text.secondary">
              該当するログはありません
            </Typography>
          </Box>
        )}

        {/* フィルタ結果0件 */}
        {!isLoading && !error && filteredLogs && filteredLogs.length === 0 && hasActiveFilter && (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            py={8}
            gap={1}
            data-testid="call-log-filter-empty"
          >
            <SearchIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
            <Typography variant="body2" color="text.secondary">
              条件に一致するログはありません
            </Typography>
            <Button
              size="small"
              onClick={handleClearFilters}
              data-testid="call-log-filter-empty-clear"
            >
              フィルタを解除
            </Button>
          </Box>
        )}

        {/* ログ一覧 */}
        {!isLoading && !error && filteredLogs && filteredLogs.length > 0 && (
          <>
            {hasActiveFilter && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: 1, display: 'block' }}
                data-testid="call-log-filter-count"
              >
                {filteredLogs.length}件 / {logs?.length ?? 0}件中
              </Typography>
            )}
            <List disablePadding data-testid="call-log-list">
              {filteredLogs.map((log) => (
                <CallLogRow
                  key={log.id}
                  log={log}
                  onMarkDone={handleMarkDone}
                  isUpdating={isUpdating}
                />
              ))}
            </List>
          </>
        )}
      </Box>

      {/* 新規受付ドロワー（リストへの反映は useCallLogs の invalidation で自動化） */}
      <CallLogQuickDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </Container>
  );
};

export default CallLogPage;
