import ObservationBridge from '@/features/nurse/observation/ObservationBridge';
import { getFlag } from '@/lib/env';
import { warmDataEntryComponents } from '@/mui/warm';
import { Alert } from '@mui/material';
import React, { useEffect } from 'react';

const HealthObservationPage: React.FC = () => {
  const showBetaBanner = getFlag('VITE_FEATURE_NURSE_BETA');

  // ページ初期化時にMUIコンポーネントをプリロード
  useEffect(() => {
    warmDataEntryComponents().catch(() => {
      // プリロード失敗は非致命的エラーとして処理
    });
  }, []);

  return (
    <>
      {showBetaBanner && (
        <Alert
          severity="info"
          sx={{
            borderRadius: 0,
            borderLeft: 0,
            borderRight: 0,
            borderTop: 0,
          }}
        >
          看護観察UI（β版）です。画面構成や入力項目は今後変更される可能性があります。
        </Alert>
      )}
      <ObservationBridge />
    </>
  );
};

export default HealthObservationPage;
