/**
 * assignmentQualificationChecker — 純粋関数の単体テスト
 */
import { describe, it, expect } from 'vitest';
import {
  findUsersWithUnqualifiedAssignment,
  type AssignmentMinimal,
} from '@/domain/regulatory/assignmentQualificationChecker';

const makeAssignment = (
  overrides: Partial<AssignmentMinimal> = {},
): AssignmentMinimal => ({
  staffId: 'STF001',
  userId: 'U001',
  assignedFrom: '2025-01-01',
  assignmentType: 'primary',
  ...overrides,
});

const TODAY = '2026-03-14';

describe('findUsersWithUnqualifiedAssignment', () => {

  it('対象者が空の場合、空を返す', () => {
    const result = findUsersWithUnqualifiedAssignment([], [], new Map(), TODAY);
    expect(result).toEqual([]);
  });

  it('基礎研修修了職員が配置されている場合、不足なし', () => {
    const assignments = [
      makeAssignment({ staffId: 'STF001', userId: 'U001' }),
    ];
    const certs = new Map<string, string[]>([
      ['STF001', ['基礎研修']],
    ]);
    const result = findUsersWithUnqualifiedAssignment(
      ['U001'],
      assignments,
      certs,
      TODAY,
    );
    expect(result).toEqual([]);
  });

  it('実践研修修了職員も適格とみなす', () => {
    const assignments = [
      makeAssignment({ staffId: 'STF001', userId: 'U001' }),
    ];
    const certs = new Map<string, string[]>([
      ['STF001', ['実践研修']],
    ]);
    const result = findUsersWithUnqualifiedAssignment(
      ['U001'],
      assignments,
      certs,
      TODAY,
    );
    expect(result).toEqual([]);
  });

  it('資格なし主担当がいる場合、不足を検出する', () => {
    const assignments = [
      makeAssignment({ staffId: 'STF001', userId: 'U001' }),
    ];
    const certs = new Map<string, string[]>([
      ['STF001', ['ヘルパー2級']],
    ]);
    const result = findUsersWithUnqualifiedAssignment(
      ['U001'],
      assignments,
      certs,
      TODAY,
    );
    expect(result).toEqual(['U001']);
  });

  it('副担当（sub）は資格チェック対象外', () => {
    const assignments = [
      makeAssignment({ staffId: 'STF001', userId: 'U001', assignmentType: 'sub' }),
    ];
    const certs = new Map<string, string[]>([
      ['STF001', []],  // 資格なし
    ]);
    const result = findUsersWithUnqualifiedAssignment(
      ['U001'],
      assignments,
      certs,
      TODAY,
    );
    // primary 配置がないのでスキップ
    expect(result).toEqual([]);
  });

  it('配置終了済みの職員は除外する', () => {
    const assignments = [
      makeAssignment({
        staffId: 'STF001',
        userId: 'U001',
        assignedTo: '2025-12-31',  // 終了済み
      }),
    ];
    const certs = new Map<string, string[]>([
      ['STF001', []],  // 資格なし
    ]);
    const result = findUsersWithUnqualifiedAssignment(
      ['U001'],
      assignments,
      certs,
      TODAY,
    );
    // 配置がないのでスキップ
    expect(result).toEqual([]);
  });

  it('複数利用者を個別に判定する', () => {
    const assignments = [
      makeAssignment({ staffId: 'STF001', userId: 'U001' }),
      makeAssignment({ staffId: 'STF002', userId: 'U002' }),
    ];
    const certs = new Map<string, string[]>([
      ['STF001', ['基礎研修']],    // OK
      ['STF002', ['ヘルパー2級']],  // NG
    ]);
    const result = findUsersWithUnqualifiedAssignment(
      ['U001', 'U002'],
      assignments,
      certs,
      TODAY,
    );
    expect(result).toEqual(['U002']);
  });

  it('資格情報がない職員は不足扱い', () => {
    const assignments = [
      makeAssignment({ staffId: 'STF001', userId: 'U001' }),
    ];
    const certs = new Map<string, string[]>();  // 登録なし
    const result = findUsersWithUnqualifiedAssignment(
      ['U001'],
      assignments,
      certs,
      TODAY,
    );
    expect(result).toEqual(['U001']);
  });
});
