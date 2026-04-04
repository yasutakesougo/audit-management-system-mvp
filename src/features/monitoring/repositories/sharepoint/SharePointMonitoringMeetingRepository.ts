import { MonitoringMeetingRepository } from '@/domain/isp/monitoringMeetingRepository';
import { MonitoringMeetingRecord } from '@/domain/isp/monitoringMeeting';
import { acquireSpAccessToken } from '@/lib/msal';
import { createSpClient, ensureConfig } from '@/lib/spClient';
import { MonitoringMeetingSchemaResolver } from './monitoringMeetingModules/SchemaResolver';
import { MonitoringMeetingSaver } from './monitoringMeetingModules/Saver';
import { MonitoringMeetingDataAccess } from './monitoringMeetingModules/DataAccess';
import { auditLog } from '@/lib/debugLogger';

export class SharePointMonitoringMeetingRepository implements MonitoringMeetingRepository {
    private readonly spFetch: ReturnType<typeof createSpClient>['spFetch'];
    private readonly schema: MonitoringMeetingSchemaResolver;
    private readonly dataAccess: MonitoringMeetingDataAccess;
    private readonly saver: MonitoringMeetingSaver;
    private readonly listTitle: string;

    constructor(options: { sp?: ReturnType<typeof createSpClient>; listTitle?: string } = {}) {
        const { baseUrl } = ensureConfig();
        const sp = options.sp ?? createSpClient(acquireSpAccessToken, baseUrl);
        this.spFetch = sp.spFetch;
        this.listTitle = options.listTitle || 'MonitoringMeetings';
        
        this.schema = new MonitoringMeetingSchemaResolver(this.spFetch, this.listTitle);
        this.dataAccess = new MonitoringMeetingDataAccess(this.spFetch, this.schema);
        this.saver = new MonitoringMeetingSaver(this.spFetch, this.schema);
    }

    public async getAll(): Promise<MonitoringMeetingRecord[]> {
        const listPath = await this.schema.resolveListPath();
        if (!listPath) return [];
        const fields = await this.schema.getResolvedCanonicalNames();
        
        try {
            const queryParams = new URLSearchParams();
            queryParams.set('$orderby', `${fields.meetingDate || 'Title'} desc`);
            queryParams.set('$top', '500');
            queryParams.set('$select', ['Id', 'Title', ...Object.values(fields).filter(v => !!v)].join(','));

            const response = await this.spFetch(`${listPath}/items?${queryParams.toString()}`);
            const json = await response.json();
            return (json.value || []).map((r: unknown) => this.dataAccess.mapSpRowToRecord(r, fields));
        } catch (error) {
            auditLog.error('monitoring', 'Failed to list all meetings', error);
            return [];
        }
    }

    public async getById(id: string): Promise<MonitoringMeetingRecord | null> {
        const listPath = await this.schema.resolveListPath();
        if (!listPath) return null;
        
        const spId = await this.dataAccess.findSpIdByRecordId(id, listPath);
        if (spId === null) return null;

        const fields = await this.schema.getResolvedCanonicalNames();
        try {
            const response = await this.spFetch(`${listPath}/items(${spId})?$select=Id,Title,${Object.values(fields).filter(v => !!v).join(',')}`);
            const row = await response.json();
            return this.dataAccess.mapSpRowToRecord(row, fields);
        } catch (error) {
            auditLog.error('monitoring', `Failed to get meeting by id: ${id}`, error);
            return null;
        }
    }

    public async listByUser(userId: string): Promise<MonitoringMeetingRecord[]> {
        const listPath = await this.schema.resolveListPath();
        if (!listPath) return [];
        return this.dataAccess.load(userId, listPath);
    }

    public async listByIsp(ispId: string): Promise<MonitoringMeetingRecord[]> {
        const listPath = await this.schema.resolveListPath();
        if (!listPath) return [];
        return this.dataAccess.loadByIsp(ispId, listPath);
    }

    public async save(record: MonitoringMeetingRecord): Promise<MonitoringMeetingRecord> {
        const listPath = await this.schema.resolveListPath();
        if (!listPath) throw new Error('[MonitoringRepository] List path resolution failed');

        const existingSpId = await this.dataAccess.findSpIdByRecordId(record.id, listPath);
        await this.saver.save(record, listPath, existingSpId);

        const updated = await this.getById(record.id);
        if (!updated) throw new Error('Failed to re-fetch meeting after save');
        return updated;
    }

    public async delete(id: string): Promise<void> {
        const listPath = await this.schema.resolveListPath();
        if (!listPath) return;

        const spId = await this.dataAccess.findSpIdByRecordId(id, listPath);
        if (spId === null) return;

        try {
            await this.spFetch(`${listPath}/items(${spId})`, {
                method: 'POST',
                headers: { 'X-HTTP-Method': 'DELETE', 'IF-MATCH': '*' }
            });
        } catch (error) {
            auditLog.error('monitoring', `Failed to delete meeting: ${id}`, error);
            throw error;
        }
    }
}
