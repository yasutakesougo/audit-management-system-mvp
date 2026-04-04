import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SharePointMonitoringMeetingRepository } from '../SharePointMonitoringMeetingRepository';
import { MonitoringMeetingRecord } from '@/domain/isp/monitoringMeeting';

const jsonResponse = (value: unknown): Response =>
    new Response(JSON.stringify(value), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });

describe('SharePointMonitoringMeetingRepository Drift Immunity', () => {
    const mockRecord: MonitoringMeetingRecord = {
        id: 'rec-123',
        userId: 'user-001',
        ispId: 'isp-999',
        meetingType: 'regular',
        meetingDate: '2024-04-01T10:00:00Z',
        venue: 'Meeting Room A',
        attendees: [],
        goalEvaluations: [],
        overallAssessment: 'Good progress',
        userFeedback: 'Happy',
        familyFeedback: 'Satisfied',
        planChangeDecision: 'no_change',
        changeReason: '',
        decisions: ['Keep going'],
        nextMonitoringDate: '2024-07-01T10:00:00Z',
        recordedBy: 'Staff A',
        recordedAt: '2024-04-01T11:00:00Z'
    };

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('should resolve drift names like RecordId0 and MeetingDate0', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const spFetch = vi.fn(async (path: string, options?: any) => {
            if (path.includes('lists?$select=Title')) {
                return jsonResponse({ value: [{ Title: 'MonitoringMeetings' }] });
            }
            if (path.includes('/fields')) {
                return jsonResponse({
                    value: [
                        { InternalName: 'Id' },
                        { InternalName: 'Title' },
                        { InternalName: 'RecordId0' },
                        { InternalName: 'UserId' },
                        { InternalName: 'MeetingDate0' },
                        { InternalName: 'IspId' },
                    ]
                });
            }
            if (options?.method === 'POST') {
                return jsonResponse({ Id: 101 });
            }
            if (path.includes('/items')) {
                if (path.includes('items(101)')) {
                    return jsonResponse({
                        Id: 101,
                        RecordId0: 'rec-123',
                        UserId: 'user-001',
                        MeetingDate0: '2024-04-01T10:00:00Z',
                        IspId: 'isp-999'
                    });
                }
                // Fallback for ID search
                return jsonResponse({ value: [{ Id: 101 }] });
            }
            return jsonResponse({ value: [] });
        });

        const repo = new SharePointMonitoringMeetingRepository({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sp: { spFetch: spFetch as any } as any
        });

        const result = await repo.save(mockRecord);
        expect(result.id).toBe('rec-123');
    });

    it('should fail-open when optional fields are missing', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const spFetch = vi.fn(async (path: string, options?: any) => {
            if (path.includes('lists?$select=Title')) {
                return jsonResponse({ value: [{ Title: 'MonitoringMeetings' }] });
            }
            if (path.includes('/fields')) {
                return jsonResponse({
                    value: [
                        { InternalName: 'Id' },
                        { InternalName: 'Title' },
                        { InternalName: 'RecordId' },
                        { InternalName: 'UserId' },
                        { InternalName: 'MeetingDate' },
                    ]
                });
            }
            if (options?.method === 'POST') {
                return jsonResponse({ Id: 101 });
            }
            if (path.includes('/items')) {
                if (path.includes('items(101)')) {
                    return jsonResponse({
                        Id: 101, RecordId: 'rec-123', UserId: 'user-001', MeetingDate: '2024-04-01'
                    });
                }
                return jsonResponse({ value: [{ Id: 101 }] });
            }
            return jsonResponse({ value: [] });
        });

        const repo = new SharePointMonitoringMeetingRepository({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sp: { spFetch: spFetch as any } as any
        });

        const result = await repo.save(mockRecord);
        expect(result.id).toBe('rec-123');
    });

    it('should throw error when essential field recordId is missing', async () => {
        const spFetch = vi.fn(async (path: string) => {
            if (path.includes('lists?$select=Title')) {
                return jsonResponse({ value: [{ Title: 'MonitoringMeetings' }] });
            }
            if (path.includes('/fields')) {
                return jsonResponse({
                    value: [
                        { InternalName: 'UserId' },
                        { InternalName: 'cr014_meetingDate' },
                    ]
                });
            }
            return jsonResponse({ value: [] });
        });

        const repo = new SharePointMonitoringMeetingRepository({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sp: { spFetch: spFetch as any } as any
        });

        await expect(repo.save(mockRecord)).rejects.toThrow();
    });
});
