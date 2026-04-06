export interface Task {
  id: number;
  title: string;
  description?: string;
  status: number;
  priority: number;
  due_date?: string;
  updated_at?: string;
}

export interface UpdateAssessmentStatusParams {
  id: number;
  status?: number | string;
  priority?: number | string;
  isAvailabilityValid?: boolean | string;
  isAssessmentUpdateValid?: boolean | string;
  isReportValid?: boolean | string;
}
