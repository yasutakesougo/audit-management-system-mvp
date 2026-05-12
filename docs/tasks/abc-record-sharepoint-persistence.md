## AI作業指示書: ABC記録の SharePoint 永続化と本番監査対応

### 🎯 タスク概要
LocalStorageベースになっているABC記録機能（行動観察記録）を、本番運用および制度監査に対応できる **SharePoint リスト（`AbcBehaviorRecords`）による永続化** へと移行・昇格します。その際、不変性の確保や論理削除（ソフトデリート）などの厳格な監査証跡要件を満たした実装を行います。

### 📋 前提条件
- ブランチ: `feat/abc-sharepoint-persistence`
- ベース: `main`

### 🔒 制約
- **破壊的変更禁止：** 既存のフロントエンドUI（`AbcRecordPage.tsx`, `QuickRecordTab.tsx`, `LogTab.tsx` など）の大規模な改修やデザイン変更は行わない。
- **後方互換性の維持：** 既存の LocalStorage リポジトリの実装および動作・テストを破壊しない。環境変数や注入ロジックによって Repository の切り替え（Local ⇔ SharePoint）が容易にできるようにする。
- **監査要件の遵守：** データの物理削除を禁止し、ソフトデリートを適用。作成者（`createdBy` / `recorderName`）および作成日時（`createdAt`）は不変（Immutable）とし、更新不可とする。
- `any` の使用禁止（TypeScriptの型安全性を維持）。

---

### 💡 追加設計メモ（本番・監査対策）

- **不変・履歴管理フィールドの明記：** 
  SharePointフィールド定義には、作成時の `CreatedAt` および更新時の `UpdatedAt` を必ず含めて制御します。
- **ドメイン命名とSharePoint物理列名の対応（mapper）：** 
  ドメインモデルとSharePoint側の物理内部列名の命名マッピングは、以下のように mapper 内で明確に対応させてください。
  - `abcRecordId` ↔ `AbcRecordId`
  - `createdBy` ↔ `CreatedByCode`
  - `updatedBy` ↔ `UpdatedByCode`
  - `deletedBy` ↔ `DeletedByCode`
  - `createdAt` ↔ `CreatedAt`
  - `updatedAt` ↔ `UpdatedAt`
  - `recorderName` ↔ `RecorderName`
- **TBS（時間帯別支援）文脈の拡張：** 
  監査時の説明可能性を強化するため、連携元の `SourceSlotId` に加え、当時のタイムスロット名を表す `SourceSlotLabel` も保存対象にします。
- **既存データ・未作成データ（null）の互換性考慮：** 
  一覧取得（`getAll` / `getByUserId`）のクエリ時、SharePointのフィルタ条件において `IsDeleted ne 1` を意識しつつ、取得した TypeScript 側でも `record.isDeleted !== true` の条件を最終フィルタとして適用してください。これにより、列追加直後の null 値や古い既存データがあっても安全に機能します。
- **Repository切り替えの既存方針準拠：** 
  新しい環境変数を新設するのではなく、すでにシステムに存在する既存の data provider 切り替え方針（**`VITE_DATA_PROVIDER=sharepoint`** の場合に `SharePointAbcRecordRepository` を使用、それ以外は `localAbcRecordRepository` にフォールバックする）に従います。
- **ソフトデリート済みデータの除外範囲：** 
  ソフトデリート（`isDeleted === true`）されたデータは、通常の `getAll`, `getByUserId`, `getById` のクエリ結果から完全に除外します。監査ビューなどのための `includeDeleted` オプションは将来の拡張とし、今回のPRスコープからは除外します。

---

### ステップ1: [ドメイン型およびインターフェースの拡張]
**ファイル：** `src/domain/abc/abcRecord.ts`
**内容：**
本番監査・論理削除（ソフトデリート）に耐えうるよう、`AbcRecord` インターフェース、`AbcRecordCreateInput`、およびリポジトリインターフェースを拡張・更新します。

1. `AbcRecord` インターフェースに以下の監査項目を追加：
   - `abcRecordId`: string (安定UUID。将来の EvidenceLink で利用する永続的なID)
   - `createdBy`: string (作成者のアカウントID・不変)
   - `createdAt`: string (作成日時・不変)
   - `updatedAt`?: string (更新日時)
   - `updatedBy`?: string (更新者ID)
   - `isDeleted`?: boolean (論理削除フラグ)
   - `deletedAt`?: string (削除日時)
   - `deletedBy`?: string (削除者ID)
2. `AbcRecordCreateInput` を更新し、作成時に `abcRecordId` や `createdBy` を渡せる（あるいは自動生成される）ように定義。

**完了条件：**
- `abcRecord.ts` 内の型定義が正常に更新され、他ファイルでコンパイルエラーが発生しない（型チェック通過）。

---

### ステップ2: [LocalStorage リポジトリの非破壊的アップデート]
**ファイル：** `src/infra/localStorage/localAbcRecordRepository.ts`
**内容：**
ステップ1での型変更およびソフトデリート要件に伴い、既存の LocalStorage 実装をアップデートします。

1. `save` 時に `abcRecordId` (UUID) を自動生成（既存の `generateId` を利用するか、`crypto.randomUUID()` 等を利用）、`isDeleted: false` および `createdAt` を初期化。
2. `delete` メソッドにおいて、レコードの物理削除（`filter` による配列除外）を廃止し、該当IDのレコードに対して **`isDeleted = true`, `deletedAt = [現在日時]`, `deletedBy = "system"`** をセットするソフトデリート更新に変更。
3. `getAll` および `getByUserId` では、`isDeleted !== true` の未削除レコードのみをフィルタリングして返す。

**完了条件：**
- LocalStorage リポジトリが拡張インターフェースを正常に実装できていること。
- `src/infra/localStorage/` 関連の既存テストがすべてパスすること。

---

### ステップ3: [SharePoint フィールド定義とリスト登録]
**新規ファイル：** `src/sharepoint/fields/abcRecordFields.ts`
**変更ファイル：** `src/sharepoint/spListRegistry.definitions.ts`
**内容：**
SharePoint 上に作成するリスト **`AbcBehaviorRecords`** のスキーマ（フィールド構造）を定義します。

1. `src/sharepoint/fields/abcRecordFields.ts` に、以下のフィールドメタデータを定義します。
   ```typescript
   import type { SharePointFieldDefinition } from '../types';

   export const abcRecordFields: Record<string, SharePointFieldDefinition> = {
     AbcRecordId: { internalName: 'AbcRecordId', displayName: 'ABC記録UUID', type: 'Text', required: true },
     UserId: { internalName: 'UserId', displayName: '利用者ID', type: 'Text', required: true },
     RecordDate: { internalName: 'RecordDate', displayName: '発生日', type: 'Text', required: true },
     OccurredAt: { internalName: 'OccurredAt', displayName: '発生日時', type: 'Text', required: true },
     Setting: { internalName: 'Setting', displayName: '発生場面', type: 'Text' },
     Antecedent: { internalName: 'Antecedent', displayName: '先行事象(A)', type: 'Note', required: true },
     Behavior: { internalName: 'Behavior', displayName: '行動(B)', type: 'Note', required: true },
     Consequence: { internalName: 'Consequence', displayName: '結果(C)', type: 'Note', required: true },
     Intensity: { internalName: 'Intensity', displayName: '強度', type: 'Text', required: true },
     DurationMinutes: { internalName: 'DurationMinutes', displayName: '継続時間(分)', type: 'Number' },
     RiskFlag: { internalName: 'RiskFlag', displayName: '危険行動フラグ', type: 'Boolean' },
     TagsJson: { internalName: 'TagsJson', displayName: 'タグ配列JSON', type: 'Note' },
     Notes: { internalName: 'Notes', displayName: '補足メモ', type: 'Note' },
     SourcePage: { internalName: 'SourcePage', displayName: '遷移元画面', type: 'Text' },
     SourceDate: { internalName: 'SourceDate', displayName: 'TBS記録日', type: 'Text' },
     SourceSlotId: { internalName: 'SourceSlotId', displayName: 'タイムスロットID', type: 'Text' },
     SourceSlotLabel: { internalName: 'SourceSlotLabel', displayName: 'タイムスロット名', type: 'Text' },
     ReturnUrl: { internalName: 'ReturnUrl', displayName: '帰還先URL', type: 'Note' },
     RecorderName: { internalName: 'RecorderName', displayName: '記録者名', type: 'Text' },
     CreatedByCode: { internalName: 'CreatedByCode', displayName: '作成者コード', type: 'Text' },
     UpdatedByCode: { internalName: 'UpdatedByCode', displayName: '更新者コード', type: 'Text' },
     CreatedAt: { internalName: 'CreatedAt', displayName: '作成日時', type: 'Text', required: true },
     UpdatedAt: { internalName: 'UpdatedAt', displayName: '更新日時', type: 'Text' },
     IsDeleted: { internalName: 'IsDeleted', displayName: '削除フラグ', type: 'Boolean' },
     DeletedAt: { internalName: 'DeletedAt', displayName: '削除日時', type: 'Text' },
     DeletedByCode: { internalName: 'DeletedByCode', displayName: '削除者コード', type: 'Text' },
   };
   ```
2. `src/sharepoint/spListRegistry.definitions.ts` のレジストリ（`LIST_REGISTRY`）に、`AbcBehaviorRecords` リストを登録し、診断スキーマチェックや Provision 対象になるように設定。

**完了条件：**
- 新規フィールド定義がエラーなくインポート・エクスポートできていること。
- リスト定義の追加によるスキーマ診断ツールでの読み込みテストにパスすること。

---

### ステップ4: [SharePoint リポジトリの実装]
**新規ファイル：** `src/infra/sharepoint/SharePointAbcRecordRepository.ts`
**内容：**
`AbcRecordRepository` インターフェースを実装した本番用のリポジトリクラス（またはオブジェクト）を新規作成します。

1. 既存の `SharePointClient`（または汎用リストクライアント）を使用して、`AbcBehaviorRecords` リストに対する CRUD 操作を実装。
2. **データのマッピング（相互復元）：**
   - 保存時、`tags` 配列を JSON 文字列に、`sourceContext`（`slotId`, `date`, `source`, `slotLabel` 等）を個別カラム（`SourcePage`, `SourceSlotId`, `SourceSlotLabel`, `SourceDate` 等）に適切に分割して payload に変換。
   - 命名規則に従い、`createdBy` ↔ `CreatedByCode` などのマッピングルールを厳密に適用。
   - 読み込み時、`TagsJson` を JSON パースして `tags` 配列に戻し、個別カラムを `sourceContext` オブジェクトとして再組み立て。
3. **監査・ソフトデリート制御：**
   - `save`：新しい `abcRecordId`（UUID）の発行、`createdAt` および `recorderName` (または `createdBy`) を初期設定。`IsDeleted: false` に設定。
   - `update`：`createdAt`, `recorderName` などの不変フィールドの書き換えをガードレールで禁止。代わりに `UpdatedAt` および `UpdatedByCode` を設定。
   - `delete`：物理削除（SharePointの項目削除）は実行せず、`IsDeleted = true`, `DeletedAt`, `DeletedByCode` を設定する update 処理として実装。
   - `getAll` / `getByUserId` / `getById`：
     - 通常は `IsDeleted ne 1`（論理削除されていないもの）のみを条件（`$filter`）として取得。
     - 列追加直後や既存の null/未定義データに対応するため、TypeScript 側で最終フィルタとして `record.isDeleted !== true` の追加チェックを適用し、安全性を最高レベルにする。
     - ソフトデリートされたものは原則として呼び出し元に返さない（includeDeleted は将来拡張とし今回のPRでは対象外）。

**完了条件：**
- インターフェース `AbcRecordRepository` を不備なく完全実装していること。
- 型エラーがないこと。

---

### ステップ5: [SharePoint リポジトリの単体テスト作成]
**新規ファイル：** `src/infra/sharepoint/__tests__/SharePointAbcRecordRepository.spec.ts`
**内容：**
作成した `SharePointAbcRecordRepository` のデータマッピングと、監査・論理削除制御ロジックを検証する単体テストを追加します（`vitest` を使用）。

**テスト項目：**
- ABC記録を SharePoint 向けの平坦なペイロードに正しく変換できること。
- SharePoint の行（row / item）から `AbcRecord` ドメインモデルに完全復元できること（`tags` JSON、`sourceContext` / `SourceSlotLabel` の復元検証を含む）。
- `save` 時に `abcRecordId`（UUID）が自動付与され、`IsDeleted: false` が正しく格納されること。
- `delete` 時に物理削除ではなく、論理削除属性（`IsDeleted`）が送信されること。
- `update` 時に `createdAt` / `recorderName` の上書き要求を無視、あるいはガードされること。
- `getAll` 時に論理削除（IsDeleted=true）または null/未定義データ互換処理が正しく働き、未削除レコードのみが返されること。

**完了条件：**
- 新規追加したテストが 100% グリーン（通過）すること。

---

### ステップ6: [Repository Provider/Factory によるインジェクション整備]
**ファイル：** 影響範囲の差し替え（例: Repository ファクトリや Provider などの Repository 読み込み箇所）
**内容：**
現在 `localAbcRecordRepository` を直接インポートして使用している箇所を、既存の **`VITE_DATA_PROVIDER=sharepoint`** の起動方針に合わせるようにインジェクション、または切り替えファクトリを作成して差し替えます。

1. 原則として、環境変数 `VITE_DATA_PROVIDER=sharepoint` の場合にのみ `SharePointAbcRecordRepository` をインスタンス化して注入する。
2. それ以外（空値、`local`、その他のプロバイダー）の場合は自動的に `localAbcRecordRepository` にフォールバックする安全設計にする。

**完了条件：**
- フロントエンド UI が、既存の data provider 方針に則って Repository を安全に切り替えられ、LocalStorage 動作時にも一切不具合が生じないこと。

---

### ステップ7: [最終動作確認とビルド検証]
**検証手順：**
1. ターミナルで TypeScript のビルドチェックを実行。
   ```bash
   npm run typecheck
   ```
2. 関連するテスト一式を実行。
   ```bash
   npx vitest run src/domain/abc
   npx vitest run src/pages/abc-record
   npx vitest run src/infra/sharepoint
   ```

**完了条件：**
- 型エラーが 0 件であること。
- 全テスト（既存テスト・新規追加テスト）がパスすること。

---

### 🚫 禁止事項
1. **無関係な変更の禁止：** `TimeBasedSupportRecordPage` や `LogTab` などの UI コンポーネントに対し、スタイルの変更や、機能の本質に無関係なリファクタリングを混入させない。
2. **既存 import パスの破壊：** 他のドメイン（ISP、PDCA、TBSなど）から参照されている `AbcRecord` やリポジトリの import パスを壊さない。
3. **新規の重い外部ライブラリ依存追加：** UUID 生成などに標準機能（`crypto.randomUUID` 等）を利用し、無駄に npm パッケージを増やさない。
4. **物理削除の実装：** いかなる状況下でも SharePoint に対する DELETE API を呼ばない。

### ✅ 最終完了条件
- [ ] TypeScript 型チェッククリア (`npm run typecheck` 通過)
- [ ] 既存の LocalStorage テストおよび挙動が一切壊れていないこと
- [ ] `SharePointAbcRecordRepository` に対する堅牢な単体テストが追加され、全てパスしていること
- [ ] 論理削除、監査履歴（作成時・更新時・削除時の個別追跡）、安定ID（UUID）の仕様が完全に満たされていること
- [ ] コミットメッセージ: `feat(abc): persist ABC records to SharePoint` で整理されたコミットを積む
