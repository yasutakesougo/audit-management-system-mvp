# ページ責務マップ — `/dashboard` `/today` `/dashboard/briefing`

> 申し送り（Handoff）を軸に 3 ページの役割を整理する設計メモ。
> 新しい UI を追加するときは、まずこの表で配置先を判断する。

---

## 1. 3 ページの目的

| ページ | 一言 | 対象ユーザー | 滞在時間 |
|---|---|---|---|
| `/dashboard` | **俯瞰・監視** — 施設全体の今日の状況を一画面で把握する | 管理者・リーダー | 長い（常時表示） |
| `/today` | **即時行動** — 今やるべき 1 アクションを明示し、すぐ動ける | 現場職員 | 短い（見て動く） |
| `/dashboard/briefing` | **会議進行** — 朝会/夕会に必要な時系列確認と整理を支える | 司会者・参加者 | 中（会議中） |

---

## 2. 申し送りデータの見せ方

| ページ | 表示形式 | データスコープ | 目的 |
|---|---|---|---|
| `/dashboard` | **KPI チップ**（未対応 N / 注意 N）+<br>**Live Feed**（直近タイムライン） | 今日 | 全体傾向の監視。詳細は `/handoff-timeline` へ遷移 |
| `/today` | **NextActionCard の CTA**<br>（「申し送り確認」ボタン） | 今の scene に応じた timeFilter | 次の 1 アクションとして提示。タップで `/handoff-timeline` へ |
| `/dashboard/briefing` | **タイムライン埋め込み**<br>（朝会=昨日 / 夕会=今日） +<br>**要点サマリ**（合計・注意・未対応） | 朝会: `yesterday`<br>夕会: `today` | 会議中にその場で確認。`もっと見る` で `/handoff-timeline` へ |

### 申し送りデータの流れ

```
useHandoffSummary / useHandoffTimeline
    │
    ├── /dashboard     → KPI チップ + Live Feed（今日）
    ├── /today         → NextActionCard の CTA（scene 依存）
    └── /briefing      → タイムライン埋め込み（朝=昨日, 夕=今日）
                         + 要点サマリチップ
```

---

## 3. CTA の置き場所ルール

| 原則 | 説明 |
|---|---|
| **1 ページ 1 主導線** | 各ページには「主行動」が 1 つだけある。複数の CTA が主張を競合してはならない |
| **主か補か明示** | primary CTA = 1 つ、補助 CTA = text / outlined で視覚的に下げる |
| **遷移先は `/handoff-timeline`** | 3 ページとも申し送りの詳細は `/handoff-timeline` に集約。ページ内に CRUD 画面を作らない |

### ページ別の CTA 配置

| ページ | 主 CTA | 補助 CTA |
|---|---|---|
| `/dashboard` | なし（監視画面のため自発行動は促さない） | `Live Feed → もっと見る`<br>`Briefing バナー → 朝会/夕会情報へ` |
| `/today` | `NextActionCard` の primary ボタン | empty state の `記録メニューへ`<br>`ProgressStatusBar` は CTA なし |
| `/dashboard/briefing` | `MeetingTabContent` のタイムライン確認 | `もっと見る → /handoff-timeline`<br>`TimelineTabPanel → 全件表示` |

---

## 4. 新規 UI 追加時の判断フロー

新しい情報や CTA を追加するときは、以下のフローで配置先を決める。

```
「この情報は誰がいつ見るか？」
    │
    ├─ 常時監視したい → /dashboard（KPI or Live Feed）
    │
    ├─ 今すぐ動く必要がある → /today（NextActionCard or Bento widget）
    │
    └─ 会議中に確認・整理する → /dashboard/briefing（タブ内パネル）
```

### 判断基準の補足

| 質問 | Yes なら | No なら |
|---|---|---|
| 管理者が「全体の傾向」として見たいか？ | `/dashboard` | ↓ |
| 現場職員が「今すぐ」反応する必要があるか？ | `/today` | ↓ |
| 朝会/夕会の「議題」として扱うか？ | `/dashboard/briefing` | ↓ |
| 上のどれにも当てはまらない | 専用ページ or 既存ページの Bento widget | — |

---

## 5. 現在の実装状態

### `/dashboard`
- `BentoGridKPI`: 未対応・注意件数をチップ表示
- `HandoffLiveFeed`: 今日の申し送りタイムライン（直近）
- `BriefingBanner`: 時間帯に応じた朝会/夕会への誘導

### `/today`
- `NextActionCard`: scene ベースで次のアクションを 1 つ提示
- `ProgressStatusBar`: 進捗俯瞰（CTA なし）
- Empty state: 補助導線（記録メニュー / スケジュール）

### `/dashboard/briefing`
- `MeetingTabContent`: 朝会（昨日分）/ 夕会（今日分）の申し送りタイムライン + 要点サマリ + 進行ガイド
- `WeeklyTabPanel`: 週次記録サマリーチャート
- `TimelineTabPanel`: `/handoff-timeline` への全件表示リンク

> [!NOTE]
> 以下のタブは 2026-03-11 時点で **非表示（保留配置）** としている。
> `PlaceholderTabPanel` コンポーネントと型定義はコード上に残存しており、再配置時に復元可能。

---

## 6. 保留配置タブ

| タブ | 保留理由 | 再配置候補 |
|---|---|---|
| **運営管理情報** | `/dashboard` の KPI / Bento widget のほうが監視文脈に近い | `/dashboard` に配置 |
| **統合利用者プロファイル** | 情報設計が未確定。会議利用ニーズの再確認が必要 | 再確認後に `/dashboard/briefing` または専用ページ |

### 再表示の判断基準

以下の条件を満たした場合に `/dashboard/briefing` へ戻すことを検討する:

1. 情報設計（表示項目・データソース）が確定している
2. 「会議進行中に参照する」ユースケースが明確である
3. セクション 4 の判断フローで `/dashboard/briefing` が最適と結論づけられる

---

_最終更新: 2026-03-11_
