import { Assignment, AssignmentListFilter, AssignmentRepository } from '../domain/assignment';

/**
 * InMemory Assignment Repository
 * 
 * Provides an in-memory implementation of the AssignmentRepository for demo and testing.
 * Supports basic filtering by type, status, date range, and resource ID.
 */
export class InMemoryAssignmentRepository implements AssignmentRepository {
  private assignments: Assignment[] = [];

  constructor(initialData: Assignment[] = []) {
    this.assignments = [...initialData];
  }

  async list(filter: AssignmentListFilter): Promise<Assignment[]> {
    return this.assignments.filter(a => {
      // 1. Type filter
      if (filter.type && a.type !== filter.type) return false;

      // 2. Status filter
      if (filter.status && a.status !== filter.status) return false;

      // 3. Date Range filter (overlapping check)
      if (filter.range) {
        const { from, to } = filter.range;
        if (a.start >= to || a.end <= from) return false;
      }

      // 4. Resource ID filter (type-specific)
      if (filter.resourceId) {
        if (a.type === 'transport') {
          const isVehicleMatch = a.vehicleId === filter.resourceId;
          const isDriverMatch = a.driverId === filter.resourceId;
          const isAssistantMatch = a.assistantStaffIds.includes(filter.resourceId);
          if (!isVehicleMatch && !isDriverMatch && !isAssistantMatch) return false;
        }
        // Add other resource matching logic as domains expand
      }

      return true;
    });
  }

  async getById(id: string): Promise<Assignment | null> {
    return this.assignments.find(a => a.id === id) || null;
  }

  async create(assignment: Omit<Assignment, 'id'>): Promise<Assignment> {
    const newAssignment = {
      ...assignment,
      id: `memo-asgn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      updatedAt: new Date().toISOString(),
    } as Assignment;
    
    this.assignments.push(newAssignment);
    return { ...newAssignment };
  }

  async update(assignment: Assignment): Promise<Assignment> {
    const index = this.assignments.findIndex(a => a.id === assignment.id);
    if (index === -1) {
      throw new Error(`Assignment not found: ${assignment.id}`);
    }

    const updated = {
      ...assignment,
      updatedAt: new Date().toISOString(),
    };
    
    this.assignments[index] = updated;
    return { ...updated };
  }

  async delete(id: string): Promise<void> {
    const initialLength = this.assignments.length;
    this.assignments = this.assignments.filter(a => a.id !== id);
    
    if (this.assignments.length === initialLength) {
      // Potentially log warning but don't throw if idempotent delete is preferred
    }
  }

  /**
   * Helper to seed demo data
   */
  seed(data: Assignment[]): void {
    this.assignments = [...this.assignments, ...data];
  }
}

/**
 * Default singleton instance for demo mode
 */
export const inMemoryAssignmentRepository = new InMemoryAssignmentRepository();
