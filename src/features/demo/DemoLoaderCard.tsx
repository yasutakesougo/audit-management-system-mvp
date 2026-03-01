// ---------------------------------------------------------------------------
// DemoLoaderCard — デモ装填ボタンカード
//
// 設定画面に配置。ワンクリックで全ストアをクリア＆シードし、
// 桂川さんモデルの「魔法の3分デモ」が開始できる完璧な状態にリセットする。
// ---------------------------------------------------------------------------

import { useProcedureStore } from '@/features/daily/stores/procedureStore';
import { DEMO_USER_ID, loadMagicDemo } from '@/features/demo/loadMagicDemo';
import { isDemoModeEnabled } from '@/lib/env';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import React, { useCallback, useState } from 'react';

export const DemoLoaderCard: React.FC = () => {
  const [result, setResult] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const procedureStore = useProcedureStore();

  const handleLoad = useCallback(() => {
    try {
      // 1. Load localStorage stores + auto-link BIP ↔ procedures
      const summary = loadMagicDemo();

      // 2. Inject linked procedures into in-memory store
      procedureStore.save(DEMO_USER_ID, summary.procedures);

      const msg = `✅ デモデータ装填完了！ 日課${summary.procedureCount}件, BIP${summary.bips}件, 実施記録${summary.executions}件, 行動記録${summary.behaviors}件`;
      setResult(msg);
      setOpen(true);
    } catch (err) {
      const msg = `❌ 装填失敗: ${err instanceof Error ? err.message : String(err)}`;
      setResult(msg);
      setOpen(true);
    }
  }, [procedureStore]);

  // Only show in demo mode
  if (!isDemoModeEnabled()) return null;

  return (
    <>
      <Card
        variant="outlined"
        sx={{
          borderColor: 'primary.main',
          borderWidth: 2,
          borderStyle: 'dashed',
          background: 'linear-gradient(135deg, rgba(91,140,90,0.04) 0%, rgba(25,118,210,0.04) 100%)',
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <RocketLaunchIcon sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle1" fontWeight={700}>
              🎤 魔法の3分デモ（桂川さんモデル）
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            ワンクリックでデモ用のゴールデンデータ（日課表12件・BIP3件・実施記録7日分・行動記録30日分）を装填します。
            BIP ↔ 日課の🛡️自動クロスリンク付き。既存データはリセットされます。
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<RocketLaunchIcon />}
            onClick={handleLoad}
            size="large"
            sx={{ fontWeight: 700 }}
          >
            🚀 デモデータ装填
          </Button>
        </CardContent>
      </Card>

      <Snackbar
        open={open}
        autoHideDuration={5000}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setOpen(false)}
          severity={result?.startsWith('✅') ? 'success' : 'error'}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {result}
        </Alert>
      </Snackbar>
    </>
  );
};
