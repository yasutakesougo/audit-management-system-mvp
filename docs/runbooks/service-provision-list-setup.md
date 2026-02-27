# SharePoint リスト作成 Runbook: ServiceProvisionRecords

## 1. リスト作成

1. SharePoint サイト → **サイト コンテンツ** → **新規** → **リスト** → **空白のリスト**
2. リスト名: `ServiceProvisionRecords`（半角、綴り完全一致）
3. 作成後、**設定** → **リストの設定** を開く

## 2. 列追加（順番通り）

| # | 内部名 | 表示名 | 型 | 必須 | 備考 |
|---|---|---|---|---|---|
| 1 | `EntryKey` | EntryKey | 単一行テキスト | ✅ | **一意（重複不可）推奨** |
| 2 | `UserCode` | 利用者コード | 単一行テキスト | ✅ | 例: `I022` |
| 3 | `RecordDate` | 記録日 | **日付のみ** | ✅ | DateTime ではなく Date only |
| 4 | `Status` | 提供状況 | 選択肢 | ✅ | `提供`, `欠席`, `その他` **（完全一致必須）** |
| 5 | `StartHHMM` | 開始HHMM | 数値 | - | 930, 1530 等（4桁運用）**小数なし** |
| 6 | `EndHHMM` | 終了HHMM | 数値 | - | 同上 **小数なし** |
| 7 | `HasTransport` | 送迎 | Yes/No | - | |
| 8 | `HasMeal` | 食事 | Yes/No | - | |
| 9 | `HasBath` | 入浴 | Yes/No | - | |
| 10 | `HasExtended` | 延長 | Yes/No | - | |
| 11 | `HasAbsentSupport` | 欠席時対応 | Yes/No | - | |
| 12 | `Note` | メモ | 複数行テキスト | - | プレーンテキスト |
| 13 | `Source` | 入力元 | 選択肢 | - | `Unified`, `Daily`, `Attendance`, `Import` **（完全一致必須）** |
| 14 | `UpdatedByUPN` | 更新者UPN | 単一行テキスト | - | 自動記録用 |

> [!IMPORTANT]
> **RecordDate** は必ず「日付のみ」を選択。DateTime にするとタイムゾーンで別日扱いになり upsert が壊れます。

> [!TIP]
> **EntryKey の一意制約**: リストの設定 → EntryKey 列 → 「この列への入力に一意の値を設定する」を **はい** に。
> 設定できない場合でもアプリ側 upsert で成立しますが、二重登録の最後の砦になります。

## 3. ビュー作成（推奨）

| ビュー名 | フィルタ条件 | 表示列 |
|---|---|---|
| Today | `RecordDate` = `[今日]` | EntryKey, UserCode, Status, StartHHMM, EndHHMM |
| ByUser | `UserCode` でグループ化 | 全列 |

## 4. 動作確認

リスト作成後、アプリ側から以下を実行:

1. **保存テスト**: 利用者 `I022` + 今日 + `提供` → 保存 → リストに 1件
2. **更新テスト**: 同条件で `欠席` に変更 → 保存 → 件数増えず EntryKey 同一行が更新
3. **別ユーザー**: `I023` で保存 → 2件になる
4. **別日付**: 昨日の日付で保存 → 日付別で別件になる

> [!CAUTION]
> Title 列は SharePoint 標準で必ず存在しますが、本機能では使用しません。必須解除しておくと POST 時のエラーを防げます。
> **リストの設定** → **Title** 列 → **必須** を「いいえ」に変更。
> 未対応だと POST 時に `400 Bad Request`（Title is required）になります。

> [!WARNING]
> **選択肢列（Status / Source）の値は TypeScript enum と完全一致が必須です。**
> 1文字でも違うと保存時に 400 エラーになります。全角/半角・スペースに注意。
