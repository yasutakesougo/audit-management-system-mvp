/**
 * モード切替ページ
 *
 * デモモード ⇄ 通常モード をパスワード認証で切り替える。
 * localStorage の `skipLogin` フラグを操作して、
 * アプリ全体のログイン・認証挙動を切り替える。
 *
 * デモモード ON  → skipLogin=1 → 自動admin → 全メニュー表示
 * デモモード OFF → skipLogin 削除 → MSAL認証が必要
 */

import PageHeader from '@/components/PageHeader';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    InputAdornment,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import React, { useCallback, useMemo, useState } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEMO_STORAGE_KEY = 'skipLogin';
const PASSWORD_HASH_KEY = 'admin.modeSwitch.passwordHash';

/**
 * デフォルトパスワード: "kuronote2026"
 * SHA-256 ハッシュ（クライアントサイドなので基本的な保護のみ）
 */
const DEFAULT_PASSWORD = 'kuronote2026';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isDemoMode(): boolean {
  try {
    const flag = localStorage.getItem(DEMO_STORAGE_KEY);
    if (!flag) return false;
    const normalized = flag.trim().toLowerCase();
    return normalized === '1' || normalized === 'true';
  } catch {
    return false;
  }
}

function setDemoMode(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(DEMO_STORAGE_KEY, '1');
    } else {
      localStorage.removeItem(DEMO_STORAGE_KEY);
    }
  } catch {
    console.warn('[ModeSwitchPage] Failed to update localStorage');
  }
}

async function hashPassword(password: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // フォールバック: 単純比較
  return password;
}

function getStoredPasswordHash(): string | null {
  try {
    return localStorage.getItem(PASSWORD_HASH_KEY);
  } catch {
    return null;
  }
}

function setPasswordHash(hash: string): void {
  try {
    localStorage.setItem(PASSWORD_HASH_KEY, hash);
  } catch {
    // noop
  }
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

type PasswordDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title: string;
  description: string;
};

const PasswordDialog: React.FC<PasswordDialogProps> = ({
  open,
  onClose,
  onSuccess,
  title,
  description,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!password.trim()) {
      setError('パスワードを入力してください');
      return;
    }

    setVerifying(true);
    setError('');

    try {
      const inputHash = await hashPassword(password.trim());

      // 保存済みハッシュがあればそれと比較、なければデフォルトと比較
      const storedHash = getStoredPasswordHash();
      const defaultHash = await hashPassword(DEFAULT_PASSWORD);

      // 初回はデフォルトパスワードのハッシュを保存
      if (!storedHash) {
        setPasswordHash(defaultHash);
      }

      const targetHash = storedHash || defaultHash;

      if (inputHash === targetHash) {
        setPassword('');
        setError('');
        onSuccess();
      } else {
        setError('パスワードが正しくありません');
      }
    } catch {
      setError('認証処理でエラーが発生しました');
    } finally {
      setVerifying(false);
    }
  }, [password, onSuccess]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleClose = useCallback(() => {
    setPassword('');
    setError('');
    onClose();
  }, [onClose]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LockRoundedIcon color="primary" />
        {title}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>

        <TextField
          autoFocus
          fullWidth
          type={showPassword ? 'text' : 'password'}
          label="管理パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          error={!!error}
          helperText={error}
          disabled={verifying}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                    size="small"
                  >
                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={verifying}>
          キャンセル
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={verifying || !password.trim()}
          startIcon={<SecurityRoundedIcon />}
        >
          {verifying ? '認証中...' : '認証して切替'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

const ModeSwitchPage: React.FC = () => {
  const [currentMode, setCurrentMode] = useState(isDemoMode);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<boolean | null>(null);
  const [switched, setSwitched] = useState(false);

  const handleSwitchRequest = useCallback((toDemo: boolean) => {
    setPendingMode(toDemo);
    setDialogOpen(true);
  }, []);

  const handlePasswordSuccess = useCallback(() => {
    setDialogOpen(false);

    if (pendingMode !== null) {
      setDemoMode(pendingMode);
      setCurrentMode(pendingMode);
      setSwitched(true);

      // 2秒後にリロード（ユーザーが結果を確認できるように）
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  }, [pendingMode]);

  const dialogTitle = useMemo(() => {
    return pendingMode ? 'デモモードに切替' : '通常モードに切替';
  }, [pendingMode]);

  const dialogDescription = useMemo(() => {
    return pendingMode
      ? 'デモモードでは認証をスキップし、全機能が利用可能になります。管理パスワードを入力して切り替えてください。'
      : '通常モードではMSAL認証が必要になります。管理パスワードを入力して切り替えてください。';
  }, [pendingMode]);

  return (
    <Box sx={{ p: 3, maxWidth: 700, mx: 'auto' }}>
      <PageHeader title="モード切替" />

      {switched && (
        <Alert severity="success" sx={{ mb: 3 }} icon={<CheckCircleIcon />}>
          モードを切り替えました。2秒後にページをリロードします...
        </Alert>
      )}

      {/* 現在のモード表示 */}
      <Card
        variant="outlined"
        sx={{
          mb: 3,
          borderColor: currentMode ? 'warning.main' : 'success.main',
          borderWidth: 2,
        }}
      >
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                現在のモード
              </Typography>
              <Chip
                label={currentMode ? '🔓 デモモード' : '🔒 通常モード'}
                color={currentMode ? 'warning' : 'success'}
                variant="filled"
                sx={{ fontWeight: 600, fontSize: '0.95rem', py: 2.5, px: 1 }}
              />
            </Stack>

            <Typography variant="body2" color="text.secondary">
              {currentMode
                ? 'ログイン認証をスキップし、管理者権限で全機能にアクセスできます。職員への共有・デモンストレーション向けです。'
                : 'Azure AD（MSAL）認証でログインし、ユーザーのグループ権限に基づいてアクセス制御されています。'}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* 切替ボタン */}
      <Stack spacing={2}>
        {currentMode ? (
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <SecurityRoundedIcon color="success" />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    通常モードに戻す
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  MSAL認証が有効になり、ユーザーはログインが必要になります。
                  メニューの表示はユーザーの権限に基づきます。
                </Typography>
                <Alert severity="info" variant="outlined" sx={{ mt: 1 }}>
                  切替後、ページがリロードされます。ログイン画面が表示される場合があります。
                </Alert>
                <Button
                  variant="contained"
                  color="success"
                  size="large"
                  onClick={() => handleSwitchRequest(false)}
                  startIcon={<LockRoundedIcon />}
                  disabled={switched}
                  sx={{ alignSelf: 'flex-start', mt: 1 }}
                >
                  通常モードに切替
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ) : (
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <WarningAmberRoundedIcon color="warning" />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    デモモードに切替
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  ログイン認証をスキップし、管理者として全機能にアクセスできるようになります。
                  職員への共有やデモンストレーションに使用してください。
                </Typography>
                <Alert severity="warning" variant="outlined" sx={{ mt: 1 }}>
                  デモモードでは認証が無効になります。共有が終わったら通常モードに戻してください。
                </Alert>
                <Button
                  variant="contained"
                  color="warning"
                  size="large"
                  onClick={() => handleSwitchRequest(true)}
                  startIcon={<WarningAmberRoundedIcon />}
                  disabled={switched}
                  sx={{ alignSelf: 'flex-start', mt: 1 }}
                >
                  デモモードに切替
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}
      </Stack>

      {/* パスワードダイアログ */}
      <PasswordDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={handlePasswordSuccess}
        title={dialogTitle}
        description={dialogDescription}
      />
    </Box>
  );
};

export default ModeSwitchPage;
