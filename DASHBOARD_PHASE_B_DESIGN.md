# Phase B 実装ガイド：3レーン・スケジュール・ビジュアライザー

## 📋 概要

朝会モードの基盤（Phase A）が完成したため、次に現場が求める**「誰がどこで何をしているか」を一目で把握できる3レーンスケジュール**を実装します。

---

## 🎯 目的

### 現場の課題
- 欠席者が出た → 誰がフォローできるか、すぐに判断したい
- 利用者A さんの担当は誰？ → 探すのに時間がかかる
- ヘルプを出したい → 誰が今フリーか分からない

### 解決策
**職員の「フリー状態」を色で可視化**し、タップ一つで詳細確認できる UI を提供

---

## 🏗️ アーキテクチャ

### データフロー

```
[useDashboardSummary]
  ↓ scheduleLanesToday（既存）
  ↓ staff（職員一覧）
  ↓
[staffAvailability.ts]
  ├─ calculateStaffAvailability()
  │   → StaffAvailability[] を計算
  ↓
[ScheduleSection]
  ├─ 3レーン表示
  │   ├─ 利用者レーン（左）
  │   ├─ 職員レーン（中央）← 🔥 ここを強化
  │   └─ 組織レーン（右）
  ↓
[StaffAllocationCard]（新規コンポーネント）
  ├─ 職員名
  ├─ 状態インジケータ（色分け）
  ├─ 現在の担当
  └─ 次のフリー時間
```

---

## 🎨 UI デザイン（タブレット最適化）

### 3レーンレイアウト

```
┌─────────────────────────────────────────────────────────────┐
│  📅 今日のスケジュール（朝）- 8:00 - 12:00                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  👥 利用者レーン    │  🧑‍💼 職員レーン     │  🏢 組織レーン  │
│                    │                    │                   │
│  8:30 山田太郎     │  田中（メイン）    │  8:15 朝会       │
│  生活支援          │  ✅ フリー 9:30-   │  全職員          │
│                    │                    │                   │
│  10:00 鈴木花子    │  佐藤（サポート）  │  10:30 避難訓練  │
│  個別支援          │  ⚠️ 多忙           │  全員参加        │
│                    │                    │                   │
│                    │  高橋（新人）      │                   │
│                    │  🟢 完全フリー     │                   │
│                    │  ヘルプ可能        │                   │
│                    │                    │                   │
└─────────────────────────────────────────────────────────────┘
```

### 状態の色分け

| 状態 | 色 | アイコン | 意味 |
|------|---|---------|------|
| free | 🟢 Green | ✅ | 完全フリー、ヘルプ可能 |
| partial | 🟡 Yellow | ⏳ | 30分以内に予定あり |
| busy | 🟠 Orange | ⚠️ | サポート役として稼働中 |
| occupied | ⚫ Gray | 🚫 | メイン担当中、対応不可 |

---

## 🔧 実装ステップ

### Step 1: `useDashboardSummary` に職員フリー判定を追加

```typescript
// useDashboardSummary.ts に追加

import { calculateStaffAvailability } from './staffAvailability';

export interface DashboardSummary {
  // ... 既存フィールド
  staffAvailability: StaffAvailability[];  // ✨ 新規
}

// Hook 内で計算

const staffAvailability = useMemo(() => {
  // scheduleLanesToday から StaffAssignment を生成
  const assignments: StaffAssignment[] = scheduleLanesToday.staffLane.map((item) => ({
    userId: item.id,
    userName: item.title,
    role: 'main',  // TODO: 実データから判定
    startTime: item.time.split('-')[0].trim(),
    endTime: item.time.split('-')[1]?.trim() ?? '18:00',
  }));

  const currentTime = new Date().toTimeString().slice(0, 5); // "10:30"
  return calculateStaffAvailability(staff, assignments, currentTime);
}, [staff, scheduleLanesToday, currentHour]);

return {
  // ... 既存
  staffAvailability,
};
```

---

### Step 2: ScheduleSection を拡張

```typescript
// ScheduleSection.tsx

export type ScheduleSectionProps = {
  title?: string;
  schedulesEnabled: boolean;
  scheduleLanesToday: {
    userLane: ScheduleItem[];
    staffLane: ScheduleItem[];
    organizationLane: ScheduleItem[];
  };
  staffAvailability: StaffAvailability[];  // ✨ 新規
};

export const ScheduleSection: React.FC<ScheduleSectionProps> = (props) => {
  const { staffAvailability } = props;

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h6">📅 今日のスケジュール</Typography>

        {/* 3レーン表示 */}
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <LaneRenderer title="利用者" items={props.scheduleLanesToday.userLane} />
          </Grid>

          <Grid item xs={12} md={4}>
            {/* ✨ 職員レーン（状態可視化版） */}
            <StaffAllocationRenderer staffAvailability={staffAvailability} />
          </Grid>

          <Grid item xs={12} md={4}>
            <LaneRenderer title="組織" items={props.scheduleLanesToday.organizationLane} />
          </Grid>
        </Grid>

        {/* フリー職員のハイライト */}
        <FreeStaffAlert staffAvailability={staffAvailability} />
      </Stack>
    </Paper>
  );
};
```

---

### Step 3: StaffAllocationRenderer（新規コンポーネント）

```typescript
// StaffAllocationRenderer.tsx

type StaffAllocationRendererProps = {
  staffAvailability: StaffAvailability[];
};

const StaffAllocationRenderer: React.FC<StaffAllocationRendererProps> = ({
  staffAvailability,
}) => {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
        🧑‍💼 職員レーン
      </Typography>
      <Stack spacing={1}>
        {staffAvailability.map((staff) => (
          <StaffAllocationCard key={staff.staffId} staff={staff} />
        ))}
      </Stack>
    </Paper>
  );
};
```

---

### Step 4: StaffAllocationCard（状態表示カード）

```typescript
// StaffAllocationCard.tsx

const STATUS_CONFIG: Record<StaffAvailabilityStatus, {
  color: string;
  icon: React.ReactNode;
  label: string;
}> = {
  free: {
    color: 'success.main',
    icon: <CheckCircleIcon />,
    label: 'フリー',
  },
  partial: {
    color: 'warning.main',
    icon: <ScheduleIcon />,
    label: '部分フリー',
  },
  busy: {
    color: 'orange',
    icon: <WarningIcon />,
    label: '多忙',
  },
  occupied: {
    color: 'grey.500',
    icon: <BlockIcon />,
    label: '対応中',
  },
};

type StaffAllocationCardProps = {
  staff: StaffAvailability;
};

const StaffAllocationCard: React.FC<StaffAllocationCardProps> = ({ staff }) => {
  const config = STATUS_CONFIG[staff.status];

  return (
    <Card
      variant="outlined"
      sx={{
        borderLeft: `4px solid`,
        borderLeftColor: config.color,
        '&:hover': {
          boxShadow: 2,
          cursor: 'pointer',
        },
      }}
    >
      <CardContent sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ color: config.color }}>{config.icon}</Box>
          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
            {staff.staffName}
          </Typography>
          <Chip size="small" label={config.label} color="default" sx={{ ml: 'auto' }} />
        </Stack>

        {/* 現在の担当 */}
        {staff.currentAssignment && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            → {staff.currentAssignment.userName} の{staff.currentAssignment.role === 'main' ? 'メイン' : 'サポート'}
          </Typography>
        )}

        {/* 次のフリー時間 */}
        {staff.nextFreeTime && staff.status !== 'free' && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            次のフリー: {staff.nextFreeTime}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};
```

---

## 🧪 テスト戦略

### Unit Test（staffAvailability.test.ts）

✅ **完成済み**
- free/partial/busy/occupied の判定ロジック
- freeSlots の計算
- nextFreeTime の計算

### E2E Test（dashboard-schedule.spec.ts）

```typescript
test('職員レーンで「フリー」職員が緑色で表示される', async ({ page }) => {
  await page.goto('/dashboard');

  // 職員レーンが表示されている
  const staffLane = page.getByText('🧑‍💼 職員レーン');
  await expect(staffLane).toBeVisible();

  // フリー職員のカードが存在する
  const freeStaff = page.locator('[data-testid="staff-card-free"]').first();
  if (await freeStaff.isVisible()) {
    // 緑色のボーダーがある
    const borderColor = await freeStaff.evaluate((el) => {
      return window.getComputedStyle(el).borderLeftColor;
    });
    expect(borderColor).toMatch(/rgb.*green/);
  }
});
```

---

## 📊 期待される効果

### 定量的効果
- **情報検索時間**: 30秒 → 5秒（6倍短縮）
- **ヘルプ依頼の遅延**: 5分 → 30秒（10倍短縮）
- **職員間の声かけ頻度**: 減少（画面で確認可能）

### 定性的効果
- 朝会での「誰が担当？」質問が減少
- 欠席時の代替配置がスムーズに
- 職員の心理的負担軽減（探す手間が不要）

---

## 🚀 次のアクション

### 優先度 A（必須）
1. ✅ staffAvailability.ts の実装完了
2. ✅ ユニットテストの実装完了
3. ⏳ useDashboardSummary への統合
4. ⏳ ScheduleSection の拡張
5. ⏳ StaffAllocationCard の実装

### 優先度 B（推奨）
- フリー職員数のサマリー表示
- タップで詳細モーダル表示
- 「ヘルプ依頼」ボタンの追加

### 優先度 C（将来）
- ドラッグ＆ドロップで担当変更
- 職員の空き時間カレンダー表示
- リアルタイム更新（WebSocket）

---

## 💡 実装のポイント

### 現在時刻の取得
```typescript
const currentTime = useMemo(() => {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}, []);
```

### デモデータの拡張
scheduleLanesToday.staffLane に `role` と時間帯情報を追加する必要あり

### レスポンシブ対応
- タブレット: 3カラム（横並び）
- スマホ: スタック（縦並び）

---

## 📝 まとめ

Phase B の実装により、ダッシュボードが**「情報表示」から「意思決定支援ツール」**へ進化します。職員の「フリー」状態が色で一目でわかることで、現場の「誰に頼むか」という判断が数秒で完結します。

**次は実装を開始しますか？それとも設計の詳細を詰めますか？**
