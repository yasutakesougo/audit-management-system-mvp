import CloseIcon from '@mui/icons-material/Close';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import {
    AppBar,
    Box,
    Button,
    Toolbar,
    Typography,
} from '@mui/material';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';

type FullScreenDailyDialogPageProps = {
  open?: boolean;
  title: string;
  backTo?: string;
  busy?: boolean;
  onClose?: () => void;
  testId?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * 日次系 feature の共通フルスクリーンダイアログシェル
 *
 * 使用規約:
 * 1. 日次系の全画面入力画面（一覧記録, 個別記録, 一括記録）で共通使用する
 * 2. headerActions には compact な操作ボタン群を渡す（高さ 30px 以下推奨）
 * 3. children にはフォームコンテンツ（DialogContent 配下）を渡す
 * 4. busy=true で全操作をブロック（Escキー含む）
 * 5. onClose は安全なナビゲーション（未保存確認は呼び出し側の責務）
 *
 * 必須 props:
 * - title — ページタイトル（AppBar に表示）
 * - children — フォームコンテンツ
 *
 * オプション props:
 * - open — 表示制御（default: true）
 * - backTo — 戻り先パス（default: /daily/menu）
 * - testId — テスト用 ID
 * - busy — 処理中フラグ(true で閉じるボタン無効化)
 * - onClose — カスタム閉じ処理。未指定時は navigate(backTo)
 * - headerActions — AppBar 右側に配置するアクション群
 *
 * 推奨 headerActions 構成（TableDailyRecordPage の例）:
 * - 日付セレクタ
 * - 記録者名
 * - 役職セレクタ
 * - ディバイダ
 * - ユーザー数バッジ
 * - 未送信フィルタ
 * - 下書きステータス
 * - ディバイダ
 * - 下書き保存ボタン
 * - 確定保存ボタン
 */
export function FullScreenDailyDialogPage({
  open = true,
  title,
  backTo = '/daily/menu',
  busy = false,
  onClose,
  testId,
  headerActions,
  children,
}: FullScreenDailyDialogPageProps) {
  const navigate = useNavigate();

  const handleClose = React.useCallback(() => {
    if (busy) return;
    if (onClose) return onClose();
    navigate(backTo, { replace: true });
  }, [busy, onClose, navigate, backTo]);

  const handleHubClick = React.useCallback(() => {
    navigate('/dailysupport');
  }, [navigate]);

  // ✅ 背景スクロール防止（フルスクリーン時に背面が動かないように）
  React.useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  // ✅ Esc キーで戻る（Dialog 互換の UX）
  React.useEffect(() => {
    if (!open || busy) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, busy, handleClose]);

  // ✅ Dialog → fixed Box に置換（root 構造最適化）
  if (!open) return null;

  return (
    <Box
      data-testid={testId}
      sx={{
        position: 'fixed',
        inset: 0,
        bgcolor: 'background.default',
        zIndex: 1300,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <AppBar position="sticky" color="default" elevation={1}>
        <Toolbar variant="dense" sx={{ gap: 0.5, minWidth: 0 }}>
          <Button
            onClick={handleClose}
            startIcon={<CloseIcon fontSize="small" />}
            variant="text"
            size="small"
            sx={{ minWidth: 90, fontSize: '0.8rem', flexShrink: 0 }}
            disabled={busy}
            data-testid="daily-dialog-close"
          >
            キャンセル
          </Button>

          <Typography
            sx={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            variant="subtitle1"
            component="h1"
            data-page-heading="true"
          >
            {title}
          </Typography>

          {headerActions}

          <Button
            onClick={handleHubClick}
            startIcon={<HomeOutlinedIcon fontSize="small" />}
            variant="outlined"
            size="small"
            sx={{ minHeight: 32, fontSize: '0.78rem', px: 1.5, flexShrink: 0 }}
          >
            日次ハブ
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {children}
      </Box>
    </Box>
  );
}
