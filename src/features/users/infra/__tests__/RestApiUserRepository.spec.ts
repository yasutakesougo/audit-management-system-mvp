import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IUserMasterCreateDto } from '../../types';

const MISSING_TRANSPORT_SCHEDULE_COLUMN_ERROR =
  'Users_Master に TransportSchedule 列がないため、送迎手段を保存できません。管理者に列追加を依頼してください。';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const writableFieldsResponse = (includeTransportSchedule: boolean): Response => {
  const base = [
    { InternalName: 'FullName', ReadOnlyField: false, Hidden: false },
    { InternalName: 'TransportCourse', ReadOnlyField: false, Hidden: false },
  ];
  if (includeTransportSchedule) {
    base.push({
      InternalName: 'TransportSchedule',
      ReadOnlyField: false,
      Hidden: false,
    });
  }
  return jsonResponse({ value: base });
};

const baseRow = (transportSchedule: string) => ({
  Id: 15,
  Title: 'u-15',
  UserID: 'U-015',
  FullName: '更新テスト',
  TransportSchedule: transportSchedule,
});

const loadRepository = async () => {
  vi.resetModules();
  const mod = await import('../RestApiUserRepository');
  return mod.RestApiUserRepository;
};

describe('RestApiUserRepository transport schedule persistence', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('includes TransportSchedule in create request and maps it back to domain', async () => {
    const RestApiUserRepository = await loadRepository();
    const scheduleJson = JSON.stringify({
      月: { to: 'office_shuttle', from: 'family_car' },
    });
    let createRequestBody: Record<string, unknown> | null = null;

    const spFetch = vi.fn(async (path: string, init?: RequestInit) => {
      if (path.includes('/fields?$select=')) {
        return writableFieldsResponse(true);
      }
      if (path.endsWith('/items') && init?.method === 'POST') {
        createRequestBody = JSON.parse(String(init.body)) as Record<string, unknown>;
        return jsonResponse(baseRow(scheduleJson), 201);
      }
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${path}`);
    });

    const repo = new RestApiUserRepository({ spFetch });
    const payload: IUserMasterCreateDto = {
      FullName: '作成テスト',
      TransportSchedule: scheduleJson,
    };

    const created = await repo.create(payload);

    expect(createRequestBody).toMatchObject({
      FullName: '作成テスト',
      TransportSchedule: scheduleJson,
    });
    expect(created.TransportSchedule).toBe(scheduleJson);
  });

  it('includes TransportSchedule in update request and restores it via getById', async () => {
    const RestApiUserRepository = await loadRepository();
    const scheduleJson = JSON.stringify({
      火: { to: 'family_train', from: 'office_shuttle' },
    });
    let updateRequestBody: Record<string, unknown> | null = null;

    const spFetch = vi.fn(async (path: string, init?: RequestInit) => {
      if (path.includes('/fields?$select=')) {
        return writableFieldsResponse(true);
      }
      if (path.includes('/items(15)') && init?.method === 'POST') {
        updateRequestBody = JSON.parse(String(init.body)) as Record<string, unknown>;
        return new Response(null, { status: 204 });
      }
      if (path.includes('/items(15)')) {
        return jsonResponse(baseRow(scheduleJson));
      }
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${path}`);
    });

    const repo = new RestApiUserRepository({ spFetch });
    const updated = await repo.update(15, {
      FullName: '更新テスト',
      TransportSchedule: scheduleJson,
    });

    expect(updateRequestBody).toMatchObject({
      FullName: '更新テスト',
      TransportSchedule: scheduleJson,
    });
    expect(updated.TransportSchedule).toBe(scheduleJson);
  });

  it('fails fast with a fixed message when writable fields do not include TransportSchedule', async () => {
    const RestApiUserRepository = await loadRepository();
    let createCalled = false;

    const spFetch = vi.fn(async (path: string, init?: RequestInit) => {
      if (path.includes('/fields?$select=')) {
        return writableFieldsResponse(false);
      }
      if (path.endsWith('/items') && init?.method === 'POST') {
        createCalled = true;
      }
      return jsonResponse({});
    });

    const repo = new RestApiUserRepository({ spFetch });
    await expect(
      repo.create({
        FullName: '列欠落テスト',
        TransportSchedule: '{"水":{"to":"office_shuttle","from":"office_shuttle"}}',
      }),
    ).rejects.toThrow(MISSING_TRANSPORT_SCHEDULE_COLUMN_ERROR);

    expect(createCalled).toBe(false);
  });
});

describe('RestApiUserRepository lifecycle fallback safety', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('marks lifecycleStatus as unknown when lifecycle signals are missing', async () => {
    const RestApiUserRepository = await loadRepository();
    const spFetch = vi.fn(async (path: string) => {
      if (path.includes('/items')) {
        return jsonResponse({
          value: [{ Id: 1, UserID: 'U-001', FullName: '信号不足ユーザー' }],
        });
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    const repo = new RestApiUserRepository({ spFetch });
    const users = await repo.getAll({ selectMode: 'core' });

    expect(users).toHaveLength(1);
    expect(users[0]?.lifecycleStatus).toBe('unknown');
  });

  it('downgrades __selectMode to core when detail select fails', async () => {
    const RestApiUserRepository = await loadRepository();
    const spFetch = vi.fn(async (path: string) => {
      if (path.includes('/items?$select=')) {
        throw new Error("The field or property 'UsageStatus' does not exist.");
      }
      if (path.includes('/items')) {
        return jsonResponse({
          value: [{ Id: 2, UserID: 'U-002', FullName: 'フォールバックユーザー' }],
        });
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    const repo = new RestApiUserRepository({ spFetch });
    const users = await repo.getAll({ selectMode: 'detail' });

    expect(users).toHaveLength(1);
    expect(users[0]?.__selectMode).toBe('core');
    expect(users[0]?.lifecycleStatus).toBe('unknown');
  });

  it('downgrades __selectMode to core on generic 400 from $select query', async () => {
    const RestApiUserRepository = await loadRepository();
    const spFetch = vi.fn(async (path: string) => {
      if (path.includes('/items?$select=')) {
        const error = new Error('Invalid query.');
        (error as Error & { status?: number }).status = 400;
        throw error;
      }
      if (path.includes('/items')) {
        return jsonResponse({
          value: [{ Id: 3, UserID: 'U-003', FullName: '400フォールバック' }],
        });
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    const repo = new RestApiUserRepository({ spFetch });
    const users = await repo.getAll({ selectMode: 'detail' });

    expect(users).toHaveLength(1);
    expect(users[0]?.__selectMode).toBe('core');
    expect(users[0]?.lifecycleStatus).toBe('unknown');
  });

  it('downgrades getById to core when detail select fails', async () => {
    const RestApiUserRepository = await loadRepository();
    const spFetch = vi.fn(async (path: string) => {
      if (path.includes('/items(15)?$select=')) {
        throw new Error("The field or property 'UsageStatus' does not exist.");
      }
      if (path.includes('/items(15)')) {
        return jsonResponse({ Id: 15, UserID: 'U-015', FullName: '単票フォールバック' });
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    const repo = new RestApiUserRepository({ spFetch });
    const user = await repo.getById(15, { selectMode: 'detail' });

    expect(user).not.toBeNull();
    expect(user?.__selectMode).toBe('core');
    expect(user?.lifecycleStatus).toBe('unknown');
  });

  it('downgrades getById to core on generic 400 from $select query', async () => {
    const RestApiUserRepository = await loadRepository();
    const spFetch = vi.fn(async (path: string) => {
      if (path.includes('/items(16)?$select=')) {
        const error = new Error('Invalid query.');
        (error as Error & { status?: number }).status = 400;
        throw error;
      }
      if (path.includes('/items(16)')) {
        return jsonResponse({ Id: 16, UserID: 'U-016', FullName: '単票400フォールバック' });
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    const repo = new RestApiUserRepository({ spFetch });
    const user = await repo.getById(16, { selectMode: 'detail' });

    expect(user).not.toBeNull();
    expect(user?.__selectMode).toBe('core');
    expect(user?.lifecycleStatus).toBe('unknown');
  });
});
