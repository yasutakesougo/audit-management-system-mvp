export interface FlowSupportActivityTemplate {
  time: string;
  title: string;
  personTodo: string;
  supporterTodo: string;
  stage: 'proactive' | 'earlyResponse' | 'crisisResponse' | 'postCrisis';
}

export interface BehaviorSupportPlan {
  planId: string;
  userId: string;
  version: number;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
  authorId: string;
  assessmentSummary: {
    kodoScore: number;
    functionalHypothesis: string[];
    assessmentNotes: string;
  };
  proactiveStrategies: string;
  skillBuildingPlan: string;
  crisisResponseFlow: Record<string, unknown>;
  monitoringHistory: Array<{
    date: string;
    summary: string;
    previousVersionId: string;
  }>;
  dailyActivities: FlowSupportActivityTemplate[];
}
