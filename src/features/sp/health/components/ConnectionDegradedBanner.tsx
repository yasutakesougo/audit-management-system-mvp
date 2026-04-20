import React from 'react';
import { useConnectionStatus } from '../hooks/useConnectionStatus';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { useNavigate } from 'react-router-dom';
import { useSettingsContext } from '@/features/settings/SettingsContext';

/**
 * ConnectionDegradedBanner — SharePoint 接続異常または未設定時に表示するバナー
 */
export const ConnectionDegradedBanner: React.FC = () => {
  const statusInfo = useConnectionStatus();
  const { status, message, actionUrl, reason, reset } = statusInfo;
  const navigate = useNavigate();
  const { settings } = useSettingsContext();
  const isKioskMode = settings.layoutMode === 'kiosk';

  // 接続済みまたはデモモード時は表示しない
  if (status === 'connected' || status === 'demo' || status === 'checking') {
    return null;
  }

  const getTitle = () => {
    if (isKioskMode) {
      return '📡 データの同期に時間がかかっています';
    }
    switch (reason) {
      case 'config_missing': return '🔧 SharePoint 接続設定が未完了です';
      case 'auth_failed': return '🔑 SharePoint 認証エラーが発生しました';
      case 'list_unreachable': return '📡 SharePoint リストへのアクセスに失敗しました';
      case 'setup_required': return '🏗️ 初期セットアップが必要です';
      default: return '⚠️ SharePoint 接続に課題があります';
    }
  };

  const getMessage = () => {
    if (isKioskMode) {
      return '現在の通信状況では最新の情報を表示できない可能性があります。「再読み込み」を試しても解消しない場合は、拠点管理者にご連絡ください。';
    }
    return message;
  };

  return (
    <Box sx={{ width: '100%', mb: 2 }}>
      <Alert
        severity="error"
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              color="inherit"
              size="small"
              onClick={reset}
              variant="text"
              sx={{ fontWeight: 600 }}
            >
              再試行
            </Button>
            {actionUrl && (
              <Button 
                color="inherit" 
                size="small" 
                onClick={() => navigate(actionUrl)}
                variant="outlined"
              >
                詳細を確認
              </Button>
            )}
          </Box>
        }
        sx={{
          '& .MuiAlert-message': { width: '100%' },
        }}
      >
        <AlertTitle sx={{ fontWeight: 700 }}>
          {getTitle()}
        </AlertTitle>
        {getMessage()}
        {!isKioskMode && (
          <>
            <br />
            <small style={{ opacity: 0.8 }}>
              ※ 設定が正しく完了するまで、この画面のデータは「空」として表示されます。
            </small>
          </>
        )}
      </Alert>
    </Box>
  );
};
