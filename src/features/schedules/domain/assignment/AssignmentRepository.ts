import { Assignment, AssignmentType, AssignmentStatus } from './types';

/**
 * Filter parameters for listing assignments.
 */
export interface AssignmentListFilter {
  type?: AssignmentType;
  status?: AssignmentStatus;
  range?: {
    from: string; // ISO 8601
    to: string;   // ISO 8601
  };
  resourceId?: string; // vehicleId, driverId, etc.
}

/**
 * Assignment Repository Interface
 * 
 * Defines the contract for persistence of coordination/allocation data.
 * Implementations will handle mapping to specific storage (SharePoint, etc.)
 */
export interface AssignmentRepository {
  /**
   * List assignments based on filter criteria.
   */
  list(filter: AssignmentListFilter): Promise<Assignment[]>;

  /**
   * Fetch a single assignment by ID.
   */
  getById(id: string): Promise<Assignment | null>;

  /**
   * Create a new assignment.
   */
  create(assignment: Omit<Assignment, 'id'>): Promise<Assignment>;

  /**
   * Update an existing assignment.
   */
  update(assignment: Assignment): Promise<Assignment>;

  /**
   * Delete an assignment.
   */
  delete(id: string): Promise<void>;
}
