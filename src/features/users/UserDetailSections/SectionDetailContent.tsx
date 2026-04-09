/**
 * SectionDetailContent — renders the detail/body content area for a single UserDetailSection.
 *
 * Extracted from UserDetailSections/index.tsx to isolate section rendering logic.
 * For the 'support-plan' section, the ISPSummarySection is lazy-loaded here.
 */
import { LoadingState } from '@/components/ui/LoadingState';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { Suspense } from 'react';
import type { IUserMaster } from '../types';
import { formatDateLabel, renderHighlights, resolveUserIdentifier } from './helpers';
import type { MenuSection } from './types';

const ISPSummarySectionLazy = React.lazy(() =>
  import('./ISPSummarySection').then((m) => ({ default: m.ISPSummarySection })),
);

const TimelineSectionWrapperLazy = React.lazy(() =>
  import('./TimelineSectionWrapper').then((m) => ({ default: m.TimelineSectionWrapper })),
);

type SectionDetailContentProps = {
  section: MenuSection;
  user: IUserMaster;
  attendanceLabel: string;
  /** タイムラインの sourceCounts が確定したときのコールバック */
  onTimelineCountsReady?: (counts: { total: number }) => void;
};

export const SectionDetailContent: React.FC<SectionDetailContentProps> = ({
  section,
  user,
  attendanceLabel,
  onTimelineCountsReady,
}) => {
  // ── Basic info rows ──
  if (section.key === 'basic') {
    const detailRows = [
      { label: '氏名', value: user.FullName || '未設定' },
      { label: 'ふりがな', value: user.Furigana || user.FullNameKana || '未登録' },
      { label: '利用者コード', value: resolveUserIdentifier(user) },
      { label: '契約日', value: formatDateLabel(user.ContractDate) },
      { label: '利用開始日', value: formatDateLabel(user.ServiceStartDate) },
      {
        label: '利用終了日',
        value: user.ServiceEndDate ? formatDateLabel(user.ServiceEndDate) : '継続利用中',
      },
      { label: '在籍状況', value: user.IsActive === false ? '退所' : '在籍' },
      {
        label: '支援区分',
        value: user.IsHighIntensitySupportTarget ? '強度行動障害支援対象者' : '通常支援',
      },
      { label: '支援手順の実施', value: user.IsSupportProcedureTarget ? '対象' : '対象外' },
      { label: '通所予定日', value: attendanceLabel },
      { label: '受給者証番号', value: user.RecipientCertNumber || '未登録' },
      { label: '受給者証期限', value: formatDateLabel(user.RecipientCertExpiry) },
    ];

    return (
      <Stack spacing={2}>
        <Box
          component="dl"
          sx={{
            m: 0,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '160px 1fr' },
            columnGap: 3,
            rowGap: 1.5,
          }}
        >
          {detailRows.map(({ label, value }) => (
            <React.Fragment key={label}>
              <Typography component="dt" variant="subtitle2" color="text.secondary">
                {label}
              </Typography>
              <Typography component="dd" variant="body1" sx={{ m: 0 }}>
                {value}
              </Typography>
            </React.Fragment>
          ))}
        </Box>
        <Divider />
        <Typography variant="subtitle2" color="text.secondary">
          このセクションでできること
        </Typography>
        {renderHighlights(section.highlights)}
      </Stack>
    );
  }

  // ── Support plan — lazy-loaded ISP summary ──
  if (section.key === 'support-plan') {
    return (
      <Suspense fallback={<LoadingState message="個別支援計画書を準備中…" inline />}>
        <ISPSummarySectionLazy userId={user.UserID} />
      </Suspense>
    );
  }

  // ── Timeline — lazy-loaded timeline panel ──
  if (section.key === 'timeline') {
    return (
      <Suspense fallback={<LoadingState message="タイムラインを準備中…" inline />}>
        <TimelineSectionWrapperLazy
          user={user}
          onSourceCountsReady={onTimelineCountsReady}
        />
      </Suspense>
    );
  }

  // ── Generic sections ──
  const supportProcedureWarning =
    section.key === 'support-procedure' && !user.IsSupportProcedureTarget;

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2" color="text.secondary">
        想定されるコンテンツ
      </Typography>
      {renderHighlights(section.highlights)}
      {supportProcedureWarning && (
        <Alert severity="warning">
          この利用者は支援手順の実施の対象ではありません。日々の記録をご利用ください。
        </Alert>
      )}
      {section.status === 'coming-soon' && (
        <Alert severity="info">
          このセクションの詳細画面は今後の開発で提供予定です。
        </Alert>
      )}
    </Stack>
  );
};
