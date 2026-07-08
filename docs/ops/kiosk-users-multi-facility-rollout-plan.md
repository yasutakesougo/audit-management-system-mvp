# `/kiosk/users` 支援手順記録 別事業所展開方針

## 1. 結論

現状のまま `/kiosk/users` 支援手順記録を別事業所へ展開しない。

この機能は、現場端末で利用者を選び、支援手順を確認し、当日の実施記録を残す導線として有用である。一方で、現状は事業所境界が repository / 型 / URL / テストに入っていないため、別事業所の実運用前に境界設計を追加する。

特に次の状態が解消されるまでは、別事業所への試行開始も保留する。

- 実施記録の主キーが `date / userId / scheduleItemId` 軸であり、事業所境界を含まない。
- `ExecutionRecord` に `facilityId` 相当の必須値がない。
- 利用者一覧、支援手順取得、記録取得、履歴取得に事業所 filter がない。
- URL 直打ち時に、別事業所利用者へのアクセスを防ぐ許可確認がない。
- kiosk route に audience / role 境界が接続されていない。
- memory provider と SharePoint provider の両方で、同じ事業所境界を保証するテストがない。

## 2. 現在の機能範囲

現在の `/kiosk/users` 系導線は、次の範囲を扱う。

- 利用者選択
- 支援手順一覧
- 支援手順詳細
- 実施記録保存
- 履歴確認
- 実施済み判定

画面遷移は次を前提とする。

```text
/kiosk/users
/kiosk/users/:userId/procedures
/kiosk/users/:userId/procedures/:slotKey
```

現在確認している主要な構造は次のとおり。

- route は `ProtectedRoute` 配下にある。
- 利用者取得は `useUsersQuery({ selectMode: 'core' })` を使う。
- 実施記録は SharePoint 接続時に `SupportRecord_Daily` 親 + `DailyRecordRows` 子を使う。
- `ExecutionRecordRepository` は `date / userId / scheduleItemId` を主要な取得・保存軸にする。
- SharePoint upsert 時の row key は `${date}-${userId}-${scheduleItemId}` 形式である。
- `users/schema.ts` には `OrgCode` / `OrgName` があるが、現状の kiosk 事業所境界には使われていない。

## 3. 現在の単独事業所前提

現状は、少なくとも kiosk 支援手順記録の実行経路では単独事業所前提として扱う。

- `ExecutionRecord` が `date / userId / scheduleItemId` 軸である。
- `facilityId` が必須ではない。
- 利用者一覧に事業所 filter がない。
- 手順取得に事業所 filter がない。
- 実施記録の保存・取得・履歴に事業所 filter がない。
- 欠席状態の参照・更新にも事業所境界が必須化されていない。
- URL 直打ち時の事業所別許可確認がない。
- kiosk route に audience / role 境界が接続されていない。
- support procedure の静的 master / alias は、法人内で同じ利用者 ID が別事業所に存在する場合の衝突を吸収できない。

このため、別事業所を追加した場合は次のリスクがある。

- 他事業所の利用者が `/kiosk/users` に表示される。
- URL 直打ちで他事業所利用者の手順一覧・詳細に入れる。
- 実施済み判定が他事業所の記録を拾う。
- 履歴確認で他事業所の記録が混入する。
- 欠席記録が同じ `UserID` / 日付で衝突する。
- 手順 master の alias が別事業所利用者へ誤って適用される。

## 4. 展開前に必要な設計判断

実装へ進む前に、法人側と次を決める。

- `UserID` は法人内で一意か。
- 事業所 ID の正本は `OrgCode` でよいか。
- `facilityId` を新規正準キーにするか。
- 共通リスト + `facilityId` 分離にするか。
- 事業所別リスト分離にするか。
- 支援手順記録は正式記録か補助記録か。
- 既存記録へ backfill するか。
- 閲覧者と入力者をどう制限するか。
- 職員が複数事業所を兼務する場合の閲覧・入力範囲をどう扱うか。
- 手順マスターの作成・更新・承認責任者を誰にするか。
- 障害時の代替記録手段と問い合わせ窓口をどこにするか。

## 5. 推奨する設計方針

第一候補は、共通リスト + `facilityId` 分離とする。

理由は、現行コードが repository と list registry を共通化しており、小 PR で段階的に境界を追加しやすいためである。また、将来的に法人内で横断確認や監査説明を行う場合も、共通リスト上で `facilityId` を必須 filter にする方が集計しやすい。

ただし、法人側が SharePoint 権限の物理分離を必須とする場合は、事業所別リスト分離を再検討する。

### 共通リスト + `facilityId` 分離で必要になること

- 利用者 master に事業所境界の正準値を持たせる。
- `ExecutionRecord` と repository API に `facilityId` を必須化する。
- SharePoint の親・子記録に `facilityId` 列を追加する。
- `getRecords` / `getRecord` / `upsertRecord` / `deleteRecord` / `getHistoricalRecords` で `facilityId` filter を強制する。
- memory provider と SharePoint provider のどちらでも同じ境界になるようにする。
- URL 直打ち時に、対象利用者が現在の職員の事業所範囲内か確認する。
- 既存データへ `facilityId` を backfill する。

### 事業所別リスト分離を再検討する条件

- SharePoint 権限をリスト単位で分けることが必須である。
- 共通リスト上の filter では監査・運用上の説明が不十分である。
- 事業所ごとに記録保持期間、管理責任者、運用ルールが大きく異なる。

事業所別リスト分離を選ぶ場合は、list title resolver、schema registry、provisioning、運用手順、横断集計の設計を先に固める。

## 6. 実装前の停止条件

次が未確定なら、実装へ進まない。

- 法人内の `UserID` 一意性
- 事業所 ID の正本
- 閲覧者範囲
- 入力者範囲
- SharePoint 権限方式
- 既存記録の backfill 方針
- 正式記録か補助記録か
- 障害時の代替記録手段
- 問い合わせ窓口

次のどれかに該当する場合も、別事業所展開は保留する。

- 他事業所の利用者が見える可能性がある。
- 実施記録が事業所で分離されていない。
- 支援手順の更新責任者が不明である。
- 既存記録との関係が不明である。
- 本番データへ安全に試行できる範囲が不明である。

## 7. 小 PR 分割案

1. docs: 現状と展開方針を固定
2. test: repository contract test に事業所境界の失敗テストを追加
3. feat: `facilityId` 型と読み取りモデルを追加
4. feat: 利用者一覧を事業所で filter
5. feat: 実施記録 get/upsert/delete/history に `facilityId` filter を強制
6. feat: URL 直打ち guard を追加
7. docs: 試行運用 runbook と rollback 手順を追加

1 PR に複数の境界を詰め込まない。特に型追加、repository の filter 強制、UI guard、E2E は分けて確認する。

## 8. 試行運用条件

試行は次の条件を満たす場合のみ行う。

- 対象は 1 事業所
- 対象利用者は少人数
- 対象職員は限定
- 入力者と閲覧者が明確
- 支援手順の更新責任者が明確
- 既存記録との関係が明確
- 障害時の代替手段がある
- 他事業所データが見えないことをテストで確認済み

試行期間は 1-2 か月を目安とし、次を評価する。

- 入力負担
- 記録品質
- 権限事故の有無
- 手順更新運用
- 既存記録との整合
- 障害時の代替記録の実効性

## 9. 今回やらないこと

- 実装
- テスト追加
- デプロイ
- 本番データ変更
- SharePoint 列追加
- 既存データ移行
- 別事業所への試行開始
- 既存 PR への混入
