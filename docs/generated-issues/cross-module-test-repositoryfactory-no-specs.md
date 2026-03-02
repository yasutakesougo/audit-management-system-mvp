# repositoryFactory の単体テスト不在（5モジュール）

- **対象ファイル**:
  - `src/features/attendance/repositoryFactory.ts`
  - `src/features/daily/repositoryFactory.ts`
  - `src/features/schedules/repositoryFactory.ts`
  - `src/features/service-provision/repositoryFactory.ts`
  - `src/features/users/repositoryFactory.ts`
- **カテゴリ**: テスト
- **現状の課題**:
  5 つの主要ドメインの `repositoryFactory.ts` に対してすべて `.spec.ts` が存在しません。
  これらのファイルはアプリケーション全体のデータアクセス層の切り替え（Demo/SharePoint）を担う重要なモジュールです。
  各ファイルは以下の共通構造を持ちます:
  ```typescript
  let cachedRepository: XxxRepository | null = null;
  let cachedKind: XxxRepositoryKind | null = null;
  let overrideRepository: XxxRepository | null = null;
  let overrideKind: XxxRepositoryKind | null = null;
  ```
  テストがないため:
  1. リポジトリの切り替えロジック（環境変数 → Demo/SP 判定）にバグがあっても検出できない
  2. キャッシュの無効化タイミングに関するリグレッションリスク
  3. `overrideRepository`（テスト用DI）が正しく動作するかの保証がない
- **解決策の提案**:
  最小限のテストケースを追加:
  ```typescript
  // repositoryFactory.spec.ts
  describe('repositoryFactory', () => {
    afterEach(() => resetOverride());

    it('returns demo repository by default in test env', () => {
      const { repo, kind } = getRepository();
      expect(kind).toBe('demo');
    });

    it('respects override for DI in tests', () => {
      const mock = createMockRepository();
      setOverride(mock);
      const { repo } = getRepository();
      expect(repo).toBe(mock);
    });

    it('caches repository instance', () => {
      const first = getRepository();
      const second = getRepository();
      expect(first.repo).toBe(second.repo);
    });
  });
  ```
- **見積もり影響度**: Medium
