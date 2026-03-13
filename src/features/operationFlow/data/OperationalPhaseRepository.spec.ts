import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryOperationalPhaseRepository } from './InMemoryOperationalPhaseRepository';
import { DEFAULT_PHASE_CONFIG } from '../domain/defaultPhaseConfig';
import {
  createOperationalPhaseRepository,
  __resetRepositoryForTesting,
} from './createOperationalPhaseRepository';
import type { OperationFlowPhaseConfig } from '../domain/operationFlowTypes';

// ────────────────────────────────────────
// InMemoryOperationalPhaseRepository
// ────────────────────────────────────────

describe('InMemoryOperationalPhaseRepository', () => {
  let repo: InMemoryOperationalPhaseRepository;

  beforeEach(() => {
    repo = new InMemoryOperationalPhaseRepository();
  });

  // ── getAll ──

  it('getAll は初期状態でデフォルト設定を返す', async () => {
    const result = await repo.getAll();
    expect(result).toHaveLength(DEFAULT_PHASE_CONFIG.length);
    expect(result[0].phaseKey).toBe('staff_prep');
    expect(result[result.length - 1].phaseKey).toBe('after_hours_review');
  });

  it('getAll は sortOrder 順にソートされた配列を返す', async () => {
    const result = await repo.getAll();
    for (let i = 1; i < result.length; i++) {
      expect(result[i].sortOrder).toBeGreaterThanOrEqual(result[i - 1].sortOrder);
    }
  });

  it('getAll はディープコピーを返す（外部変更が内部に影響しない）', async () => {
    const result = await repo.getAll();
    // 外部で変更
    (result[0] as { label: string }).label = 'MUTATED';
    // 内部は変わらない
    const result2 = await repo.getAll();
    expect(result2[0].label).toBe('出勤・朝準備');
  });

  // ── saveAll ──

  it('saveAll で保存した設定が getAll で取得できる', async () => {
    const custom: OperationFlowPhaseConfig[] = [
      {
        phaseKey: 'staff_prep',
        label: 'カスタム朝準備',
        startTime: '07:00',
        endTime: '08:00',
        primaryScreen: '/today',
        sortOrder: 0,
      },
      {
        phaseKey: 'morning_briefing',
        label: 'カスタム朝会',
        startTime: '08:00',
        endTime: '08:30',
        primaryScreen: '/handoff-timeline',
        sortOrder: 1,
      },
    ];

    await repo.saveAll(custom);
    const result = await repo.getAll();

    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('カスタム朝準備');
    expect(result[0].startTime).toBe('07:00');
    expect(result[1].label).toBe('カスタム朝会');
  });

  it('saveAll はディープコピーを保持する（保存後の外部変更が内部に影響しない）', async () => {
    const custom: OperationFlowPhaseConfig[] = [
      {
        phaseKey: 'staff_prep',
        label: 'オリジナル',
        startTime: '08:30',
        endTime: '09:00',
        primaryScreen: '/today',
        sortOrder: 0,
      },
    ];

    await repo.saveAll(custom);
    // 外部で変更
    (custom[0] as { label: string }).label = 'MUTATED';
    // 内部は変わらない
    const result = await repo.getAll();
    expect(result[0].label).toBe('オリジナル');
  });

  it('saveAll は既存の設定を完全に置換する', async () => {
    // 最初はデフォルト9件
    const before = await repo.getAll();
    expect(before).toHaveLength(9);

    // 2件だけ保存
    await repo.saveAll([
      {
        phaseKey: 'am_activity',
        label: '午前のみ',
        startTime: '09:00',
        endTime: '12:00',
        primaryScreen: '/today',
        sortOrder: 0,
      },
      {
        phaseKey: 'pm_activity',
        label: '午後のみ',
        startTime: '12:00',
        endTime: '17:00',
        primaryScreen: '/daily',
        sortOrder: 1,
      },
    ]);

    const after = await repo.getAll();
    expect(after).toHaveLength(2);
  });

  // ── resetToDefault ──

  it('resetToDefault はデフォルト設定を復元し返す', async () => {
    // カスタム設定に変更
    await repo.saveAll([
      {
        phaseKey: 'staff_prep',
        label: 'カスタム',
        startTime: '07:00',
        endTime: '08:00',
        primaryScreen: '/today',
        sortOrder: 0,
      },
    ]);
    expect((await repo.getAll())).toHaveLength(1);

    // リセット
    const result = await repo.resetToDefault();
    expect(result).toHaveLength(DEFAULT_PHASE_CONFIG.length);
    expect(result[0].phaseKey).toBe('staff_prep');
    expect(result[0].label).toBe('出勤・朝準備');
  });

  it('resetToDefault 後の getAll もデフォルトを返す', async () => {
    await repo.saveAll([]);
    await repo.resetToDefault();
    const result = await repo.getAll();
    expect(result).toHaveLength(DEFAULT_PHASE_CONFIG.length);
  });

  // ── コンストラクタ ──

  it('カスタム初期値でインスタンス化できる', async () => {
    const customRepo = new InMemoryOperationalPhaseRepository([
      {
        phaseKey: 'am_activity',
        label: 'カスタム初期値',
        startTime: '09:00',
        endTime: '12:00',
        primaryScreen: '/today',
        sortOrder: 0,
      },
    ]);
    const result = await customRepo.getAll();
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('カスタム初期値');
  });
});

// ────────────────────────────────────────
// createOperationalPhaseRepository (factory)
// ────────────────────────────────────────

describe('createOperationalPhaseRepository', () => {
  beforeEach(() => {
    __resetRepositoryForTesting();
  });

  it('Repository インスタンスを返す', () => {
    const repo = createOperationalPhaseRepository();
    expect(repo).toBeDefined();
    expect(typeof repo.getAll).toBe('function');
    expect(typeof repo.saveAll).toBe('function');
    expect(typeof repo.resetToDefault).toBe('function');
  });

  it('同一インスタンスを返す（シングルトン）', () => {
    const repo1 = createOperationalPhaseRepository();
    const repo2 = createOperationalPhaseRepository();
    expect(repo1).toBe(repo2);
  });

  it('__resetRepositoryForTesting 後は新しいインスタンスを返す', () => {
    const repo1 = createOperationalPhaseRepository();
    __resetRepositoryForTesting();
    const repo2 = createOperationalPhaseRepository();
    expect(repo1).not.toBe(repo2);
  });

  it('factory 経由のインスタンスでデフォルト設定を取得できる', async () => {
    const repo = createOperationalPhaseRepository();
    const result = await repo.getAll();
    expect(result).toHaveLength(DEFAULT_PHASE_CONFIG.length);
  });

  it('factory 経由のインスタンスで saveAll → getAll が動く', async () => {
    const repo = createOperationalPhaseRepository();
    await repo.saveAll([
      {
        phaseKey: 'staff_prep',
        label: 'テスト',
        startTime: '08:00',
        endTime: '09:00',
        primaryScreen: '/today',
        sortOrder: 0,
      },
    ]);
    const result = await repo.getAll();
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('テスト');
  });
});
