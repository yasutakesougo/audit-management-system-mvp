import React from 'react';

import { usePlannerInsights, type UsePlannerInsightsInput } from '@/features/support-plan-guide/hooks/usePlannerInsights';
import { NextActionPanel } from '@/features/support-plan-guide/components/planner-assist/NextActionPanel';

export type NextActionPanelContainerProps = UsePlannerInsightsInput & {
  onNavigate: (tab: string) => void;
};

export default function NextActionPanelContainer(props: NextActionPanelContainerProps) {
  const { bundle, form, goals, decisions, regulatoryInput, onNavigate } = props;

  const plannerInsights = usePlannerInsights({
    bundle,
    form,
    goals,
    decisions,
    regulatoryInput,
  });

  if (plannerInsights.actions.length === 0) {
    return null;
  }

  return (
    <NextActionPanel
      actions={plannerInsights.actions}
      summary={plannerInsights.summary}
      details={plannerInsights.details}
      trendSeries={plannerInsights.trendSeries}
      onNavigate={onNavigate}
    />
  );
}
