# Sprint 3: PvsA統合ビュー - GitHub Issues

## Issue 2: 統合イベント型 UnifiedResourceEvent の導入

### 📋 概要
FR-3.1, 3.2に対応：Plan（計画）とActual（実績）を統合したイベント型を定義し、既存のPlan APIを拡張する

### 🎯 目的
- Plan + Actual情報を1つのイベントオブジェクトで管理
- FullCalendarでPvsA（Plan vs Actual）表示の基盤を構築
- 既存のPlan CRUD機能との互換性を保持

### 📁 作業ファイル
- `src/features/resources/types.ts` (新規作成)
- `src/lib/mappers/index.ts` (型更新)
- `src/api/mockEndpoints.ts` (UnifiedResourceEvent対応)

### 🔧 実装内容

#### 1. 統合イベント型定義
```typescript
// src/features/resources/types.ts
export type PvsAStatus =
  | 'waiting'      // 実績なし
  | 'in-progress'  // 開始済み・未終了
  | 'completed'    // 完了・差分±5分以内
  | 'delayed'      // 完了・差分+5分超過
  | 'cancelled';   // キャンセル

export interface UnifiedResourceEvent {
  id: string;
  resourceId: string;
  title: string;
  start: string; // ISO文字列
  end: string;   // ISO文字列
  className?: string | string[];
  editable?: boolean;
  extendedProps: {
    // Plan情報
    planId: string;
    planType?: 'visit' | 'center' | 'travel' | 'break' | 'admin';

    // Actual情報
    recordId?: string;
    actualStart?: string | null;
    actualEnd?: string | null;
    status?: PvsAStatus;
    percentComplete?: number; // 0-100
    notes?: string;

    // 派生情報
    diffMinutes?: number | null; // 計画との差分(分)
  };
}
```

#### 2. 既存API拡張
```typescript
// src/api/mockEndpoints.ts に追加
export const mockUnifiedEvents: UnifiedResourceEvent[] = [
  {
    id: 'plan-1',
    resourceId: 'staff-1',
    title: '利用者宅訪問',
    start: '2025-11-16T09:00:00',
    end: '2025-11-16T10:00:00',
    editable: true,
    extendedProps: {
      planId: 'plan-1',
      planType: 'visit',
      // 実績なし = waiting
      status: 'waiting'
    }
  },
  {
    id: 'plan-2',
    resourceId: 'staff-1',
    title: 'デイサービス送迎',
    start: '2025-11-16T10:30:00',
    end: '2025-11-16T11:00:00',
    editable: false, // 実績ありなので編集不可
    extendedProps: {
      planId: 'plan-2',
      planType: 'travel',
      recordId: 'record-2',
      actualStart: '2025-11-16T10:35:00', // +5分遅れ
      actualEnd: '2025-11-16T11:15:00',   // +15分遅れ
      status: 'delayed',
      percentComplete: 100,
      diffMinutes: 20, // 計20分遅延
      notes: '道路渋滞のため遅延'
    }
  }
];
```

### ✅ 完了条件
- [ ] `UnifiedResourceEvent` 型とPvsAStatus enumが定義済み
- [ ] `/api/events/unified` モックエンドポイントが動作
- [ ] 実績なしPlan → `status: 'waiting'`, `editable: true`
- [ ] 実績ありPlan → `status: completed/delayed/...`, `editable: false`
- [ ] 既存のPlan CRUD機能が引き続き動作

### 🧪 テスト観点
- UnifiedResourceEvent型のTypeScript型チェック
- モックデータの妥当性検証
- 既存機能の回帰テスト

---

## Issue 3: PvsAステータス計算ユーティリティ

### 📋 概要
FR-3.2, 3.3対応：Plan vs Actual の差分計算とステータス判定ロジックを実装

### 🎯 目的
- ビジネスルールに基づくPvsAステータス自動判定
- UIから切り離されたテスト可能なユーティリティ関数
- 将来のリアルタイム更新対応

### 📁 作業ファイル
- `src/features/resources/pvsA.ts` (新規作成)
- `src/features/resources/pvsA.test.ts` (テストファイル)

### 🔧 実装内容

#### 1. ステータス計算関数
```typescript
// src/features/resources/pvsA.ts
export function calculatePvsAStatus(event: UnifiedResourceEvent): PvsAStatus {
  const { actualStart, actualEnd } = event.extendedProps;

  // 実績なし
  if (!actualStart && !actualEnd) return 'waiting';

  // 開始済み・未終了
  if (actualStart && !actualEnd) return 'in-progress';

  // 完了済み - 差分チェック
  if (actualStart && actualEnd) {
    const diffMinutes = calculateTimeDifference(event);
    return Math.abs(diffMinutes) <= 5 ? 'completed' : 'delayed';
  }

  return 'waiting';
}

export function calculateTimeDifference(event: UnifiedResourceEvent): number {
  const planStart = new Date(event.start);
  const planEnd = new Date(event.end);
  const { actualStart, actualEnd } = event.extendedProps;

  if (!actualStart || !actualEnd) return 0;

  const actualStartTime = new Date(actualStart);
  const actualEndTime = new Date(actualEnd);

  const planDuration = planEnd.getTime() - planStart.getTime();
  const actualDuration = actualEndTime.getTime() - actualStartTime.getTime();

  return (actualDuration - planDuration) / (1000 * 60); // 分単位
}

export function enrichWithPvsA(event: UnifiedResourceEvent): UnifiedResourceEvent {
  const status = calculatePvsAStatus(event);
  const diffMinutes = calculateTimeDifference(event);

  return {
    ...event,
    editable: !event.extendedProps.actualStart, // 実績ありは編集不可
    extendedProps: {
      ...event.extendedProps,
      status,
      diffMinutes
    }
  };
}
```

### ✅ 完了条件
- [ ] `calculatePvsAStatus` が正しいステータスを返す
- [ ] `calculateTimeDifference` が正確な差分計算を行う
- [ ] `enrichWithPvsA` でイベントが適切に拡張される
- [ ] 単体テストが全てpass
- [ ] エッジケース（null値、無効日付等）への対応

### 🧪 テストケース
```typescript
describe('PvsA計算', () => {
  it('実績なし → waiting', () => {
    const event = createMockEvent({ actualStart: null, actualEnd: null });
    expect(calculatePvsAStatus(event)).toBe('waiting');
  });

  it('開始済み・未終了 → in-progress', () => {
    const event = createMockEvent({
      actualStart: '2025-11-16T09:05:00',
      actualEnd: null
    });
    expect(calculatePvsAStatus(event)).toBe('in-progress');
  });

  it('±5分以内 → completed', () => {
    const event = createMockEvent({
      actualStart: '2025-11-16T09:02:00', // +2分
      actualEnd: '2025-11-16T10:03:00'    // +3分
    });
    expect(calculatePvsAStatus(event)).toBe('completed');
  });
});
```

---

## Issue 4: eventContent による PvsA 表示

### 📋 概要
FR-3.3対応：FullCalendar の eventContent をカスタマイズしてPlan vs Actual情報を視覚的に表示

### 🎯 目的
- 計画時刻と実績時刻の並列表示
- ステータス別の色分けとアイコン表示
- 進捗バー（実行中・遅延時）の表示

### 📁 作業ファイル
- `src/pages/IntegratedResourceCalendarPage.tsx` (新規作成)
- `src/features/resources/components/PvsAEventContent.tsx` (新規作成)

### 🔧 実装内容

#### 1. カスタムイベント表示コンポーネント
```typescript
// src/features/resources/components/PvsAEventContent.tsx
export function PvsAEventContent({ event }: { event: EventApi }) {
  const props = event.extendedProps as UnifiedResourceEvent['extendedProps'];
  const { status, actualStart, actualEnd, percentComplete, diffMinutes } = props;

  return (
    <Box className="pvsA-event-content">
      <Typography variant="body2" className="event-title">
        {getStatusIcon(status)} {event.title}
      </Typography>

      <Box className="time-info">
        <Typography variant="caption">
          計画: {formatTime(event.start)} - {formatTime(event.end)}
        </Typography>

        {actualStart && actualEnd && (
          <Typography variant="caption" color="primary">
            実績: {formatTime(actualStart)} - {formatTime(actualEnd)}
          </Typography>
        )}
      </Box>

      {status === 'in-progress' && percentComplete && (
        <LinearProgress
          variant="determinate"
          value={percentComplete}
          size="small"
        />
      )}

      {status === 'delayed' && diffMinutes && (
        <Chip
          label={`+${diffMinutes}分遅延`}
          size="small"
          color="warning"
        />
      )}

      {status === 'completed' && (
        <Chip
          label="完了"
          size="small"
          color="success"
        />
      )}
    </Box>
  );
}
```

#### 2. IntegratedResourceCalendarページ
```typescript
// src/pages/IntegratedResourceCalendarPage.tsx
export function IntegratedResourceCalendarPage() {
  const renderEventContent = (arg: EventContentArg) => (
    <PvsAEventContent event={arg.event} />
  );

  return (
    <FullCalendar
      // ...既存設定...
      eventContent={renderEventContent}
      events={fetchUnifiedEvents}
    />
  );
}
```

### ✅ 完了条件
- [ ] PvsAEventContentコンポーネントが実装済み
- [ ] ステータス別のアイコンと色分けが表示される
- [ ] 計画・実績時刻が適切にフォーマット表示される
- [ ] 進捗バー（in-progress時）が動作する
- [ ] 遅延チップ（delayed時）が表示される
- [ ] レスポンシブ対応（モバイルでも見やすい）

---

## Issue 5: Plan種別・ステータス別色分け

### 📋 概要
FR-2.3, 3.2対応：eventClassNames を使用してPlan種別とPvsAステータスに応じた動的スタイリング

### 🎯 目的
- Plan種別（訪問・移動・休憩等）の視覚的区別
- PvsAステータスによる境界線・背景色の変更
- 管理者が一目で状況を把握できるUI

### 📁 作業ファイル
- `src/features/resources/utils/eventStyling.ts` (新規作成)
- `src/features/resources/styles/eventStyles.css` (新規作成)

### 🔧 実装内容

#### 1. 動的クラス付与関数
```typescript
// src/features/resources/utils/eventStyling.ts
export function getDynamicEventClasses(arg: EventClassNamesArg): string[] {
  const event = arg.event;
  const props = event.extendedProps as UnifiedResourceEvent['extendedProps'];
  const { planType, status } = props;

  const classes = ['unified-event'];

  // Plan種別クラス
  if (planType) {
    classes.push(`event-type-${planType}`);
  }

  // PvsAステータスクラス
  if (status) {
    classes.push(`event-status-${status}`);
  }

  return classes;
}
```

#### 2. CSS スタイル定義
```css
/* src/features/resources/styles/eventStyles.css */
.unified-event {
  border-radius: 4px;
  padding: 2px 4px;
  font-size: 11px;
}

/* Plan種別スタイル */
.event-type-visit {
  background-color: #e3f2fd; /* 薄青 */
  border-left: 4px solid #1976d2;
}

.event-type-travel {
  background-color: #f3e5f5; /* 薄紫 */
  border-left: 4px solid #7b1fa2;
}

.event-type-break {
  background-color: #e8f5e8; /* 薄緑 */
  border-left: 4px solid #388e3c;
}

/* PvsAステータススタイル */
.event-status-waiting {
  opacity: 0.7;
}

.event-status-in-progress {
  border: 2px solid #1976d2;
  animation: pulse 2s infinite;
}

.event-status-completed {
  border: 2px solid #4caf50;
}

.event-status-delayed {
  border: 2px solid #ff9800;
  background-color: #fff3e0;
}

.event-status-cancelled {
  background-color: #ffebee;
  opacity: 0.5;
  text-decoration: line-through;
}

@keyframes pulse {
  0% { border-color: #1976d2; }
  50% { border-color: #42a5f5; }
  100% { border-color: #1976d2; }
}
```

### ✅ 完了条件
- [ ] `getDynamicEventClasses` でクラスが適切に付与される
- [ ] Plan種別別の色分けが表示される
- [ ] PvsAステータス別の境界線・効果が適用される
- [ ] in-progress時のpulse アニメーションが動作する
- [ ] cancelled時の打ち消し線が表示される

---

## Issue 6: 実績入りイベントの編集制御

### 📋 概要
FR-2.2, 3.1対応：実績データが入力されているPlanの編集を禁止し、UIで明確に示す

### 🎯 目的
- データ整合性の保護（実績ありPlanの不正変更防止）
- ユーザビリティ（編集不可理由の明確な表示）
- 将来の権限制御への拡張性

### 📁 作業ファイル
- `src/features/resources/utils/eventValidation.ts` (新規作成)

### 🔧 実装内容

#### 1. 編集許可制御
```typescript
// src/features/resources/utils/eventValidation.ts
export const createEventAllowFunc = (): EventAllowFunc => {
  return (dropInfo, draggedEvent) => {
    const props = draggedEvent?.extendedProps as UnifiedResourceEvent['extendedProps'];

    // 実績が入っているPlanは移動・リサイズ禁止
    if (props?.actualStart || props?.actualEnd) {
      // ユーザーに理由を表示
      showSnackbar('実績が入力済みの予定は編集できません', 'warning');
      return false;
    }

    return true;
  };
};
```

#### 2. FullCalendar設定
```typescript
// IntegratedResourceCalendarPage.tsx
export function IntegratedResourceCalendarPage() {
  const eventAllow = createEventAllowFunc();

  return (
    <FullCalendar
      editable={true}
      eventAllow={eventAllow}
      // eventMouseEnter で編集不可理由をツールチップ表示
      eventMouseEnter={(info) => {
        const props = info.event.extendedProps;
        if (props.actualStart) {
          // ツールチップで「実績入力済み - 編集不可」表示
        }
      }}
    />
  );
}
```

### ✅ 完了条件
- [ ] `eventAllow` で実績ありPlanのドラッグが禁止される
- [ ] 編集試行時にわかりやすいメッセージが表示される
- [ ] 実績なしPlanは従来通り編集可能
- [ ] マウスホバー時に編集可/不可の理由が表示される

---

## Issue 7: ハイブリッドデータモデル（Pull + Push 更新）

### 📋 概要
FR-3.1対応：初期表示はREST API、リアルタイム更新はWebSocket的な仕組みでPull + Push ハイブリッド更新を実装

### 🎯 目的
- 大量データの効率的な初期表示（期間限定fetch）
- 実績更新の即座反映（Push通知）
- FullCalendar APIを活用した局所更新

### 📁 作業ファイル
- `src/features/resources/hooks/useUnifiedEvents.ts` (新規作成)
- `src/features/resources/api/unifiedEventsApi.ts` (新規作成)

### 🔧 実装内容

#### 1. Pull（期間取得）API
```typescript
// src/features/resources/api/unifiedEventsApi.ts
export async function fetchUnifiedEvents(
  fetchInfo: { startStr: string; endStr: string; }
): Promise<UnifiedResourceEvent[]> {
  const response = await fetch(
    `/api/events/unified?start=${fetchInfo.startStr}&end=${fetchInfo.endStr}`
  );
  const events = await response.json();

  // PvsA情報を計算して付与
  return events.map(enrichWithPvsA);
}
```

#### 2. Push（リアルタイム更新）フック
```typescript
// src/features/resources/hooks/useUnifiedEvents.ts
export function useUnifiedEvents() {
  const calendarRef = useRef<FullCalendar>(null);

  // WebSocket的なリアルタイム更新
  useEffect(() => {
    const handleActualUpdate = (update: ActualUpdateEvent) => {
      const calendarApi = calendarRef.current?.getApi();
      if (!calendarApi) return;

      const event = calendarApi.getEventById(update.planId);
      if (!event) return;

      // extendedProps のみ更新（再描画は自動）
      event.setExtendedProp('actualStart', update.actualStart);
      event.setExtendedProp('actualEnd', update.actualEnd);
      event.setExtendedProp('status', update.status);
      event.setExtendedProp('diffMinutes', update.diffMinutes);

      // 編集可否も更新
      if (update.actualStart) {
        event.setExtendedProp('editable', false);
      }
    };

    // モック: 5秒後に実績更新イベント発火
    const timer = setTimeout(() => {
      handleActualUpdate({
        planId: 'plan-1',
        actualStart: '2025-11-16T09:05:00',
        actualEnd: null, // 開始のみ
        status: 'in-progress',
        diffMinutes: null
      });
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return { calendarRef, fetchUnifiedEvents };
}
```

### ✅ 完了条件
- [ ] `fetchUnifiedEvents` が期間指定で動作する
- [ ] `useUnifiedEvents` フックが実装済み
- [ ] モックリアルタイム更新（タイマー）が動作する
- [ ] FullCalendar API による局所更新が正常動作
- [ ] 実績更新時にeditableの状態も自動更新される

---

## 📊 Sprint 3 完了条件サマリー

### 必須機能（Must Have）
- [ ] Issue 2: UnifiedResourceEvent型でPlan + Actual統合
- [ ] Issue 3: PvsAステータス計算ロジック
- [ ] Issue 4: カスタムeventContentでPvsA表示
- [ ] Issue 6: 実績ありPlan編集禁止制御

### 追加機能（Should Have）
- [ ] Issue 5: Plan種別・ステータス色分け
- [ ] Issue 7: Pull + Push ハイブリッド更新

### 動作確認項目
1. **基本表示**: 計画・実績が1つのイベントで表示される
2. **ステータス判定**: waiting → in-progress → completed/delayed の流れ
3. **編集制御**: 実績なし=編集可、実績あり=編集不可
4. **色分け**: Plan種別とステータスで視覚的区別
5. **リアルタイム**: 実績更新が即座にカレンダーに反映

---

**次回**: Sprint 4（警告・ビジネスルール）のIssue詳細