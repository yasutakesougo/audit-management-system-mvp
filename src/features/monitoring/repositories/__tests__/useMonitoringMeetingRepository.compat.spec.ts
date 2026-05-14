import { describe, expect, it, vi } from 'vitest';

const mockRepo = { listByUser: vi.fn() };

vi.mock('@/features/monitoring/data/useMonitoringMeetingRepository', () => ({
  useMonitoringMeetingRepository: vi.fn(() => mockRepo),
}));

import { useMonitoringMeetingRepository } from '@/features/monitoring/repositories/createMonitoringMeetingRepository';
import { useMonitoringMeetingRepository as useMonitoringMeetingRepositoryFromData } from '@/features/monitoring/data/useMonitoringMeetingRepository';

describe('createMonitoringMeetingRepository compat hook', () => {
  it('delegates to data/useMonitoringMeetingRepository', () => {
    const repo = useMonitoringMeetingRepository();
    expect(repo).toBe(mockRepo);
    expect(useMonitoringMeetingRepositoryFromData).toHaveBeenCalledTimes(1);
  });
});
