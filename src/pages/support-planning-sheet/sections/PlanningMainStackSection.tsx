import Stack from '@mui/material/Stack';
import type { ComponentProps } from 'react';
import SheetHeader from '../SheetHeader';
import { OperationGuideAlert } from '../components/ui/OperationGuideAlert';
import { SheetMetadataFooter } from '../components/ui/SheetMetadataFooter';
import { ImportHistorySection } from './ImportHistorySection';
import { PlanningStatusSection } from './PlanningStatusSection';
import { BridgeSuggestionsSection } from './BridgeSuggestionsSection';
import { PlanningTabsSection } from './PlanningTabsSection';
import { TagAnalyticsAccordionSection } from './TagAnalyticsAccordionSection';

type PlanningMainStackSectionProps = {
  headerProps: ComponentProps<typeof SheetHeader>;
  operationGuideProps: ComponentProps<typeof OperationGuideAlert>;
  planningStatusProps: ComponentProps<typeof PlanningStatusSection>;
  bridgeSuggestionsProps: ComponentProps<typeof BridgeSuggestionsSection>;
  importHistoryProps: ComponentProps<typeof ImportHistorySection>;
  planningTabsProps: ComponentProps<typeof PlanningTabsSection>;
  tagAnalyticsProps: ComponentProps<typeof TagAnalyticsAccordionSection>;
  metadataFooterProps: ComponentProps<typeof SheetMetadataFooter>;
};

export function PlanningMainStackSection({
  headerProps,
  operationGuideProps,
  planningStatusProps,
  bridgeSuggestionsProps,
  importHistoryProps,
  planningTabsProps,
  tagAnalyticsProps,
  metadataFooterProps,
}: PlanningMainStackSectionProps) {
  return (
    <Stack spacing={3}>
      <SheetHeader {...headerProps} />
      <OperationGuideAlert {...operationGuideProps} />
      <PlanningStatusSection {...planningStatusProps} />
      <BridgeSuggestionsSection {...bridgeSuggestionsProps} />
      <ImportHistorySection {...importHistoryProps} />
      <PlanningTabsSection {...planningTabsProps} />
      <TagAnalyticsAccordionSection {...tagAnalyticsProps} />
      <SheetMetadataFooter {...metadataFooterProps} />
    </Stack>
  );
}
