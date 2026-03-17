/**
 * RegulatorySection — 制度サマリー帯 + シート統計グリッド
 *
 * SupportPlanGuidePage から lazy-import されるコード分割用ラッパー。
 * `regulatoryAvailable` 判定は呼び出し側で行い、
 * このコンポーネントは表示時のみロードされる。
 */
import React from 'react';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import { RegulatorySummaryBand } from './RegulatorySummaryBand';
import { PlanningSheetStatsGrid } from './PlanningSheetStatsGrid';
import type { SupportPlanBundle, IspComplianceMetadata } from '@/domain/isp/schema';
import type { DeadlineInfo, SectionKey } from '../types';
import { buildDailySupportUrl } from '@/app/links/buildDailySupportUrl';

type RegulatorySectionProps = {
  bundle: SupportPlanBundle;
  linkedUserId: string | null;
  onNavigate: (url: string) => void;
  /** P2-B: 制度適合メタデータ */
  compliance?: IspComplianceMetadata | null;
  /** P2-B: 期限情報 */
  deadlines?: {
    creation: DeadlineInfo;
    monitoring: DeadlineInfo;
  };
  /** P2-B: Iceberg 分析件数合計 */
  icebergTotal?: number;
  /** P2-B: HUD チップクリックでタブ遷移 */
  onNavigateToTab?: (sub: SectionKey) => void;
};

const RegulatorySection: React.FC<RegulatorySectionProps> = ({
  bundle,
  linkedUserId,
  onNavigate,
  compliance,
  deadlines,
  icebergTotal,
  onNavigateToTab,
}) => (
  <Stack spacing={1.5}>
    <RegulatorySummaryBand
      bundle={bundle}
      compliance={compliance}
      deadlines={deadlines}
      icebergTotal={icebergTotal}
      onNavigateToTab={onNavigateToTab}
    />
    <PlanningSheetStatsGrid bundle={bundle} onNavigate={onNavigate} />
    {/* シートカードが無い場合のみ単一ボタンを表示 */}
    {linkedUserId && !(bundle.planningSheetItems?.length) && (
      <Button
        variant="outlined"
        size="small"
        startIcon={<PlayArrowRoundedIcon />}
        onClick={() => onNavigate(buildDailySupportUrl(linkedUserId))}
        sx={{ alignSelf: 'flex-start' }}
        data-testid="open-daily-support-btn"
      >
        この支援計画の時間割を開く
      </Button>
    )}
  </Stack>
);

export default RegulatorySection;
