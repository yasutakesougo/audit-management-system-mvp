# Users_Master 分割設計書 (v1.0)

## 1. 背景・目的
`Users_Master` リストの列数が SharePoint の制限に近づいており、起動時の自己修復（列追加）が失敗してシステム全体が停止するリスク（止血が必要な状態）になっています。
本設計では、データを「Core」「Transport」「Benefit」の3つのリストに分離し、責務を分散することで、各リストの列数に余裕を持たせ、システムの安定性を向上させます。

## 2. 止血方針
1.  **自動列追加の停止**: `Users_Master` への起動時 `createfieldasxml` の自動実行を停止します。
2.  **ライフサイクルの変更**: `Users_Master` を `required` から `optional` に変更し、不在時でもブートを継続できるようにします。
3.  **エラーハンドリング**: 列サイズ超過（500 error）を `schema_limit_exceeded` としてテレメトリに記録し、致命的エラーとして扱いません。

## 3. データ棚卸しと分離先

### A. Users_Master (Core)
利用者識別と基本属性に限定します。

| 内部名 | 論理名 | 区分 |
| :--- | :--- | :--- |
| UserID | 利用者ID | Core (PK) |
| FullName | 氏名 | Core |
| Furigana | フリガナ | Core |
| IsActive | 有効フラグ | Core |
| UsageStatus | 利用ステータス | Core |
| ContractDate | 契約日 | Core |
| ServiceStartDate | サービス開始日 | Core |
| ServiceEndDate | サービス終了日 | Core |

### B. UserTransport_Settings (Transport)
送迎に関連する設定を分離します。

| 内部名 | 論理名 | 区分 |
| :--- | :--- | :--- |
| UserID | 利用者ID | PK (Core.UserID と紐付け) |
| TransportToDays | 送迎(往) | Operational |
| TransportFromDays | 送迎(復) | Operational |
| TransportCourse | 送迎コース | Operational |
| TransportSchedule | 送迎詳細設定 (JSON) | Operational |
| TransportAdditionType | 送迎加算区分 | Operational |

### C. UserBenefit_Profile (Benefit)
受給者証および支給決定情報を分離します。

| 内部名 | 論理名 | 区分 |
| :--- | :--- | :--- |
| UserID | 利用者ID | PK (Core.UserID と紐付け) |
| RecipientCertNumber | 受給者証番号 | Operational |
| RecipientCertExpiry | 受給者証有効期限 | Operational |
| GrantMunicipality | 支給決定自治体 | Operational |
| GrantPeriodStart | 支給期間開始 | Operational |
| GrantPeriodEnd | 支給期間終了 | Operational |
| DisabilitySupportLevel | 障害支援区分 | Operational |
| GrantedDaysPerMonth | 支給日数/月 | Operational |
| UserCopayLimit | 利用者負担上限額 | Operational |

## 4. 実装フェーズ

### フェーズ 1: 自動列追加停止 (完了)
*   `SP_LIST_REGISTRY` の `Users_Master` を `optional` 化
*   `SharePointDataProvider` の強制自己修復対象から除外
*   500エラーの分類見直し

### フェーズ 2: 起動継続化 (完了)
*   `DataProviderUserRepository` の既存 fallback ロジック（Core/Minimal）による読み取り継続の保証

### フェーズ 3: 分離先リストのプロビジョニング (進行中)
*   `UserTransport_Settings` および `UserBenefit_Profile` を `SP_LIST_REGISTRY` に登録
*   起動時にこれらの新設リストが作成されることを確認

### フェーズ 4: Repository (Join) 実装 (次ステップ)
*   `DataProviderUserRepository` を改修し、Core 取得後に Transport/Benefit を必要に応じて取得・マージする。
*   データ移行スクリプト（Users_Master から新リストへのコピー）の準備

## 5. 期待される効果
*   `Users_Master` の不備でシステム全体が起動不可になる事態の解消
*   将来的な制度改正による列追加への耐性強化
*   データ取得の最適化（一覧では Core のみ、詳細画面で全部、など）
