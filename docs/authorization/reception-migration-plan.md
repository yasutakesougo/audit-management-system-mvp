# Reception ロール導入設計 v1

## 1. 目的

requiredRole 一本化後の認可体系を前提に、以下の 3 階層モデルを正式導入する。

- viewer
- reception
- admin

目的:

- viewer と admin の中間権限を定義する
- 管理 UI と現場 UI を分離する
- 将来の supervisor 拡張を見据えて階層を安定化する

## 2. ロール階層定義

- viewer = 1
- reception = 2
- admin = 3

アクセス判定は canAccess(userRole, requiredRole) のみを使用する。

## 3. reception 対象ルート棚卸し

現状 requiredRole="viewer" のルートを以下の 3 分類に分ける。

### A. viewer 維持（誰でも可）

- ダッシュボード閲覧
- 日次記録入力
- スケジュール閲覧
- 通所管理（閲覧のみ）

### B. reception に引き上げ候補

- 月次集計画面
- 精算処理
- スタッフ勤怠修正
- PDF 再生成
- 通所データ修正

### C. admin のみ維持

- 支援テンプレート管理
- 監査ログ
- 自己点検
- システム設定
- ユーザー管理

## 4. ロール付与ルール（初期案）

### admin

- AAD グループ: VITE_AAD_ADMIN_GROUP_ID
- システム管理者
- 監査責任者

### reception

案 1（推奨）:

- AAD グループ: VITE_AAD_RECEPTION_GROUP_ID
- 受付・事務担当
- 月次・精算操作担当

案 2（暫定）:

- admin 以外の職員のうち一部手動付与

方針: reception は必ず AAD グループで管理する。

## 5. 移行ポリシー

### フェーズ 1（安全）

- requiredRole="viewer" のまま運用する
- reception ロールのみ先行導入する
- reception は viewer と同じ挙動にする

### フェーズ 2（段階引き上げ）

- B 分類ルートを requiredRole="reception" に変更する
- E2E を追加する
- 本番確認を行う

### フェーズ 3（固定）

- viewer から B 分類操作を除外する
- reception を正式業務ロールとして固定する

## 6. E2E 追加仕様（期待マトリクス）

| ルート | viewer | reception | admin |
| --- | --- | --- | --- |
| ダッシュボード | ✅ | ✅ | ✅ |
| 月次集計 | ❌ | ✅ | ✅ |
| 精算処理 | ❌ | ✅ | ✅ |
| テンプレ管理 | ❌ | ❌ | ✅ |
| 監査ログ | ❌ | ❌ | ✅ |

## 7. フォールバック挙動

- role 未解決: viewer
- requiredRole 不一致: アクセス拒否画面
- reception 未設定: 全員 viewer 扱い

## 8. 安全原則

1. ロール未解決は常に最弱（viewer）
2. 直接比較を禁止し、必ず canAccess 経由で判定する
3. ルートと UI の両方で保護する
4. E2E で境界を固定する

## 9. 実装前チェックリスト

- reception 用 AAD グループ作成
- VITE_AAD_RECEPTION_GROUP_ID 追加
- useUserAuthz に reception 判定追加
- smoke E2E に reception ケース追加
- 影響ルートの requiredRole 変更

## 結論

現在のアーキテクチャは reception 導入に対応可能であり、段階導入で低リスク移行が可能。

## 10. フェーズ2 初回引き上げ対象（具体）

### 目的

reception 導入の最小実装として、業務リスクが低く、権限分離の効果が明確なルートから引き上げる。

### 対象ルート（第1段階）

| ルート | 理由 | 影響 |
| --- | --- | --- |
| /monthly-summary | 月次締め業務 | viewer から分離 |
| /billing | 精算操作 | 誤操作リスク低減 |
| /attendance/edit | 勤怠修正 | 現場修正制限 |
| /pdf/regenerate | 再出力 | 業務責任区分明確化 |

### 変更内容

```tsx
<RequireAudience requiredRole="viewer">
```

↓

```tsx
<RequireAudience requiredRole="reception">
```

### 追加 E2E

- viewer: 上記ルートはアクセス不可
- reception: 上記ルートはアクセス可
- admin: 上記ルートはアクセス可

### この順で始める理由

- 管理系（admin-only）より業務影響が限定的
- admin-only にするほどではない運用タスクを切り出せる
- reception ロールの存在意義を最短で実証できる

### 実装時注記

- 上記 4 ルートは現時点では設計上の仮称。
- 実装着手時に `src/app/router.tsx` の実パスへマッピングして適用する。

## 11. 仮称ルート → 実装ルート対応表（router 基準）

実装時は `src/app/router.tsx` の `path` 定義を基準に最終確認する。

| 仮称 | 実装ルート（現状） | 対象ファイル | requiredRole（現状→目標） | 備考 |
| --- | --- | --- | --- | --- |
| /monthly-summary | /records/monthly | src/pages/MonthlyRecordPage.tsx | viewer → reception | 既存ルートあり |
| /billing | /billing | src/pages/BillingPage.tsx | reception（実装済み） | プレースホルダ画面で新設済み |
| /attendance/edit | /staff/attendance | src/pages/StaffAttendanceInputPage.tsx | viewer → reception | 編集操作に相当 |
| /pdf/regenerate | /records/monthly?tab=pdf | src/pages/MonthlyRecordPage.tsx | reception（action guard実装済み） | 専用ルートではなく PDF タブ操作 |

補足:

- `/pdf/regenerate` は専用画面ではなく `MonthlyRecordPage` の `pdf` タブ（`tab=pdf`）で提供されるため、`handleGenerateMonthlyPdf` と生成ボタンの action guard で制御する。

## 12. フェーズ2-1 実装対象（router 変更箇所）

対象ファイル: `src/app/router.tsx`

### 変更イメージ（1）月次レコード

```tsx
// 現状
<RequireAudience requiredRole="viewer">
  <SuspendedMonthlyRecordPage />
</RequireAudience>
```

↓

```tsx
// 変更後
<RequireAudience requiredRole="reception">
  <SuspendedMonthlyRecordPage />
</RequireAudience>
```

### 変更イメージ（2）スタッフ勤怠入力

```tsx
// 現状
<RequireAudience requiredRole="viewer">
  <SuspendedStaffAttendanceInput />
</RequireAudience>
```

↓

```tsx
// 変更後
<RequireAudience requiredRole="reception">
  <SuspendedStaffAttendanceInput />
</RequireAudience>
```

### 変更対象パス一覧（フェーズ2-1）

| path | コンポーネント | 現状 | 変更後 |
| --- | --- | --- | --- |
| /records/monthly | SuspendedMonthlyRecordPage | viewer | reception |
| /staff/attendance | SuspendedStaffAttendanceInput | viewer | reception |

注記:

- `/attendance/input` は現行 `router.tsx` には存在しないため、フェーズ2-1 の実変更対象は `/staff/attendance` とする。
- `/billing` はルート新設時点で `requiredRole="reception"` を初期値として実装する。

## 13. reception グループID設計（ENV / 判定仕様）

### 13.1 受け付ける環境変数

- `VITE_AAD_ADMIN_GROUP_ID`
- `VITE_AAD_RECEPTION_GROUP_ID`

後方互換キー:

- `VITE_ADMIN_GROUP_ID`
- `VITE_SCHEDULE_ADMINS_GROUP_ID`
- `VITE_RECEPTION_GROUP_ID`

優先順位（高 → 低）:

- admin: `VITE_AAD_ADMIN_GROUP_ID` → `VITE_ADMIN_GROUP_ID` → `VITE_SCHEDULE_ADMINS_GROUP_ID`
- reception: `VITE_AAD_RECEPTION_GROUP_ID` → `VITE_RECEPTION_GROUP_ID`

### 13.2 reception 判定ロジック

```ts
if (memberOf.includes(ADMIN_GROUP)) role = 'admin';
else if (memberOf.includes(RECEPTION_GROUP)) role = 'reception';
else role = 'viewer';
```

重要: 判定順は必ず `admin` 優先。

### 13.3 フォールバック挙動（最弱原則）

- group 未解決: `viewer`
- Graph 取得失敗: `viewer`
- ENV 未設定（production）: `viewer`

### 13.4 実装済み反映ポイント

- `src/auth/useUserAuthz.ts`
  - `VITE_AAD_RECEPTION_GROUP_ID` 読み取り対応
  - admin 優先のロール解決順を明示
- `.env.example`
  - `VITE_AAD_RECEPTION_GROUP_ID` を追加
- `src/worker.ts`
  - runtime env allowlist に reception グループIDを追加

### 13.5 E2E 実装済みケース（抜粋）

| ケース | 期待 |
| --- | --- |
| viewer → /records/monthly | ❌ |
| reception → /records/monthly | ✅ |
| admin → /records/monthly | ✅ |
| viewer → /records/monthly?tab=pdf（生成操作） | ❌ |
| reception → /records/monthly?tab=pdf（生成操作） | ✅ |
| admin → /records/monthly?tab=pdf（生成操作） | ✅ |
