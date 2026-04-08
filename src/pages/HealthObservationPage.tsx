import ObservationBridge from '@/features/nurse/observation/ObservationBridge';
import { warmDataEntryComponents } from '@/mui/warm';
import React, { useEffect } from 'react';

const HealthObservationPage: React.FC = () => {
  // ページ初期化時にMUIコンポーネントをプリロード
  useEffect(() => {
    warmDataEntryComponents().catch(() => {
      // プリロード失敗は非致命的エラーとして処理
    });
  }, []);

  return <ObservationBridge />;
};

export default HealthObservationPage;
