# `/kiosk/users?wizard=user` クエリ挙動仕様

## 1. 目的

この文書は、`/kiosk/users?wizard=user` の挙動を ADR-022 に沿った運用仕様として固定するための補足文書である。

今回の範囲はdocs-onlyである。実装、ルーティング、E2E期待値、SharePoint設定、デプロイは変更しない。

## 2. 結論

`/kiosk/users?wizard=user` は、キオスクモードの利用者選択画面として表示する。

キオスクでは、`wizard` / `user` / `userId` クエリを画面状態の主制御に使わない。これらのクエリが付いていても、`/kiosk/users` は利用者選択画面に留まり、特定利用者の手順一覧へ自動ジャンプしない。

## 3. 正本導線

ADR-022 に従い、L3「支援手順兼記録」の正本導線はキオスクモードとする。

```txt
/kiosk
  -> /kiosk/users
  -> /kiosk/users/:userId/procedures
  -> /kiosk/users/:userId/procedures/:slotKey
```

利用者は `:userId` で決定し、手順スロットは `:slotKey` で決定する。`wizard` / `user` / `userId` クエリは、キオスクの利用者または手順スロットを決定するための正本情報ではない。

`/daily/support?wizard=user` は通常業務向けの支援記録ウィザード導線であり、キオスクの正本導線とは責務が異なる。

## 4. クエリパラメータの扱い

キオスクでは、`date=YYYY-MM-DD` を記録対象日として扱う。

例:

```txt
/kiosk/users?wizard=user&date=2026-05-07
/kiosk/users/1/procedures?date=2026-05-07
/kiosk/users/1/procedures/0?date=2026-05-07
```

一方で、次の古い利用者/スロット系クエリはキオスク内の画面遷移時に除去する。

- `userId`
- `user`
- `slotId`
- `step`

これは、古いURLや通常業務ウィザード由来の状態復元クエリが残り、別の利用者や手順への遷移を誤って固定することを避けるためである。

## 5. 自動ジャンプしない例

次のようなURLは、常に利用者選択画面として扱う。

```txt
/kiosk/users?wizard=user
/kiosk/users?wizard=plan&user=I005&userId=I005
```

これらのURLから、`/kiosk/users/I005/procedures` のような手順一覧へ自動遷移してはならない。

## 6. 今回対象外

SharePoint認証エラー時に、画面上でどのように最新データ、キャッシュ、フォールバック状態を区別して見せるかは今回の実装対象外とする。

この見え方は今後の改善候補として扱い、本仕様ではキオスクのクエリ制御と正本導線のみを固定する。

## 7. 参照

- `docs/adr/ADR-022-l3-canonical-kiosk-flow.md`
- `docs/ops/kiosk-users-detached-environment-runbook.md`
- `docs/ops/kiosk-users-detached-facility-trial-plan.md`
