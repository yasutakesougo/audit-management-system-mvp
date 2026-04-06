import { Task, UpdateAssessmentStatusParams } from "../../domain/task/task";
// Note: In a real app, spClient would be an imported singleton
// but here we mock it to show the repository implementation.
const spClient = {
  updateItem: async (list: string, id: number, params: Record<string, unknown>) => ({ Id: id, ...params })
};

export const updateStatus = async (id: number, params: UpdateAssessmentStatusParams): Promise<Task> => {
  const { id: _, ...statusUpdate } = params;
  
  // Convert boolean-like values to 0/1 for database
  const mappedUpdate: Record<string, string | number | boolean> = {};
  if (statusUpdate.status !== undefined) mappedUpdate.status = parseInt(String(statusUpdate.status));
  if (statusUpdate.priority !== undefined) mappedUpdate.priority = parseInt(String(statusUpdate.priority));
  if (statusUpdate.isAvailabilityValid !== undefined) {
    mappedUpdate.is_availability_valid = (statusUpdate.isAvailabilityValid === true || statusUpdate.isAvailabilityValid === '1') ? 1 : 0;
  }
  if (statusUpdate.isAssessmentUpdateValid !== undefined) {
    mappedUpdate.is_assessment_update_valid = (statusUpdate.isAssessmentUpdateValid === true || statusUpdate.isAssessmentUpdateValid === '1') ? 1 : 0;
  }
  if (statusUpdate.isReportValid !== undefined) {
    mappedUpdate.is_report_valid = (statusUpdate.isReportValid === true || statusUpdate.isReportValid === '1') ? 1 : 0;
  }

  const result = await spClient.updateItem('Tasks', id, mappedUpdate as Record<string, unknown>);
  
  return {
    id: (result as { Id: number }).Id,
    title: 'Updated Task', // Simplified for demonstration
    status: (mappedUpdate.status as number) ?? 0,
    priority: (mappedUpdate.priority as number) ?? 1,
    ...statusUpdate
  } as Task;
};
