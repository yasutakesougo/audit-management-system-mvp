import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SharePointActivityDiaryRepository } from '../SharePointActivityDiaryRepository';
import { ACTIVITY_DIARY_CANDIDATES } from '@/sharepoint/fields/activityDiaryFields';
import { auditLog } from '@/lib/debugLogger';
import { createDriftMock } from '@/test-utils/sp/createDriftMock';

describe('SharePointActivityDiaryRepository (Drift Immunity)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock auditLog to avoid noise in tests
        vi.spyOn(auditLog, 'info').mockImplementation(() => {});
        vi.spyOn(auditLog, 'warn').mockImplementation(() => {});
        vi.spyOn(auditLog, 'error').mockImplementation(() => {});
    });

    it('should resolve schema drift (suffix) and save successfully', async () => {
        const mockSpFetch = createDriftMock({
            listTitle: 'ActivityDiary',
            fields: [
                { InternalName: 'Id' },
                { InternalName: 'UserID' },
                { InternalName: 'Date0' },      // Drifted
                { InternalName: 'Shift0' },     // Drifted
                { InternalName: 'Category' },
                { InternalName: 'Notes0' },     // Drifted
            ],
            saveResponse: { Id: 123 },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const repo = new SharePointActivityDiaryRepository({ sp: { spFetch: mockSpFetch } as any });

        const upsert = {
            userId: 'user123',
            dateISO: '2024-04-04',
            period: 'AM' as const,
            category: '個別' as const,
            notes: 'Test note',
        };

        await repo.add(upsert);

        // Verify the payload used the DRIFTING names
        const lastCall = mockSpFetch.mock.calls.find(call => call[1]?.method === 'POST');
        const payload = JSON.parse(lastCall![1]!.body as string);

        expect(payload).toHaveProperty('UserID', 'user123');
        expect(payload).toHaveProperty('Date0', '2024-04-04');
        expect(payload).toHaveProperty('Shift0', 'AM');
        expect(payload).toHaveProperty('Notes0', 'Test note');
        
        // Verify telemetry was called for drifts (Date0 → date resolved via fuzzy_match)
        expect(auditLog.info).toHaveBeenCalledWith('sp', 'sp:fetch_fallback_success', expect.objectContaining({
            list: 'ActivityDiary',
            field: 'date',
        }));
    });

    it('should fail-open (skip) when optional fields are missing', async () => {
        const mockSpFetch = createDriftMock({
            listTitle: 'ActivityDiary',
            fields: [
                { InternalName: 'Id' },
                { InternalName: 'UserID' },
                { InternalName: 'Date' },
                { InternalName: 'Shift' },
                { InternalName: 'Category' },
                // Notes is missing!
            ],
            saveResponse: { Id: 124 },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const repo = new SharePointActivityDiaryRepository({ sp: { spFetch: mockSpFetch } as any });

        const upsert = {
            userId: 'user123',
            dateISO: '2024-04-04',
            period: 'PM' as const,
            category: '請負' as const,
            notes: 'This note should be skipped',
        };

        await repo.add(upsert);

        const lastCall = mockSpFetch.mock.calls.find(call => call[1]?.method === 'POST');
        const payload = JSON.parse(lastCall![1]!.body as string);

        // Essential fields should be there
        expect(payload).toHaveProperty('UserID');
        
        // Optional missing field should NOT be in payload (to avoid 400)
        const notesCandidates = ACTIVITY_DIARY_CANDIDATES.notes;
        notesCandidates.forEach(cand => {
            expect(payload).not.toHaveProperty(cand);
        });

        // Telemetry check
        expect(auditLog.warn).toHaveBeenCalledWith('sp', 'sp:field_missing_optional', expect.objectContaining({
            field: 'notes'
        }));
    });

    it('should throw error when essential fields are missing', async () => {
        const mockSpFetch = createDriftMock({
            listTitle: 'ActivityDiary',
            fields: [
                { InternalName: 'Date' },
                { InternalName: 'Shift' },
                { InternalName: 'Category' },
                // userId is missing!
            ],
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const repo = new SharePointActivityDiaryRepository({ sp: { spFetch: mockSpFetch } as any });

        const upsert = {
            userId: 'user123',
            dateISO: '2024-04-04',
            period: 'AM' as const,
            category: '余暇' as const,
        };

        await expect(repo.add(upsert)).rejects.toThrow('Could not resolve list path');
        
        // Telemetry check
        expect(auditLog.error).toHaveBeenCalledWith('sp', 'sp:field_missing_essential', expect.objectContaining({
            list: 'ActivityDiaryProbe',
            missingFields: ['userId']
        }));
    });
});
