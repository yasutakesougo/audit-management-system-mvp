# AI作業指示書: PR3「評価欄へ引用」UI連携と証跡リンク保存

## 🎯 タスク概要
PR1 で実装された Dedicated ABC 記録の表示機能（`AbcEvidenceListPanel`）と、PR2 で実装された評価ドラフト自動生成ロジック（`abcRecordEvidenceBridge`）を連携させ、支援計画シート §9 評価欄（モニタリング）において、職員操作によりワンクリックで「評価ドラフトを引用」でき、同時にその客観的根拠（証跡）への参照を `PlanningJson.monitoringEvidenceLinks[]` として安全に永続化できるようにします。

---

## 🔒 最重要ガードレール (北極星)
1. **職員操作による引用のみ。自動確定・自動保存の絶対禁止**
   - 職員が画面上で明示的に「引用」ボタンをクリックし、さらに支援計画シートフォーム全体の「保存」ボタンをクリックして初めてデータベースへ保存（Save）される仕様とする。自動での即時保存は絶対に行わない。
2. **「評価欄へ引用」ボタンはフォーム state のみ更新する**
   - ボタン操作時のアクションは、React-Hook-Form（または使用中の状態管理）の `form state` のみを更新し、API 通信等の副作用は一切起こさない。
3. **既存テキストは上書きせず「追記（アペンド）」を基本とする**
   - 職員が既に入力しているテキストを不意に破壊消去することを防ぐため、既存テキストの末尾に仕切り線を挟んで追記する方式を基本とする。
4. **SharePoint 物理列追加の完全禁止**
   - SharePoint の物理的な列追加や、provision 定義等の変更は一切行わない。
   - 証跡（リンク）の永続化は、既存のテキスト型 JSON カラムである `PlanningJson` 内のプロパティ `monitoringEvidenceLinks` にシリアライズして保持することで実現する。
5. **DailyActivityRecords（日次支援）との完全な統合・同期排除**
   - DailyActivityRecords への同期・参照・統合処理は一切行わない。
6. **L1個別支援計画への直接反映禁止**
   - 変更は L2支援計画シート §9 の評価欄およびその `PlanningJson` 内の属性にのみ閉じる。L1個別支援計画のデータに対して勝手に直接書き込まない。
7. **保存は既存の支援計画シート保存フローに乗せる**
   - 送信データは、既存の `SupportPlanningSheet` 更新エンドポイント・保存処理の流れをそのまま流用し、新規の保存 API やエンドポイントの追加は行わない。

---

## 📋 証跡リンク (`monitoringEvidenceLinks`) のメタデータ定義
`evidenceLink` には最低限以下を保持する構造とします。

| プロパティ名 | 型 | 説明 |
| :--- | :--- | :--- |
| `source` | `literal('dedicated-abc')` | 出処となるソースの種別 (固定値) |
| `sourceList` | `literal('AbcBehaviorRecords')` | ソースが格納されている SharePoint リスト名 (固定値) |
| `recordIds` | `string[]` | 引用対象となったすべての `AbcBehaviorRecord` の論理IDの配列 |
| `period` | `{ from: string; to: string }` | ドラフト生成対象とした ABC 記録の期間（ISO `YYYY-MM-DD`） |
| `generatedAt` | `string` | ドラフトを生成・引用した瞬間のタイムスタンプ（ISO 8601 形式） |
| `citedFields` | `('evaluationMethod' \| 'improvementResult' \| 'nextSupport')[]` | 引用先のフィールド（複数選択・一括反映可能） |

---

## 🛠️ 詳細実装ステップ

### ステップ1: ドメインスキーマの拡張と型定義
**ファイル**: [`src/domain/isp/schema/ispPlanningSheetSchema.ts`](file:///Users/yasutakesougo/audit-management-system-mvp/src/domain/isp/schema/ispPlanningSheetSchema.ts)

1. **証跡リンク Zod スキーマの追加**
   ```typescript
   export const monitoringEvidenceLinkSchema = z.object({
     source: z.literal('dedicated-abc'),
     sourceList: z.literal('AbcBehaviorRecords'),
     recordIds: z.array(z.string()),
     period: z.object({
       from: z.string(),
       to: z.string(),
     }),
     generatedAt: z.string(),
     citedFields: z.array(z.enum(['evaluationMethod', 'improvementResult', 'nextSupport'])),
   });

   export type MonitoringEvidenceLink = z.infer<typeof monitoringEvidenceLinkSchema>;
   ```

2. **プランニング設計セクション (`planningDesignSchema`) の拡張**
   - `planningDesignSchema` の Zod オブジェクト属性に `monitoringEvidenceLinks` を追加。
   - 既存データにプロパティが存在しない場合（後方互換性）のために、必ず `.default([])` を指定する。
   ```typescript
   export const planningDesignSchema = z.object({
     // ... 既存の属性 ...
     evaluationIndicator: z.string().default(''),
     evaluationPeriod: z.string().default(''),
     evaluationMethod: z.string().default(''),
     improvementResult: z.string().default(''),
     nextSupport: z.string().default(''),
     
     // ★ 新規追加 (PR3)
     monitoringEvidenceLinks: z.array(monitoringEvidenceLinkSchema).default([]),
   }).default({
     // ... 既存のデフォルト ...
     evaluationIndicator: '',
     evaluationPeriod: '',
     evaluationMethod: '',
     improvementResult: '',
     nextSupport: '',
     
     // ★ 新規追加 (PR3)
     monitoringEvidenceLinks: [],
   });
   ```

3. **フォーム型スキーマ (`planningSheetFormSchema`) の拡張**
   - 画面での更新フォーム状態管理に備え、`planningSheetFormSchema` にも `monitoringEvidenceLinks` を追加。
   ```typescript
   export const planningSheetFormSchema = z.object({
     // ... 既存の属性 ...
     evaluationIndicator: z.string().optional(),
     evaluationPeriod: z.string().optional(),
     evaluationMethod: z.string().optional(),
     improvementResult: z.string().optional(),
     nextSupport: z.string().optional(),
     
     // ★ 新規追加 (PR3)
     monitoringEvidenceLinks: z.array(monitoringEvidenceLinkSchema).default([]),
   });
   ```

---

### ステップ2: インフラマッパーの更新
**ファイル**: [`src/data/isp/mapper.ts`](file:///Users/yasutakesougo/audit-management-system-mvp/src/data/isp/mapper.ts)

1. **`EMPTY_PLANNING` オブジェクトの拡張**
   ```typescript
   const EMPTY_PLANNING = {
     // ... 既存の属性 ...
     evaluationIndicator: '', evaluationPeriod: '', evaluationMethod: '',
     improvementResult: '', nextSupport: '',
     monitoringEvidenceLinks: [], // ★ 新規追加
   };
   ```

2. **`mapPlanningSheetRowToDomain` でのパース**
   - `planning` に `monitoringEvidenceLinks` が含まれ、ドメインモデルに安全にマッピングされることを確認。Zod 側のデフォルト定義により既存データは空配列 `[]` として安全にパースされます。

3. **`mapPlanningSheetCreateInputToPayload` および `mapPlanningSheetUpdateInputToPayload` の書き込みマッピング**
   - 作成/更新時に、入力値の `monitoringEvidenceLinks` が `PlanningJson` 内に正しく含められるようにマッパーを安全に更新します。
   ```typescript
   // CreatePayload 側
   PlanningJson: JSON.stringify({
     ...EMPTY_PLANNING,
     ...(input.planning || {}),
     evaluationIndicator: input.evaluationIndicator ?? input.planning?.evaluationIndicator ?? '',
     evaluationPeriod: input.evaluationPeriod ?? input.planning?.evaluationPeriod ?? '',
     evaluationMethod: input.evaluationMethod ?? input.planning?.evaluationMethod ?? '',
     improvementResult: input.improvementResult ?? input.planning?.improvementResult ?? '',
     nextSupport: input.nextSupport ?? input.planning?.nextSupport ?? '',
     
     // ★ 新規追加 (PR3)
     monitoringEvidenceLinks: input.monitoringEvidenceLinks ?? input.planning?.monitoringEvidenceLinks ?? [],
   }),
   ```
   ```typescript
   // UpdatePayload 側
   if (input.planning !== undefined) {
     payload.PlanningJson = JSON.stringify({
       ...EMPTY_PLANNING,
       ...input.planning,
     });
   } else if (
     // ... 既存の判定 ...
     input.monitoringEvidenceLinks !== undefined // ★ 判定追加
   ) {
     payload.PlanningJson = JSON.stringify({
       ...EMPTY_PLANNING,
       evaluationIndicator: input.evaluationIndicator ?? '',
       evaluationPeriod: input.evaluationPeriod ?? '',
       evaluationMethod: input.evaluationMethod ?? '',
       improvementResult: input.improvementResult ?? '',
       nextSupport: input.nextSupport ?? '',
       
       // ★ 新規追加 (PR3)
       monitoringEvidenceLinks: input.monitoringEvidenceLinks ?? [],
     });
   }
   ```

---

### ステップ3: 引用・アペンド操作の UI 連携
**ファイル**: [`src/features/planning-sheet/components/new-form/FormSections.tsx`](file:///Users/yasutakesougo/audit-management-system-mvp/src/features/planning-sheet/components/new-form/FormSections.tsx) もしくは [`AbcEvidenceListPanel.tsx`](file:///Users/yasutakesougo/audit-management-system-mvp/src/features/monitoring/components/AbcEvidenceListPanel.tsx)

1. **二重引用の防止仕様（重複排除方針）**
   - 同じ `recordIds`（または同一期間の ABC 記録）がすでに `form.monitoringEvidenceLinks` 内に引用登録されている場合、引用ボタンを無効化（Disabled）し、「すでにこの記録は引用済みです」と視覚的に明示します。
   - すでに他の Dedicated ABC 証跡が登録されている状態で別の期間のものを「追加で引用」する場合は、以前の `monitoringEvidenceLinks` 配列に対して連結し、重複のないようにマージします。

2. **追記/上書きの確認ダイアログまたはアペンド方針**
   - 引用ボタンを押した際、テキストエリアに直接書き込む前に「既存の文章の末尾に追記しますか？それともドラフト文で上書きしますか？」のダイアログ（確認ポップアップ）を表示するか、もしくは安全性のために「追記（アペンド）」に固定し、既存テキストの末尾にアペンドします。
   - 追記時のテキストフォーマット例：
     ```typescript
     const appendText = (current: string, suggestion: string, title: string): string => {
       if (!suggestion) return current;
       if (!current) return suggestion;
       return `${current}\n\n--- 【${title}】 ---\n${suggestion}`;
     };
     ```

3. **引用アクションのハンドラー処理**
   ```typescript
   const handleCiteAbcEvidence = () => {
     if (!abcEvidenceRecords || abcEvidenceRecords.length === 0) return;

     // 1. ドラフト文を PR2 の関数を用いて生成
     const draft = buildAbcEvidenceEvaluationDraft({
       records: abcEvidenceRecords,
       appliedFrom: appliedFrom ?? null,
       monitoringCycleDays: monitoringCycleDays ?? 90,
     });

     // 2. テキストアペンドの実行
     updateField('evaluationMethod', appendText(form.evaluationMethod, draft.evaluationMethod, 'ABC記録に基づく評価方法ドラフト'));
     updateField('improvementResult', appendText(form.improvementResult, draft.improvementResult, 'ABC記録に基づく改善実績ドラフト'));
     updateField('nextSupport', appendText(form.nextSupport, draft.nextSupport, 'ABC記録に基づく今後の支援ドラフト'));

     // 3. 証跡リンク (monitoringEvidenceLinks) のマージ・重複排除
     const recordIds = abcEvidenceRecords.map(r => r.id);
     const periodFrom = abcEvidencePeriod?.from || appliedFrom || '';
     const periodTo = abcEvidencePeriod?.to || '';

     const newLink: MonitoringEvidenceLink = {
       source: 'dedicated-abc',
       sourceList: 'AbcBehaviorRecords',
       recordIds,
       period: { from: periodFrom, to: periodTo },
       generatedAt: new Date().toISOString(),
       citedFields: ['evaluationMethod', 'improvementResult', 'nextSupport'],
     };

     // 既存の証跡配列から、同一 recordIds を持つものを除外した上でマージ
     const currentLinks = form.monitoringEvidenceLinks || [];
     const isDuplicate = currentLinks.some(link => 
       link.source === 'dedicated-abc' && 
       JSON.stringify(link.recordIds.sort()) === JSON.stringify(recordIds.sort())
     );

     if (!isDuplicate) {
       updateField('monitoringEvidenceLinks', [...currentLinks, newLink]);
     }
   };
   ```

4. **UI 上での引用済み証跡の表示**
   - §9 画面の下部に、現在引用されている Dedicated ABC の証跡を、バッジや `Chip` 等で美しくレンダリングします。
   - 職員が「引用を解除」できるように、各 Chip に削除ボタン（Delete）を配置し、クリック時に `monitoringEvidenceLinks` 配列から該当するオブジェクトを除外する機能も合わせて提供します（ただし、書き込まれたテキスト自体は職員の手でエディタ上から消去してもらう方針とします）。

---

### ステップ4: 単体テストおよび統合テストの追加

1. **スキーマバリデーションのテスト追加**
   - [`src/domain/isp/__tests__/schema.spec.ts`](file:///Users/yasutakesougo/audit-management-system-mvp/src/domain/isp/__tests__/schema.spec.ts)
   - `monitoringEvidenceLinks` が正常に Zod 構造を通過すること、空の PlanningJson で安全にフォールバックされることをテスト。

2. **マッパーテストの追加・更新**
   - [`src/data/isp/__tests__/mapper.spec.ts`](file:///Users/yasutakesougo/audit-management-system-mvp/src/data/isp/__tests__/mapper.spec.ts)
   - 双方向マッピングに `monitoringEvidenceLinks` がシリアライズされて安全に保持されることをアサート。

3. **UI 操作テストの追加**
   - [`src/features/planning-sheet/components/__tests__/FormSections.spec.tsx`](file:///Users/yasutakesougo/audit-management-system-mvp/src/features/planning-sheet/components/__tests__/FormSections.spec.tsx)
   - 引用ボタンをクリックした際に、フォーム状態が正しく更新され、二重引用のガードレールが動作することをテスト。

---

### 🚫 禁止事項
- **自動確定・自動永続化の禁止**
  - ボタンを押した段階で、SharePointへの書き込みAPI（PATCH/POST）を直接叩かないこと。
- **物理カラム追加の禁止**
  - SharePoint API 定義や `spListRegistry` に新規列を追加しないこと。

---

### ✅ 最終完了条件
- [ ] `tsc --noEmit` が完全にエラーゼロで合格すること。
- [ ] `npm run lint` が警告ゼロで合格すること。
- [ ] 新規追加した全てのテスト（マッパー、スキーマ、UI）を含む `vitest run` が全件グリーンに合格すること。
- [ ] コミットメッセージ: `feat(planning-sheet): cite ABC evidence draft into evaluation fields`
