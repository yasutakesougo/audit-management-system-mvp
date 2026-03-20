/**
 * AbcRecordPage — ABC 行動記録ページ
 *
 * 2つのモードをタブで切替：
 *   📝 簡易記録 — 現場でサッと30秒〜1分で入力
 *   📋 記録一覧 — 利用者別・日付・強度・危険度で絞り込み
 *
 * @route /abc-record
 */
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';

// ── MUI ──
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

// ── Icons ──
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';

// ── Domain ──
import type { AbcRecord, AbcRecordSourceContext } from '@/domain/abc/abcRecord';
import { localAbcRecordRepository } from '@/infra/localStorage/localAbcRecordRepository';
import { useUsers } from '@/features/users/useUsers';
import { useAuth } from '@/auth/useAuth';

// ── Local ──
import type { UserOption } from './types';
import QuickRecordTab from './QuickRecordTab';
import LogTab from './LogTab';

const AbcRecordPage: React.FC = () => {
  const [tab, setTab] = useState(0);
  const [records, setRecords] = useState<AbcRecord[]>([]);
  const { data: users } = useUsers();
  const { account } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  // MVP-5: navigate state から下書きデータを取得
  const navState = (location.state ?? {}) as { draftBehavior?: string; draftSlotId?: string };
  const initialBehavior = navState.draftBehavior;

  // URL パラメータ
  const urlUserId = searchParams.get('userId') ?? undefined;
  const urlRecordId = searchParams.get('recordId') ?? undefined;
  const source = searchParams.get('source') ?? undefined;
  const urlSlotId = searchParams.get('slotId') ?? undefined;
  const urlDate = searchParams.get('date') ?? undefined;
  const urlReturnUrl = searchParams.get('returnUrl') ?? undefined;
  const [deepLinkProcessed, setDeepLinkProcessed] = useState(false);
  const [deepLinkBanner, setDeepLinkBanner] = useState(false);

  // ── daily-support からの遷移コンテキスト ──
  const supportContext = useMemo(() => {
    if (source !== 'daily-support' || !urlSlotId) return null;
    // slotId format: "09:00|朝の受け入れ" (getScheduleKey format)
    const parts = urlSlotId.split('|');
    const time = parts[0] ?? '';
    const activity = parts.slice(1).join('|') ?? '';
    return { time, activity, date: urlDate };
  }, [source, urlSlotId, urlDate]);

  // sourceContext を保存用に組み立てる
  const sourceContextForSave = useMemo((): AbcRecordSourceContext | undefined => {
    if (source === 'daily-support') {
      return {
        source: 'daily-support',
        slotId: urlSlotId,
        date: urlDate,
      };
    }
    return undefined;
  }, [source, urlSlotId, urlDate]);

  const recorderName = (account as { name?: string })?.name ?? '不明';

  const userOptions = useMemo<UserOption[]>(
    () => users.map(u => ({ id: u.UserID, label: `${u.FullName} (${u.UserID})` })),
    [users],
  );

  // URL userId に対応するユーザー名
  const contextUserName = useMemo(() => {
    if (!urlUserId) return null;
    const found = users.find(u => u.UserID === urlUserId);
    return found?.FullName ?? null;
  }, [urlUserId, users]);

  const loadRecords = useCallback(async () => {
    const all = await localAbcRecordRepository.getAll();
    setRecords(all);
  }, []);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  // ── Deep link: recordId → 自動で記録一覧タブ + 詳細ダイアログを開く ──
  useEffect(() => {
    if (!urlRecordId || deepLinkProcessed || records.length === 0) return;
    const target = records.find(r => r.id === urlRecordId);
    if (target) {
      setTab(1); // 記録一覧タブへ切替
      // LogTab内のdetailRecordはLogTabのlocal stateなので、
      // 代わりにfocusedRecordIdを使ってLogTabに伝える
      setFocusedRecordId(urlRecordId);
      setDeepLinkBanner(true);
      setDeepLinkProcessed(true);
      // バナーを4秒後に消す
      const timer = setTimeout(() => setDeepLinkBanner(false), 4000);
      return () => clearTimeout(timer);
    } else {
      // 対象が見つからない場合
      setDeepLinkProcessed(true);
    }
  }, [urlRecordId, records, deepLinkProcessed]);

  // 追加state: LogTab に渡す focused record ID
  const [focusedRecordId, setFocusedRecordId] = useState<string | undefined>(undefined);

  // 今日の記録（対象ユーザーに絞る）
  const todayRecords = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return records
      .filter(r => r.occurredAt.slice(0, 10) === today && (!urlUserId || r.userId === urlUserId))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }, [records, urlUserId]);

  const handleBack = useCallback(() => {
    if (source === 'support-planning') {
      navigate(-1);
    } else if (source === 'daily-support' && urlReturnUrl) {
      // 支援手順の元のユーザー・ステップへ正確に戻る
      navigate(urlReturnUrl);
    } else if (source === 'daily-support') {
      navigate(-1);
    } else {
      navigate('/daily/support');
    }
  }, [source, navigate, urlReturnUrl]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, pb: 4, maxWidth: 800, mx: 'auto' }}>
      <Stack spacing={2.5}>
        {/* ── ヘッダー ── */}
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
              <Stack direction="row" spacing={1.5} alignItems="center">
                {/* 戻るボタン */}
                <Button
                  startIcon={<ArrowBackRoundedIcon />}
                  onClick={handleBack}
                  size="small"
                  sx={{ textTransform: 'none', mr: 0.5 }}
                >
                  {source === 'support-planning' ? '支援計画シートへ戻る' : '支援手順へ戻る'}
                </Button>
                <EditNoteRoundedIcon color="primary" fontSize="large" />
                <Box>
                  <Typography variant="h5" fontWeight={700}>
                    {contextUserName ? `${contextUserName} さんのABC記録` : 'ABC 行動記録'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {contextUserName
                      ? `${new Date().toLocaleDateString('ja-JP')} — 行動の前後関係を素早く記録`
                      : '行動の前後関係を記録して支援計画に活かす'}
                  </Typography>
                </Box>
              </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                icon={<AddCircleOutlineRoundedIcon />}
                label={`全${records.length} 件`}
                variant="outlined"
                color="primary"
              />
              {todayRecords.length > 0 && (
                <Chip
                  label={`今日 ${todayRecords.length} 件`}
                  size="small"
                  color="info"
                  variant="filled"
                />
              )}
            </Stack>
            </Stack>

            {/* ── 支援手順コンテキストバナー ── */}
            {supportContext && (
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  bgcolor: 'info.50',
                  borderColor: 'info.200',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  borderRadius: 1.5,
                }}
              >
                <AccessTimeRoundedIcon fontSize="small" color="info" />
                <Typography variant="body2" color="text.secondary">
                  支援手順から：
                  <Typography component="span" variant="body2" fontWeight={600} color="text.primary">
                    {supportContext.time} {supportContext.activity}
                  </Typography>
                  {supportContext.date && (
                    <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                      ({supportContext.date})
                    </Typography>
                  )}
                </Typography>
              </Paper>
            )}
          </Stack>
        </Paper>

        {/* ── Tabs ── */}
        <Paper variant="outlined">
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
            <Tab label="📝 簡易記録" sx={{ fontWeight: 600 }} />
            <Tab label={`📋 記録一覧 (${records.length})`} sx={{ fontWeight: 600 }} />
          </Tabs>
        </Paper>

        {/* ── Tab Panels ── */}
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
          {tab === 0 ? (
            <QuickRecordTab
              users={userOptions}
              recorderName={recorderName}
              onSaved={loadRecords}
              initialUserId={urlUserId}
              todayRecords={todayRecords}
              sourceContext={sourceContextForSave}
              initialBehavior={initialBehavior}
            />
          ) : (
            <LogTab
              records={records}
              users={userOptions}
              onRefresh={loadRecords}
              focusedRecordId={focusedRecordId}
              deepLinkBanner={deepLinkBanner}
            />
          )}
        </Paper>
      </Stack>
    </Box>
  );
};

export default AbcRecordPage;
