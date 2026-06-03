# ADR-023: Kiosk procedure record offline sync policy

## Status
Proposed

## Context
- **Current kiosk behavior**:
  SharePoint に直接アクセスできない場合、または SharePoint の読み込みに失敗した場合、誤ったデータ上書きを防ぐため、保存（実施・取消など）をブロックしている（ADR-022 の状態ガード）。
- **Why offline write is tempting**:
  現場では Wi-Fi が不安定な環境（浴室や送迎中など）でキオスク端末が使われることがあり、通信が切れるたびに保存をブロックすると現場業務が停滞するため、ローカルに一時保存して後で自動的に同期させたいという強い現場要求がある。
- **Why immediate implementation is risky**:
  状態遷移や同期ルールを事前に厳密に定義せずに実装すると、ネットワーク復帰時の二重登録、他の端末からの変更との競合（後勝ちによる古いデータでの上書きなど）、現場職員が「保存された」と思い込んだデータが実は同期失敗したまま失われるといった重大な障害リスクがある。

## Decision
- **Current phase keeps offline write disabled**:
  本フェーズではオフライン書き込みモード（offline write）は無効のままとする。
- **SharePoint read failure continues to block destructive or ambiguous writes**:
  SharePoint への接続が確認できない、あるいはデータの読み込みに失敗した場合は、曖昧または破壊的な書き込みによるデータの破損や不整合を防ぐため、引き続き実施・取消の保存操作をフロントエンドでガード（ブロック）する。
- **Offline write may be introduced only after state model / conflict rules / admin visibility are implemented**:
  将来的にオフライン書き込みを有効化する場合は、本ADRで定義する「状態モデル」「重複・競合防止ルール」「管理者側の未同期データの視認性およびリカバリ機能」のすべてが実装された後とする。

## State model
同期ステータスモデルとして、`offlineStatus` に以下の状態を定義する：
- `onlineConfirmed`: SharePoint への書き込みが成功し、正本として永続化が確認された状態。
- `localPending`: オフライン中に端末ローカル（Zustand または LocalStorage/IndexedDB）に一時保存され、SharePoint への同期がまだ完了していない状態。
- `syncFailed`: ネットワーク復帰時などに自動/手動での同期（SharePointへの登録）を試みたが、APIエラーやタイムアウト等で失敗した状態。
- `conflict`: 同一対象データが SharePoint 上で既に他の端末から変更されていた等の競合が発生し、同期が中断された状態。
- `discarded`: 同期失敗したデータまたは競合データを、管理者またはユーザーが意図的に破棄・キャンセルした状態。

## Idempotency and duplicate prevention
二重保存や不整合を完全に防止するため、以下の属性を組み合わせた「重複防止用ユニークキー（Idempotency Key）」を定義し、ローカルキューおよび SharePoint 側で同一レコードの多重登録を防ぐ。
- `userId` (利用者ID)
- `recordDate` (記録対象日: YYYY-MM-DD)
- `scheduleItemId` (スケジュール項目ID)
- `rowNo` / `slotKey` (手順の行番号・スロット識別子)

重複防止キーの構成案: `[recordDate]::[userId]::[scheduleItemId]::[rowNo]`

その他、同期時に使用するメタデータ：
- `sourceDeviceId` (端末固有ID。どの端末から作成された記録かを特定し、端末間競合の解決に使用)
- `localDraftId` (ローカル生成のUUID。未同期キューの特定キー)
- `updatedAt` (最終更新日時。競合時の LWW (Last-Write-Wins) の判定基準として利用可能にする)

## Sync policy
- **When to sync**:
  - ネットワークのオンライン復帰を検知したとき（`navigator.onLine` イベンドなど）。
  - アプリケーションが起動されたとき、またはキオスクの利用者選択画面に戻ったとき。
  - ユーザーが明示的に「未同期データを同期する」ボタンを押したとき。
- **Retry rules**:
  - 一時的な通信エラー（503やタイムアウト）の場合は、指数バックオフを伴う自動再試行（最大3回）を行う。
  - スロットル制限（SharePoint 429 エラー）を検知した場合は、自動再試行を一時停止し、待機時間を置いてから再試行するか、手動での再試行を促す。
  - 再試行上限を超えた場合は、状態を `syncFailed` に変更する。
- **Conflict detection**:
  - 同期実行前に、重複防止キーを用いて SharePoint 側に既に該当日のレコードがあるかチェックする。
  - レコードが存在し、かつ登録されたデータ（実施状態やメモなど）に差異がある場合、競合（`conflict`）と判定する。
- **Merge / no-merge policy**:
  - 自動マージは行わない。値が異なる場合は安全のため `conflict` 状態とし、管理者による手動判断（ローカル側の値で上書きするか、SharePoint側の値を優先してローカルを破棄するか）を求める。

## Delete / cancel policy
- **Local pending deletion**:
  - `localPending` (未同期) 状態のレコードに対する「取消」または「削除」が行われた場合、SharePoint に通信する必要はないため、単にローカルのキューから該当レコードを消去する。
- **Remote confirmed deletion**:
  - `onlineConfirmed` (同期済み) のレコードをオフライン状態で「取消」する場合、SharePoint 側のデータを物理削除または論理削除（ソフトデリート）する必要がある。
  - オフライン中は、削除用のアクション（キュー）に `deletePending` 状態として登録し、オンライン復帰時に SharePoint 側でソフトデリート API を実行する。
- **Conflict on delete**:
  - 削除処理の同期時に、すでに SharePoint 側のレコードが更新されていたり、別の削除が行われていた場合は、競合状態として管理者に通知し、自動的な上書き削除を回避する。

## UI policy
- **Staff-facing labels**:
  - 現場職員用の画面では、「同期中」「ローカル保存済み（未同期）」「通信エラーによる一時保存」を明示する。
  - 同期未完了のデータには、チェックマークや色付きバナーを用いて「未同期」マークを明示する。
- **Admin-facing labels**:
  - 管理者用画面では、端末内に滞留している未同期件数や、同期失敗件数を数値で表示する。
- **Warning banners**:
  - 「未同期のデータが○件あります。通信環境の良い場所でアプリを開き直してください」などのバナー表示。
- **What must never be shown as confirmed**:
  - `localPending` や `syncFailed` 状態のデータを、SharePoint への保存が完了したかのような「保存完了」「同期完了」として表示してはならない。必ず「一時保存中」などの表現に留める。

## Admin review
- **Where unresolved sync failures are visible**:
  - キオスクの設定画面、または管理モードに「未同期・同期エラーデータ一覧」画面を新設する。
- **How to retry / discard / resolve**:
  - 管理画面から、対象データを個別に選択して「再同期を試みる」「ローカルデータを破棄する」「CSVとしてエクスポートする（退避措置）」などの操作を実行可能にする。
  - 端末紛失や故障時、ローカルデータの抽出が必要な場合に備えて、Zustand/LocalStorage の未同期データをプレーンテキストや JSON 形式で画面に書き出せるエスケープハッチを用意する。

## Consequences
### Positive
- Wi-Fi 瞬断時でも現場業務の入力が遮断されず、操作性が向上する。
- 事前のデータ競合・二重保存の防止設計により、データの整合性が強固に保たれる。
- 万が一の同期失敗時にも、データが闇に葬られることなく管理者がリカバリできる。

### Trade-offs / Risks
- ローカルストレージはブラウザ/端末ごとに独立しているため、A端末の未同期データをB端末から確認・同期することはできない。
- ブラウザのキャッシュクリア（Cookie/Storageクリア）により、未同期データが消失するリスクがある。
- 同期タイミングの遅延により、管理画面側で一時的に古いデータ（実施実績）が表示されるタイムラグが発生する。

### Future implementation phases
- **Phase 1**: 状態モデルの定義および ADR の合意（本PR）
- **Phase 2**: Zustand / localStorage に未同期キュー（`localPending`）と警告 UI の実装
- **Phase 3**: オンライン復帰時の自動同期および管理者向けエラー確認・リカバリ UI の実装

## Non-goals
- 本PRはADR文書の作成のみをスコープとし、プログラムコードの変更は一切行わない。
- SharePoint リストのスキーマ変更は行わない。
- 既存のデータリポジトリ（SharePoint 接続層）への変更は行わない。
- 既存の `/billing` 機能や月次集計ロジックへの影響・変更は行わない。
