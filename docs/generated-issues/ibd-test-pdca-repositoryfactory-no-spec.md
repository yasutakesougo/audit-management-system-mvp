# ibd PdcaRepositoryFactory の単体テスト不在

- **対象ファイル**: `src/features/ibd/analysis/pdca/repositoryFactory.ts`
- **カテゴリ**: テスト
- **現状の課題**:
  IBD（Individual Behavior Design）ドメインの PDCA 分析機能における `repositoryFactory.ts` にテストがありません。
  ```typescript
  let cached: { kind: PdcaRepositoryKind; repo: PdcaRepository } | null = null;
  ```
  このファイルはモジュールレベルの `let` でキャッシュされたリポジトリインスタンスを管理しています。
  他の 4 つの `repositoryFactory` と同様の構造ですが、IBD ドメインは分析・可視化機能を含む複雑なドメインであるため、リポジトリ切り替えロジックのテストは特に重要です。
- **解決策の提案**:
  `cross-module-test-repositoryfactory-no-specs` Issue と合わせて対応。PDCA リポジトリの demo/SP 切り替え、キャッシュの動作、DI override のテストを追加する。
- **見積もり影響度**: Low
