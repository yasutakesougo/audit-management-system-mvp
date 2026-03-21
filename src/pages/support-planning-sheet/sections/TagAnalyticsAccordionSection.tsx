import React from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  useTagAnalytics,
  TagAnalyticsSection,
  presetToDateRange,
  type PeriodPreset,
} from '@/features/tag-analytics';

type TagAnalyticsAccordionSectionProps = {
  userId: string | undefined;
};

export function TagAnalyticsAccordionSection({ userId }: TagAnalyticsAccordionSectionProps) {
  const [period, setPeriod] = React.useState<PeriodPreset>('30d');
  const range = React.useMemo(() => presetToDateRange(period), [period]);
  const tagAnalytics = useTagAnalytics(userId, range);

  if (tagAnalytics.status === 'empty' || tagAnalytics.status === 'error') {
    return null;
  }

  return (
    <Accordion
      defaultExpanded={tagAnalytics.status === 'ready'}
      variant="outlined"
      sx={{ borderRadius: 2 }}
      data-testid="planning-sheet-tag-analytics"
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          🏷️ 行動タグ分析
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <TagAnalyticsSection
          analytics={tagAnalytics}
          periodPreset={period}
          onPeriodChange={setPeriod}
          showSuggestions
        />
      </AccordionDetails>
    </Accordion>
  );
}
