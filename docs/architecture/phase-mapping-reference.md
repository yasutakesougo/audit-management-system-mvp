# フェーズマッピングリファレンス

> テスト期待値を決めるときの **唯一の参照先**

## 判定の流れ

```
時刻 → DEFAULT_PHASE_CONFIG (9分割)
     → toLegacyPhase() (6分割へ写像)
     → toLegacyPrimaryScreen() (主役画面)
```

**SSOT は 9分割 `DEFAULT_PHASE_CONFIG`**。
6分割はUI表示・導線用のマッピング結果であり、直接判定はしない。

---

## 9分割 → 6分割 マッピング表

| # | 9分割キー | 時間帯 | → 6分割フェーズ | 主役画面 | /today が主役? | color |
|---|-----------|--------|----------------|----------|---------------|-------|
| 1 | `after_hours_review` | 18:00–08:30 | `record-review` | `/dashboard` | ❌ | success |
| 2 | `staff_prep` | 08:30–09:00 | `preparation` | `/today` | ✅ | info |
| 3 | `morning_briefing` | 09:00–09:15 | `morning-meeting` | `/handoff-timeline` | ❌ | warning |
| 4 | `arrival_intake` | 09:15–10:30 | `am-operation` | `/daily` ※1 | ❌ | info |
| 5 | `am_activity` | 10:30–12:00 | `am-operation` | `/today` | ✅ | info |
| 6 | `pm_activity` | 12:00–15:30 | `pm-operation` | `/daily` | ❌ | info |
| 7 | `departure_support` | 15:30–16:00 | `evening-closing` | `/daily` ※1 | ❌ | warning |
| 8 | `record_wrapup` | 16:00–17:00 | `record-review` | `/daily` | ❌ | success |
| 9 | `evening_briefing` | 17:00–18:00 | `record-review` | `/handoff-timeline` | ❌ | success |

※1 `arrival_intake` と `departure_support` の `configPrimaryScreen` は `/daily/attendance` だが、
`toLegacyPrimaryScreen()` により `/daily` に変換される。

---

## テスト時刻 → 期待値 早見表

テストで使う代表時刻と、その期待値を一覧にする。
**境界時刻**（フェーズ切り替わり直後）を優先的に選ぶこと。

| 時刻 | 9分割キー | 6分割フェーズ | 主役画面 | isTodayPrimary |
|------|-----------|-------------|----------|----------------|
| 03:00 | `after_hours_review` | `record-review` | `/dashboard` | false |
| 06:00 | `after_hours_review` | `record-review` | `/dashboard` | false |
| 07:30 | `after_hours_review` | `record-review` | `/dashboard` | false |
| **08:30** | `staff_prep` | `preparation` | `/today` | **true** |
| 08:45 | `staff_prep` | `preparation` | `/today` | **true** |
| **09:00** | `morning_briefing` | `morning-meeting` | `/handoff-timeline` | false |
| 09:05 | `morning_briefing` | `morning-meeting` | `/handoff-timeline` | false |
| **09:15** | `arrival_intake` | `am-operation` | `/daily` | false |
| 09:30 | `arrival_intake` | `am-operation` | `/daily` | false |
| **10:30** | `am_activity` | `am-operation` | `/today` | **true** |
| 11:00 | `am_activity` | `am-operation` | `/today` | **true** |
| **12:00** | `pm_activity` | `pm-operation` | `/daily` | false |
| 13:00 | `pm_activity` | `pm-operation` | `/daily` | false |
| 14:00 | `pm_activity` | `pm-operation` | `/daily` | false |
| **15:30** | `departure_support` | `evening-closing` | `/daily` | false |
| **16:00** | `record_wrapup` | `record-review` | `/daily` | false |
| **17:00** | `evening_briefing` | `record-review` | `/handoff-timeline` | false |
| **18:00** | `after_hours_review` | `record-review` | `/dashboard` | false |
| 20:00 | `after_hours_review` | `record-review` | `/dashboard` | false |

**太字** = 境界時刻（フェーズ切り替え直後）。テストではこれらを優先して使う。

---

## マッピングコードの所在

| ファイル | 責務 |
|---------|------|
| `src/features/operationFlow/domain/defaultPhaseConfig.ts` | 9分割の時刻定義 (SSOT) |
| `src/features/operationFlow/domain/getCurrentPhaseFromConfig.ts` | 時刻 → 9分割キー判定 |
| `src/features/operationFlow/domain/phaseConfigBridge.ts` | 9分割 → 6分割変換 |
| `src/shared/domain/operationalPhase.ts` | 旧6分割の型定義・ラベル |

---

## テスト修正時のチェックリスト

1. **時刻から期待値を決めるときは、まず上の早見表を引く**
2. 新しい時刻を追加する場合は `DEFAULT_PHASE_CONFIG` で該当フェーズを確認
3. `isTodayPrimary` は `configPrimaryScreen` が `/today` のフェーズのみ `true`
4. `color` は 6分割フェーズに依存:
   - `preparation` → `info`
   - `morning-meeting` → `warning`
   - `am-operation` / `pm-operation` → `info`
   - `evening-closing` → `warning`
   - `record-review` → `success`
5. `suggestedAction` は `preparation`/`am-operation`/`pm-operation` で設定、他は `null`

---

## 境界時刻の解釈ルール

> **境界時刻は「その時刻を含む開始時刻」として扱う。終了時刻ちょうどは次フェーズに属する。**

例:
- `09:00` → `morning_briefing` の開始 (**含む**)
- `09:15` → `morning_briefing` の終了 = `arrival_intake` の開始 (**次フェーズ**)
- `10:30` → `am_activity` の開始 (**含む**)

`getCurrentPhaseFromConfig()` は `startTime <= now < endTime` で判定する。

---

*最終更新: 2026-03-13 — テスト期待値の9分割統一に伴い作成*
