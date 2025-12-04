import type { BehaviorObservation } from './daily/types';

export type BehaviorDateRange = {
  /** ISO8601 string (inclusive). */
  from?: string;
  /** ISO8601 string (inclusive). */
  to?: string;
};

export type BehaviorQueryOptions = {
  /** Optional time window filter; defaults to entire history. */
  dateRange?: BehaviorDateRange;
  /** Optional maximum rows to return, newest-first if repository supports ordering. */
  limit?: number;
};

export interface BehaviorRepository {
  /**
   * Persist a new behavior observation. Implementations are responsible for generating IDs.
   */
  add(observation: Omit<BehaviorObservation, 'id'>): Promise<BehaviorObservation>;
  /**
   * Fetch a user's observations ordered from newest to oldest unless otherwise noted.
   */
  getByUser(userId: string, options?: BehaviorQueryOptions): Promise<BehaviorObservation[]>;
}
