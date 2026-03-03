# ドメインスキーマの単体テスト不在

- **対象ファイル**:
  - `src/features/audit/schema.ts`
  - `src/features/schedules/domain/schema.ts`
  - `src/features/service-provision/domain/schema.ts`
- **カテゴリ**: テスト
- **現状の課題**:
  3 つのドメインスキーマ（Zod スキーマ定義）に対して `.spec.ts` が存在しません。
  スキーマはドメインの Single Source of Truth（SSOT）であり、バリデーションルールを定義する最重要ファイルです。

  テストがないため:
  1. スキーマの変更によるバリデーション崩壊がサイレントに発生するリスク
  2. エッジケース（空文字列、null、境界値）に対するバリデーションが未検証
  3. SP から取得したデータのパースが失敗してもテストで検出できない
- **解決策の提案**:
  各スキーマに対して、正常系・異常系・エッジケースをカバーするテストを追加:
  ```typescript
  // schema.spec.ts
  describe('ScheduleCoreSchema', () => {
    it('parses valid schedule data', () => {
      const valid = { title: '朝会', startDate: '2026-03-01', ... };
      expect(() => ScheduleCoreSchema.parse(valid)).not.toThrow();
    });

    it('rejects schedule with empty title', () => {
      const invalid = { title: '', ... };
      expect(() => ScheduleCoreSchema.parse(invalid)).toThrow();
    });

    it('coerces SP date string to ISO format', () => {
      const spDate = { startDate: '2026-03-01T00:00:00.000Z', ... };
      const result = ScheduleCoreSchema.parse(spDate);
      expect(result.startDate).toBe('2026-03-01');
    });
  });
  ```
- **見積もり影響度**: Medium
