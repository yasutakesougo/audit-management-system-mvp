# Sprint 4: 警告・ビジネスルール - GitHub Issues

## Issue 8: 物理的ダブルブッキング禁止

### Title
```
feat(calendar): prevent physical double-booking on IntegratedResourceCalendar
```

### 📋 概要
FR-5.1対応：FullCalendar の `eventOverlap={false}` を有効化し、同一リソース・同一時間帯の物理的なダブルブッキングを禁止する。

### 🎯 目的
- データ整合性の保護（同一リソースの時間重複防止）
- ユーザーエクスペリエンスの向上（操作時の即座フィードバック）
- 将来の複雑な制約ルール実装への基盤構築

### 🔧 実装内容

#### 1. FullCalendar設定追加
```typescript
<FullCalendar
  // ...既存設定...
  eventOverlap={false}
  selectOverlap={false} // 新規作成時も重複禁止
  editable={true}
  eventAllow={eventAllow} // 既存の実績制御と組み合わせ
/>
```

#### 2. 重複試行時のフィードバック
```typescript
// ドロップ失敗時の処理
const handleEventDropFail = (info) => {
  showSnackbar('同じリソースの時間が重複しています', 'warning');
};

<FullCalendar
  eventDropFailure={handleEventDropFail}
  eventResizeFailure={handleEventDropFail}
/>
```

#### 3. 特殊イベントの除外設定
```typescript
// 実績イベント・背景イベントは重複チェック対象外
const eventOverlapFunc = (stillEvent, movingEvent) => {
  // 背景イベント（警告表示用）は重複OK
  if (stillEvent.display === 'background' || movingEvent.display === 'background') {
    return true;
  }

  // デフォルトは重複禁止
  return false;
};

<FullCalendar eventOverlap={eventOverlapFunc} />
```

### ✅ 受け入れ条件
- [ ] 同一スタッフ行で、既存Planと時間が少しでも重なる新規Planをドラッグ作成しようとしても、確実にrevertされること
- [ ] 既存Planを別の時間帯に移動させようとして重複が発生した場合、元の位置に戻ること
- [ ] 重複を検知した時に、わかりやすいSnackbar警告が表示されること
- [ ] 実績データ・警告背景などの特殊イベントの描画には影響がないこと
- [ ] eventResize（端ドラッグ）でも同様に重複防止が機能すること

### 🧪 テスト手順
1. 同一リソース行で既存イベントと重複する新規イベントを作成
2. 既存イベントを別の既存イベントと重複する位置に移動
3. イベントの端をドラッグして他イベントと重複するよう延長
4. 背景イベント（警告用）上での操作が阻害されないことを確認

---

## Issue 9: ビジネスルール警告の背景ハイライト

### Title
```
feat(calendar): show business rule warnings as background events
```

### 📋 概要
FR-5.2/5.3対応：「総計画時間 > 8h」などのビジネスルール違反を背景色ハイライトで表示し、管理者が一目で問題を把握できるようにする。

### 🎯 目的
- ビジネスルール違反の視覚的警告
- 予防的なリソース管理の支援
- 労働基準法等のコンプライアンス支援

### 🔧 実装内容

#### 1. 警告イベント専用API
```typescript
// src/api/warningEventsApi.ts
export interface WarningBackgroundEvent {
  id: string;
  resourceId: string;
  start: string;
  end: string;
  display: 'background';
  className: string;
  backgroundColor: string;
  title?: string; // ツールチップ用
  extendedProps: {
    warningType: 'overtime' | 'consecutive-days' | 'skill-mismatch';
    severity: 'info' | 'warning' | 'error';
    message: string;
  };
}

export async function fetchWarningEvents(fetchInfo: DateRangeInput): Promise<WarningBackgroundEvent[]> {
  // モック実装：特定条件で警告イベント生成
  const warnings: WarningBackgroundEvent[] = [];

  // 例：スタッフ1の11/16 9:00-18:00を残業警告エリアとして設定
  warnings.push({
    id: 'warning-overtime-staff1-20251116',
    resourceId: 'staff-1',
    start: '2025-11-16T09:00:00',
    end: '2025-11-16T18:00:00',
    display: 'background',
    className: 'warning-background-overtime',
    backgroundColor: 'rgba(255, 152, 0, 0.1)', // 薄オレンジ
    title: '8時間超勤務警告',
    extendedProps: {
      warningType: 'overtime',
      severity: 'warning',
      message: '本日の計画時間が8時間を超過しています'
    }
  });

  return warnings;
}
```

#### 2. eventSources設定変更
```typescript
// IntegratedResourceCalendarPage.tsx
<FullCalendar
  eventSources={[
    {
      events: fetchUnifiedEvents, // 既存のPlan+Actualイベント
    },
    {
      events: fetchWarningEvents, // 新規：警告背景イベント
      className: 'warning-event-source',
    },
  ]}
/>
```

#### 3. 警告専用CSS
```css
/* src/features/resources/styles/warningStyles.css */
.warning-background-overtime {
  background-color: rgba(255, 152, 0, 0.1) !important;
  border: none;
}

.warning-background-consecutive {
  background-color: rgba(244, 67, 54, 0.1) !important;
  border: none;
}

.warning-background-skill {
  background-color: rgba(156, 39, 176, 0.1) !important;
  border: none;
}

/* 警告エリア上のホバー効果 */
.fc-bg-event.warning-background-overtime:hover {
  background-color: rgba(255, 152, 0, 0.2) !important;
}
```

#### 4. 警告エリア上での新規作成制限（オプション）
```typescript
const selectOverlapFunc = (stillEvent) => {
  // 警告背景エリア上での新規作成を警告
  if (stillEvent.display === 'background' && stillEvent.extendedProps.severity === 'error') {
    showSnackbar('この時間帯は制約に違反する可能性があります', 'warning');
    return false; // 作成を禁止
  }
  return true;
};

<FullCalendar selectOverlap={selectOverlapFunc} />
```

### ✅ 受け入れ条件
- [ ] モック条件（例：総計画時間が8hを超えるリソース）に該当する行・時間帯が薄い警告色で背景表示される
- [ ] 警告の種類（残業・連続勤務・スキル不足等）に応じて色分けされる
- [ ] 通常のPlan/Actualイベントの描画・クリック操作に影響しない
- [ ] 警告背景エリアにマウスホバーした時に警告内容がツールチップ表示される
- [ ] 警告背景イベントはクリックや編集ができない（display: 'background'）

### 🧪 テスト手順
1. 警告条件を満たすモックデータでカレンダー表示
2. 該当リソース・時間帯に薄い背景色が表示されることを確認
3. 背景警告上での通常イベント操作が正常に動作することを確認
4. 警告背景ホバー時のツールチップ表示を確認

---

## Issue 10: クライアントサイド警告集計とUI表示

### Title
```
feat(calendar): compute and display client-side staff warnings (capacity etc.)
```

### 📋 概要
FR-5.2対応：`eventsSet`でロード済みイベントを集計し、リソースごとの警告情報（総計画時間・連続勤務等）を計算してサイドパネルで表示する。

### 🎯 目的
- リアルタイムなリソース状況の可視化
- イベント追加・変更に連動した動的警告更新
- 管理者の意思決定支援

### 🔧 実装内容

#### 1. 警告集計ユーティリティ
```typescript
// src/features/resources/utils/resourceWarnings.ts
export interface ResourceWarningState {
  resourceId: string;
  resourceName: string;
  totalPlanMinutes: number;
  continuousMinutes: number;
  breakCount: number;
  isOvertimeWarning: boolean;
  isContinuousWarning: boolean;
  warnings: string[];
}

export function calculateResourceWarnings(
  events: EventApi[],
  date: Date
): ResourceWarningState[] {
  const resourceMap = new Map<string, ResourceWarningState>();

  // 背景イベントを除外してPlan/Actualのみ処理
  const planEvents = events.filter(
    e => e.display !== 'background' && isOnDate(e, date)
  );

  planEvents.forEach(event => {
    const resourceId = event.getResources()[0]?.id;
    if (!resourceId) return;

    const duration = (event.end?.getTime() ?? 0) - (event.start?.getTime() ?? 0);
    const minutes = duration / (1000 * 60);

    if (!resourceMap.has(resourceId)) {
      resourceMap.set(resourceId, {
        resourceId,
        resourceName: event.getResources()[0]?.title ?? '',
        totalPlanMinutes: 0,
        continuousMinutes: 0,
        breakCount: 0,
        isOvertimeWarning: false,
        isContinuousWarning: false,
        warnings: []
      });
    }

    const state = resourceMap.get(resourceId)!;
    state.totalPlanMinutes += minutes;

    // 休憩イベントの数をカウント
    if (event.extendedProps.planType === 'break') {
      state.breakCount++;
    }
  });

  // 警告フラグの設定
  resourceMap.forEach(state => {
    const totalHours = state.totalPlanMinutes / 60;

    if (totalHours > 8) {
      state.isOvertimeWarning = true;
      state.warnings.push(`総計画時間 ${totalHours.toFixed(1)}時間（8時間超過）`);
    }

    if (state.breakCount === 0 && totalHours > 6) {
      state.isContinuousWarning = true;
      state.warnings.push('6時間以上の連続勤務（休憩未設定）');
    }
  });

  return Array.from(resourceMap.values());
}
```

#### 2. 警告表示サイドパネル
```tsx
// src/features/resources/components/ResourceWarningsPanel.tsx
export function ResourceWarningsPanel({
  warnings
}: {
  warnings: ResourceWarningState[]
}) {
  const hasWarnings = warnings.some(w => w.warnings.length > 0);

  if (!hasWarnings) {
    return (
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" color="success.main">
          ✅ 警告事項はありません
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        ⚠️ リソース警告
      </Typography>

      {warnings.filter(w => w.warnings.length > 0).map(warning => (
        <Alert
          key={warning.resourceId}
          severity={warning.isOvertimeWarning ? 'warning' : 'info'}
          sx={{ mb: 1 }}
        >
          <Typography variant="subtitle2">
            {warning.resourceName}
          </Typography>
          {warning.warnings.map((msg, idx) => (
            <Typography key={idx} variant="body2">
              • {msg}
            </Typography>
          ))}
        </Alert>
      ))}
    </Paper>
  );
}
```

#### 3. IntegratedResourceCalendarPageへの組み込み
```tsx
// IntegratedResourceCalendarPage.tsx に追加
const [resourceWarnings, setResourceWarnings] = useState<ResourceWarningState[]>([]);

/**
 * イベント更新時の警告再計算
 */
const handleEventsSet = (events: EventApi[]) => {
  const today = new Date();
  const warnings = calculateResourceWarnings(events, today);
  setResourceWarnings(warnings);
};

return (
  <Container maxWidth="xl">
    {/* 警告パネル */}
    <ResourceWarningsPanel warnings={resourceWarnings} />

    {/* カレンダー */}
    <FullCalendar
      eventsSet={handleEventsSet}
      // ...既存設定...
    />
  </Container>
);
```

#### 4. リソース行への警告アイコン表示
```tsx
// resourceAreaColumns設定で警告アイコンを表示
const resourceAreaColumns = [
  {
    field: 'title',
    headerContent: 'リソース',
  },
  {
    field: 'warning',
    headerContent: '状態',
    width: 50,
    cellContent: (arg) => {
      const resourceId = arg.resource.id;
      const warning = resourceWarnings.find(w => w.resourceId === resourceId);

      if (warning?.warnings.length) {
        return (
          <Tooltip title={warning.warnings.join(', ')}>
            <span style={{ fontSize: '16px' }}>⚠️</span>
          </Tooltip>
        );
      }

      return <span style={{ fontSize: '16px' }}>✅</span>;
    },
  },
];

<FullCalendar resourceAreaColumns={resourceAreaColumns} />
```

### ✅ 受け入れ条件
- [ ] 特定の条件（総計画8h超過など）に該当するスタッフが警告リストに表示される
- [ ] リソース行に警告アイコン（⚠️）が表示され、ホバーで詳細確認できる
- [ ] イベントの追加・移動・削除で`eventsSet`が再実行され、警告表示がリアルタイム更新される
- [ ] 背景イベント（Issue 9の警告背景）は集計対象から除外される
- [ ] 警告がない場合は「警告事項はありません」の表示になる

### 🧪 テスト手順
1. 8時間を超えるPlanを配置して総時間警告を確認
2. 6時間以上の連続勤務（休憩なし）で連続勤務警告を確認
3. イベント追加・削除で警告リストがリアルタイム更新されることを確認
4. リソース行の警告アイコンとツールチップを確認

---

## 📊 Sprint 4 全体の完了条件

### 必須機能（Must Have）
- [ ] Issue 8: 物理的ダブルブッキング禁止
- [ ] Issue 9: ビジネスルール警告背景表示
- [ ] Issue 10: クライアントサイド警告集計・表示

### 追加機能（Should Have）
- [ ] 警告レベル別の色分け詳細化
- [ ] 警告ルールの設定画面
- [ ] 警告履歴・ログ記録

### 統合テスト項目
1. **制約の競合**: ダブルブッキング禁止 vs 警告背景の共存
2. **パフォーマンス**: 大量イベント時の警告計算速度
3. **ユーザビリティ**: 警告表示の視認性・操作性
4. **データ整合性**: サーバサイド制約との一貫性

---

**次回**: Sprint 4 実装開始時のキックオフ、または実装中の技術サポートでお声がけください 🚀