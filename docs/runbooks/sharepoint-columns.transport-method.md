# SharePoint 列追加チェックリスト: TransportMethod

## 前提

- コード側の移行は完了（method-first + boolean fallback）
- 列未追加の間は、UI/集計は boolean fallback で動作
- 列追加後に SELECT_FIELDS を有効化すると、method/note の読み戻しが完全に機能する

---

## 対象リスト

### AttendanceUsers（利用者マスタ）

| 内部名 | 型 | Choice 値 | 備考 |
|---|---|---|---|
| `DefaultTransportToMethod` | Choice or Text | `self` / `office_shuttle` / `guide_helper` / `family` / `other` | 行きデフォルト |
| `DefaultTransportFromMethod` | Choice or Text | 同上 | 帰りデフォルト |
| `DefaultTransportToNote` | Text (1行) | — | 行き備考 |
| `DefaultTransportFromNote` | Text (1行) | — | 帰り備考 |

### AttendanceDaily（当日実績）

| 内部名 | 型 | Choice 値 | 備考 |
|---|---|---|---|
| `TransportToMethod` | Choice or Text | `self` / `office_shuttle` / `guide_helper` / `family` / `other` | 当日行き手段 |
| `TransportFromMethod` | Choice or Text | 同上 | 当日帰り手段 |
| `TransportToNote` | Text (1行) | — | 行き備考 |
| `TransportFromNote` | Text (1行) | — | 帰り備考 |

> [!TIP]
> **Choice 推奨**: `self`/`office_shuttle`/`guide_helper`/`family`/`other` で統一すると変換が単純になり安定（`parseTransportMethod` の利用も最小化できる）。

---

## 列追加後の SELECT_FIELDS 有効化手順

列追加が完了したら [fields.ts](file:///Users/yasutakesougo/audit-management-system-mvp/src/sharepoint/fields.ts) で以下を SELECT に追加する：

```diff
 export const ATTENDANCE_USERS_SELECT_FIELDS = [
   // ...existing...
+  ATTENDANCE_USERS_FIELDS.defaultTransportToMethod,
+  ATTENDANCE_USERS_FIELDS.defaultTransportFromMethod,
+  ATTENDANCE_USERS_FIELDS.defaultTransportToNote,
+  ATTENDANCE_USERS_FIELDS.defaultTransportFromNote,
 ] as const;

 export const ATTENDANCE_DAILY_SELECT_FIELDS = [
   // ...existing...
+  ATTENDANCE_DAILY_FIELDS.transportToMethod,
+  ATTENDANCE_DAILY_FIELDS.transportFromMethod,
+  ATTENDANCE_DAILY_FIELDS.transportToNote,
+  ATTENDANCE_DAILY_FIELDS.transportFromNote,
 ] as const;
```

> [!IMPORTANT]
> **現状方針:**
> - 現時点では列未追加のため、これらは SELECT から除外中
> - 列が無い環境でも UI/集計は boolean fallback で継続動作
> - 列追加完了後に上記 diff を適用し、method/note の読み戻しを完全有効化する
