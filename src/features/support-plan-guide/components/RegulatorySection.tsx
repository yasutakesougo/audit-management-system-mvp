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
import type { SupportPlanBundle } from '@/domain/isp/schema';
import { buildDailySupportUrl } from '@/app/links/buildDailySupportUrl';

type RegulatorySectionProps = {
  bundle: SupportPlanBundle;
  linkedUserId: string | null;
  onNavigate: (url: string) => void;
};

const RegulatorySection: React.FC<RegulatorySectionProps> = ({
  bundle,
  linkedUserId,
  onNavigate,
}) => (
  <Stack spacing={1.5}>
    <RegulatorySummaryBand bundle={bundle} />
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
