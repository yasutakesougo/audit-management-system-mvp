import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  IconButton,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import PrintIcon from '@mui/icons-material/Print';

/**
 * ミーティングガイド（朝/夕）
 * - 画面から印刷（A4想定）しやすい簡易ガイド
 * - コントロールパネル：対象日・再読込・フィルタ
 * - 本日のサマリー：通所者 / 職員体制（ダミー表示）
 * - セクション：朝会（非常勤向け）/ 夕会（常勤向け）
 *
 * 必要に応じて実データ連携・表示差し替え可能です。
 */

const todayYYYYMMDD = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
  .toISOString()
  .slice(0, 10);


const makeInitials = (name: string) => {
  const p = name.trim().split(/\s+/);
  if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase();
  return p[0]?.slice(0, 2).toUpperCase() ?? '??';
};

const rotate = <T,>(arr: T[], n: number): T[] => {
  if (!arr.length) return arr;
  const k = ((n % arr.length) + arr.length) % arr.length;
  return k === 0 ? arr.slice() : arr.slice(k).concat(arr.slice(0, k));
};

const MeetingGuidePage: React.FC = () => {
  // UI state（実データ接続前のダミー）
  const [date, setDate] = useState<string>(todayYYYYMMDD());
  const [includeAll, setIncludeAll] = useState<boolean>(false);
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  // ダミー一覧（必要になったら実データに差し替え）
  const attendees = useMemo(() => {
    const base = includeAll
      ? ['田中 聡', '加藤 結衣', '中村 真', '山本 蓮', '佐々木 雫', '石川 悠']
      : ['田中 聡', '加藤 結衣', '中村 真'];
    return rotate(base, reloadNonce);
  }, [includeAll, reloadNonce]);
  const staffs = useMemo(() => {
    const base = includeAll
      ? ['鈴木 茂', '山本 花子', '佐藤 真一', '大谷 咲', '三浦 海斗', '青木 瞬', '木村 沙耶', '江口 雅']
      : ['鈴木 茂', '山本 花子', '佐藤 真一', '大谷 咲'];
    return rotate(base, reloadNonce);
  }, [includeAll, reloadNonce]);

  const handleReload = () => setReloadNonce(n => n + 1);
  const handlePrint = () => window.print();

  return (
    <Container maxWidth="lg" data-testid="meeting-guide-root">
      {/* 印刷用スタイル（ヘッダ操作系を非表示） */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-card { break-inside: avoid; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* ヘッダー */}
      <Box py={4}>
        <Paper elevation={3} sx={{ p: 3, mb: 3, background: 'linear-gradient(135deg,#eef2ff 0%,#f5f3ff 100%)' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
            <Stack direction="row" alignItems="center" gap={1.5}>
              <CalendarMonthIcon color="primary" sx={{ fontSize: 36 }} />
              <Box>
                <Typography variant="h4" fontWeight={800}>ミーティングガイド</Typography>
                <Typography variant="body2" color="text.secondary">
                  朝会：非常勤向け／夕会：常勤向け — 日次の共有・振り返り・翌日準備
                </Typography>
              </Box>
            </Stack>
            <Stack className="no-print" direction="row" alignItems="center" gap={1.5}>
              <TextField
                type="date"
                size="small"
                label="対象日"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <IconButton aria-label="再読込" onClick={handleReload} color="primary">
                <RefreshIcon />
              </IconButton>
              <Button
                startIcon={<PrintIcon />}
                variant="outlined"
                onClick={handlePrint}
              >
                印刷
              </Button>
            </Stack>
          </Stack>

          {/* フィルタ・ステータス */}
          <Stack className="no-print" direction="row" alignItems="center" gap={2} mt={2} flexWrap="wrap">
            <Stack direction="row" alignItems="center" gap={1}>
              <Switch
                checked={includeAll}
                onChange={(_, v) => setIncludeAll(v)}
                inputProps={{ 'aria-label': '全メンバー表示' }}
              />
              <Typography variant="body2">
                本日出勤/通所以外も表示
              </Typography>
            </Stack>
            <Chip label={`状態: 正常（ダミー表示）`} color="success" variant="outlined" />
          </Stack>
        </Paper>

        {/* 本日のサマリー */}
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
          <Card className="print-card" sx={{ flex: 1 }} elevation={1}>
            <CardContent>
              <Typography variant="h6" fontWeight={700}>
                本日の通所者 <Chip size="small" color="primary" label={`${attendees.length} 名`} sx={{ ml: 1 }} />
              </Typography>
              <Stack direction="row" gap={1} flexWrap="wrap" mt={1}>
                {attendees.slice(0, 5).map((n) => (
                  <Chip
                    key={n}
                    avatar={<Box component="span" sx={{
                      width: 24, height: 24, borderRadius: '50%',
                      bgcolor: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, border: theme => `1px solid ${theme.palette.divider}`,
                    }}>{makeInitials(n)}</Box>}
                    label={n}
                    variant="outlined"
                    color="primary"
                  />
                ))}
              </Stack>
              {attendees.length > 5 && (
                <Box textAlign="right" mt={1}>
                  <Button variant="text" size="small">すべて表示（+{attendees.length - 5}）</Button>
                </Box>
              )}
            </CardContent>
          </Card>

          <Card className="print-card" sx={{ flex: 1 }} elevation={1}>
            <CardContent>
              <Typography variant="h6" fontWeight={700}>
                本日の職員体制 <Chip size="small" color="primary" label={`${staffs.length} 名`} sx={{ ml: 1 }} />
              </Typography>
              <Stack direction="row" gap={1} flexWrap="wrap" mt={1}>
                {staffs.slice(0, 6).map((n) => (
                  <Chip
                    key={n}
                    avatar={<Box component="span" sx={{
                      width: 24, height: 24, borderRadius: '50%',
                      bgcolor: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, border: theme => `1px solid ${theme.palette.divider}`,
                    }}>{makeInitials(n)}</Box>}
                    label={n}
                    variant="outlined"
                    color="warning"
                  />
                ))}
              </Stack>
              {staffs.length > 6 && (
                <Box textAlign="right" mt={1}>
                  <Button variant="text" size="small">すべて表示（+{staffs.length - 6}）</Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Stack>

        {/* 本文：朝/夕 */}
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2} mt={3}>
          <Paper className="print-card" sx={{ p: 2 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>朝会（非常勤向け）</Typography>
            <ol style={{ paddingLeft: '1.25rem', lineHeight: 1.8, fontSize: '0.95rem', margin: 0 }}>
              <li>前日のトピックス共有（事故/ヒヤリは別途詳細へ）</li>
              <li>当日の流れ（活動・送迎・昼食・外出の有無）</li>
              <li>申し送り（服薬・体調・支援上の留意点）</li>
              <li>担当割の確認（支援・送迎・昼食等）</li>
            </ol>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" color="text.secondary">
              ※ 本日の通所者と職員体制は画面上部のサマリをご参照ください。
            </Typography>
          </Paper>

          <Paper className="print-card" sx={{ p: 2 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>夕会（常勤向け）</Typography>
            <ol style={{ paddingLeft: '1.25rem', lineHeight: 1.8, fontSize: '0.95rem', margin: 0 }}>
              <li>日中の振り返り（良かった点・課題・ヒヤリ）</li>
              <li>問題行動の共有と対応（必要に応じて次の一手を検討）</li>
              <li>明日の流れ・人員配置の確認</li>
              <li>各担当からの連絡事項（看護・給食・送迎・事務）</li>
            </ol>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" color="text.secondary">
              ※ 印刷時はヘッダーの操作類は非表示、本文のみA4最適化で出力されます。
            </Typography>
          </Paper>
        </Stack>

        {/* フッター：対象日メモ */}
        <Box mt={3} textAlign="right" color="text.secondary">
          <Typography variant="caption">対象日: {date}／更新: {new Date().toLocaleString('ja-JP')}</Typography>
        </Box>
      </Box>
    </Container>
  );
};

export default MeetingGuidePage;
