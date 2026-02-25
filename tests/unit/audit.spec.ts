import { beforeEach, describe, expect, it } from 'vitest';
import { AuditEvent, clearAudit, pushAudit, readAudit, retainAuditWhere } from '../../src/lib/audit';

// Provide a simple in-memory mock for localStorage
class MemoryStorage {
	store: Record<string,string> = {};
	getItem(k: string) { return this.store[k] ?? null; }
	setItem(k: string, v: string) { this.store[k] = v; }
	removeItem(k: string) { delete this.store[k]; }
	clear() { this.store = {}; }
}

describe('audit localStorage helpers', () => {
	const mem = new MemoryStorage();
	beforeEach(() => {
		mem.clear();
		vi.stubGlobal('localStorage', mem);
	});

	it('pushAudit and readAudit round-trip', () => {
		pushAudit({ actor: 'u1', action: 'CREATE', entity: 'Rec', channel: 'UI', after: { a: 1 } });
		const logs = readAudit();
		expect(logs.length).toBe(1);
		expect(logs[0].actor).toBe('u1');
		expect(logs[0].ts).toMatch(/Z$/);
	});

	it('clearAudit removes stored logs', () => {
		pushAudit({ actor: 'u1', action: 'CREATE', entity: 'Rec', channel: 'UI', after: {} });
		clearAudit();
		expect(readAudit().length).toBe(0);
	});

	it('retainAuditWhere keeps only matching logs', () => {
		pushAudit({ actor: 'u1', action: 'CREATE', entity: 'Rec', channel: 'UI', after: { id: 1 } });
		pushAudit({ actor: 'u2', action: 'UPDATE', entity: 'Rec', channel: 'UI', after: { id: 2 } });
		retainAuditWhere((ev: AuditEvent) => ev.actor === 'u1');
		const logs = readAudit();
		expect(logs.length).toBe(1);
		expect(logs[0].actor).toBe('u1');
	});
});
