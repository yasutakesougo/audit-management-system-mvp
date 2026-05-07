import React, { useEffect } from 'react';
import { useProcedureStore } from '@/features/daily/hooks/legacy-stores/procedureStore';
import { getTargetUserDemoProcedures } from './seedTargetProcedures';
import { isDemoModeEnabled } from '@/lib/env';

/**
 * 4名の強度行動障害対象者の17行手順を自動的にシードするコンポーネント。
 * デモモードの場合、初回起動時に fixture データからマッピングして store へ保存する。
 */
export const DemoProcedureSeeder: React.FC = () => {
  const procedureStore = useProcedureStore();

  useEffect(() => {
    if (!isDemoModeEnabled()) return;

    const seeds = getTargetUserDemoProcedures();
    
    // まだデータがないユーザーのみシードする（手動変更を上書きしないため）
    Object.entries(seeds).forEach(([userId, items]) => {
      if (!procedureStore.hasUserData(userId)) {
        procedureStore.save(userId, items);
        console.info(`[DemoProcedureSeeder] Seeded 17-row procedures for ${userId}`);
      }
    });
  }, [procedureStore]);

  return null;
};
