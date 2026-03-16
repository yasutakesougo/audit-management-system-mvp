/**
 * UserRelation — ユニットテスト
 *
 * 利用者マスタの共通参照型とヘルパーのテスト。
 */
import {
  toUserRef,
  toUserSnapshot,
  buildUserRefLookup,
  buildUserSnapshotLookup,
  resolveUserNames,
  createUserNameResolver,
  enrichWithUserRef,
  enrichAllWithUserRef,
  userRefSchema,
  userSnapshotSchema,
} from '../userRelation';

// ─── テストデータ ─────────────────────────────────────────

const mockUser = {
  UserID: 'U001',
  FullName: '田中太郎',
  DisabilitySupportLevel: '4',
  severeFlag: true,
  IsHighIntensitySupportTarget: false,
  RecipientCertNumber: 'RC-001',
  RecipientCertExpiry: '2026-03-31',
  GrantPeriodStart: '2025-04-01',
  GrantPeriodEnd: '2026-03-31',
  GrantedDaysPerMonth: '22',
  UsageStatus: '利用中',
};

const mockUser2 = {
  UserID: 'U002',
  FullName: '佐藤花子',
  DisabilitySupportLevel: '3',
  severeFlag: false,
  IsHighIntensitySupportTarget: true,
  RecipientCertNumber: 'RC-002',
  RecipientCertExpiry: '2026-06-30',
  GrantPeriodStart: '2025-04-01',
  GrantPeriodEnd: '2026-03-31',
  GrantedDaysPerMonth: '20',
  UsageStatus: '利用中',
};

const mockUserMinimal = {
  UserID: 'U003',
  FullName: '山田次郎',
  // すべてオプショナルフィールドを省略
};

// ─── toUserRef ─────────────────────────────────────────────

describe('toUserRef', () => {
  it('IUserMaster から UserRef を生成する', () => {
    const ref = toUserRef(mockUser);
    expect(ref).toEqual({
      userId: 'U001',
      userName: '田中太郎',
    });
  });

  it('最小限のフィールドでも生成できる', () => {
    const ref = toUserRef(mockUserMinimal);
    expect(ref).toEqual({
      userId: 'U003',
      userName: '山田次郎',
    });
  });
});

// ─── toUserSnapshot ────────────────────────────────────────

describe('toUserSnapshot', () => {
  it('全フィールドを含むスナップショットを生成する', () => {
    const snapshot = toUserSnapshot(mockUser);
    expect(snapshot.userId).toBe('U001');
    expect(snapshot.userName).toBe('田中太郎');
    expect(snapshot.disabilitySupportLevel).toBe('4');
    expect(snapshot.severeFlag).toBe(true);
    expect(snapshot.isHighIntensitySupportTarget).toBe(false);
    expect(snapshot.recipientCertNumber).toBe('RC-001');
    expect(snapshot.recipientCertExpiry).toBe('2026-03-31');
    expect(snapshot.grantPeriodStart).toBe('2025-04-01');
    expect(snapshot.grantPeriodEnd).toBe('2026-03-31');
    expect(snapshot.grantedDaysPerMonth).toBe('22');
    expect(snapshot.usageStatus).toBe('利用中');
    expect(snapshot.snapshotAt).toBeTruthy();
  });

  it('省略されたフィールドは null/false でデフォルトになる', () => {
    const snapshot = toUserSnapshot(mockUserMinimal);
    expect(snapshot.disabilitySupportLevel).toBeNull();
    expect(snapshot.severeFlag).toBe(false);
    expect(snapshot.isHighIntensitySupportTarget).toBe(false);
    expect(snapshot.recipientCertNumber).toBeNull();
    expect(snapshot.usageStatus).toBeNull();
  });

  it('snapshotAt は ISO 8601 形式', () => {
    const snapshot = toUserSnapshot(mockUser);
    expect(() => new Date(snapshot.snapshotAt)).not.toThrow();
    expect(new Date(snapshot.snapshotAt).toISOString()).toBe(snapshot.snapshotAt);
  });
});

// ─── buildUserRefLookup ────────────────────────────────────

describe('buildUserRefLookup', () => {
  it('利用者マスタ配列からルックアップマップを構築する', () => {
    const lookup = buildUserRefLookup([mockUser, mockUser2]);
    expect(lookup.size).toBe(2);
    expect(lookup.get('U001')?.userName).toBe('田中太郎');
    expect(lookup.get('U002')?.userName).toBe('佐藤花子');
  });

  it('UserID が空のエントリは無視する', () => {
    const lookup = buildUserRefLookup([{ UserID: '', FullName: 'NG' }]);
    expect(lookup.size).toBe(0);
  });

  it('空配列ならサイズ 0', () => {
    const lookup = buildUserRefLookup([]);
    expect(lookup.size).toBe(0);
  });
});

// ─── buildUserSnapshotLookup ───────────────────────────────

describe('buildUserSnapshotLookup', () => {
  it('UserSnapshot のルックアップマップを構築する', () => {
    const lookup = buildUserSnapshotLookup([mockUser, mockUser2]);
    expect(lookup.size).toBe(2);
    const snap = lookup.get('U001');
    expect(snap?.severeFlag).toBe(true);
    expect(snap?.disabilitySupportLevel).toBe('4');
  });
});

// ─── resolveUserNames ──────────────────────────────────────

describe('resolveUserNames', () => {
  it('レコード配列に利用者名を付与する', () => {
    const lookup = buildUserRefLookup([mockUser, mockUser2]);
    const records = [
      { id: 'R1', userId: 'U001', memo: '備考1' },
      { id: 'R2', userId: 'U002', memo: '備考2' },
    ];
    const resolved = resolveUserNames(records, lookup, (r) => r.userId);
    expect(resolved[0].userName).toBe('田中太郎');
    expect(resolved[1].userName).toBe('佐藤花子');
    // 元のフィールドも保持される
    expect(resolved[0].memo).toBe('備考1');
  });

  it('ルックアップにない場合は userId がフォールバック', () => {
    const lookup = buildUserRefLookup([mockUser]);
    const records = [{ id: 'R1', userId: 'UNKNOWN' }];
    const resolved = resolveUserNames(records, lookup, (r) => r.userId);
    expect(resolved[0].userName).toBe('UNKNOWN');
  });
});

// ─── createUserNameResolver ────────────────────────────────

describe('createUserNameResolver', () => {
  it('userId → userName の関数を返す', () => {
    const resolve = createUserNameResolver([mockUser, mockUser2]);
    expect(resolve('U001')).toBe('田中太郎');
    expect(resolve('U002')).toBe('佐藤花子');
  });

  it('未登録の userId はそのまま返す', () => {
    const resolve = createUserNameResolver([mockUser]);
    expect(resolve('UNKNOWN')).toBe('UNKNOWN');
  });

  it('TodayEngine の resolveUserName に直接渡せる', () => {
    const resolve = createUserNameResolver([mockUser]);
    // TodayEngine 型: (userId: string) => string
    const fn: (userId: string) => string = resolve;
    expect(fn('U001')).toBe('田中太郎');
  });
});

// ─── enrichWithUserRef ─────────────────────────────────────

describe('enrichWithUserRef', () => {
  it('レコードに UserRef を付与する', () => {
    const lookup = buildUserRefLookup([mockUser]);
    const record = { id: 'ISP-001', title: '個別支援計画' };
    const enriched = enrichWithUserRef(record, 'U001', lookup);
    expect(enriched).not.toBeNull();
    expect(enriched!.user.userId).toBe('U001');
    expect(enriched!.user.userName).toBe('田中太郎');
    expect(enriched!.title).toBe('個別支援計画');
  });

  it('ユーザーが見つからない場合は null', () => {
    const lookup = buildUserRefLookup([mockUser]);
    const record = { id: 'ISP-001' };
    const result = enrichWithUserRef(record, 'NOT_FOUND', lookup);
    expect(result).toBeNull();
  });
});

// ─── enrichAllWithUserRef ──────────────────────────────────

describe('enrichAllWithUserRef', () => {
  it('レコード配列にバッチで UserRef を付与する', () => {
    const lookup = buildUserRefLookup([mockUser, mockUser2]);
    const records = [
      { id: 'I1', userId: 'U001' },
      { id: 'I2', userId: 'U002' },
    ];
    const enriched = enrichAllWithUserRef(records, lookup, (r) => r.userId);
    expect(enriched.length).toBe(2);
    expect(enriched[0].user.userName).toBe('田中太郎');
    expect(enriched[1].user.userName).toBe('佐藤花子');
  });

  it('ルックアップにないユーザーは userId をフォールバックユーザー名にする', () => {
    const lookup = buildUserRefLookup([]);
    const records = [{ id: 'I1', userId: 'UNKNOWN' }];
    const enriched = enrichAllWithUserRef(records, lookup, (r) => r.userId);
    expect(enriched[0].user.userName).toBe('UNKNOWN');
    expect(enriched[0].user.userId).toBe('UNKNOWN');
  });
});

// ─── Zod Schema Validation ────────────────────────────────

describe('userRefSchema', () => {
  it('有効なデータを受け入れる', () => {
    const result = userRefSchema.safeParse({ userId: 'U001', userName: '田中太郎' });
    expect(result.success).toBe(true);
  });

  it('userId が空文字の場合はエラー', () => {
    const result = userRefSchema.safeParse({ userId: '', userName: '田中太郎' });
    expect(result.success).toBe(false);
  });

  it('userId が欠損の場合はエラー', () => {
    const result = userRefSchema.safeParse({ userName: '田中太郎' });
    expect(result.success).toBe(false);
  });
});

describe('userSnapshotSchema', () => {
  it('全フィールド指定で受け入れる', () => {
    const data = {
      userId: 'U001',
      userName: '田中太郎',
      disabilitySupportLevel: '4',
      severeFlag: true,
      isHighIntensitySupportTarget: false,
      recipientCertNumber: 'RC-001',
      recipientCertExpiry: '2026-03-31',
      grantPeriodStart: '2025-04-01',
      grantPeriodEnd: '2026-03-31',
      grantedDaysPerMonth: '22',
      usageStatus: '利用中',
      snapshotAt: '2026-03-16T00:00:00.000Z',
    };
    const result = userSnapshotSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('オプショナルフィールドを省略してもデフォルトで補完', () => {
    const data = {
      userId: 'U001',
      userName: '田中太郎',
    };
    const result = userSnapshotSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.severeFlag).toBe(false);
      expect(result.data.disabilitySupportLevel).toBeNull();
      expect(result.data.snapshotAt).toBeTruthy();
    }
  });
});
