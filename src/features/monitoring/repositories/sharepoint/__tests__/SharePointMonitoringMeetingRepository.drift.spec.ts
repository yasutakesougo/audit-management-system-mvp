import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SharePointMonitoringMeetingRepository } from '../SharePointMonitoringMeetingRepository';
import { MonitoringMeetingRecord } from '@/domain/isp/monitoringMeeting';
import { createDriftMock } from '@/test-utils/sp/createDriftMock';

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
        const mockSpFetch = createDriftMock({
            listTitle: 'MonitoringMeetings',
            fields: [
                { InternalName: 'Id' },
                { InternalName: 'Title' },
                { InternalName: 'RecordId0' },
                { InternalName: 'UserId' },
                { InternalName: 'MeetingDate0' },
                { InternalName: 'IspId' },
            ],
            saveResponse: { Id: 101 },
            pathOverrides: {
                "items(101)": {
                    Id: 101,
                    RecordId0: 'rec-123',
                    UserId: 'user-001',
                    MeetingDate0: '2024-04-01T10:00:00Z',
                    IspId: 'isp-999'
                }
            },
            items: [{ Id: 101 }],
        });

        const repo = new SharePointMonitoringMeetingRepository({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sp: { spFetch: mockSpFetch as any } as any
        });

        const result = await repo.save(mockRecord);
        expect(result.id).toBe('rec-123');
    });

    it('should fail-open when optional fields are missing', async () => {
        const mockSpFetch = createDriftMock({
            listTitle: 'MonitoringMeetings',
            fields: [
                { InternalName: 'Id' },
                { InternalName: 'Title' },
                { InternalName: 'RecordId' },
                { InternalName: 'UserId' },
                { InternalName: 'MeetingDate' },
            ],
            saveResponse: { Id: 101 },
            pathOverrides: {
                "items(101)": {
                    Id: 101, RecordId: 'rec-123', UserId: 'user-001', MeetingDate: '2024-04-01'
                }
            },
            items: [{ Id: 101 }],
        });

        const repo = new SharePointMonitoringMeetingRepository({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sp: { spFetch: mockSpFetch as any } as any
        });

        const result = await repo.save(mockRecord);
        expect(result.id).toBe('rec-123');
    });

    it('should throw error when essential field recordId is missing', async () => {
        const mockSpFetch = createDriftMock({
            listTitle: 'MonitoringMeetings',
            fields: [
                { InternalName: 'UserId' },
                { InternalName: 'cr014_meetingDate' },
            ],
        });

        const repo = new SharePointMonitoringMeetingRepository({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sp: { spFetch: mockSpFetch as any } as any
        });

        await expect(repo.save(mockRecord)).rejects.toThrow();
    });
});
