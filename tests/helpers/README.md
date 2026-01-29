# Test Helpers Guide

Contract testing で使う helper の設計と使い方。

## 📋 Files

- **mockEnv.ts** - AppConfig 定義（`createBaseTestAppConfig`）
- **reset.ts** - afterEach リセット統一（`installTestResets`）
- **mockEnv.disableDevMock.ts** - 既存（引き続き利用可能）

## 🎯 Core Pattern

### Basic Setup (spec側で vi.mock)

spec側で `vi.mock` を直接宣言。helper は config定義のみを提供。

```typescript
import { describe, it, expect, vi } from 'vitest';
import { installTestResets } from '../helpers/reset';

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    skipSharePoint: () => false,
    shouldSkipLogin: () => false,
  };
});

import { createSpClient } from '@/lib/spClient';

describe('spClient', () => {
  installTestResets();

  it('example', () => {
    // test code
  });
});
```

### Custom Config

```typescript
import { createBaseTestAppConfig } from '../helpers/mockEnv';

const config = createBaseTestAppConfig({
  VITE_AUDIT_DEBUG: '1',
  schedulesCacheTtlSec: 60,
});

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    skipSharePoint: () => false,
    shouldSkipLogin: () => false,
    getAppConfig: () => config,
  };
});
```

### With readEnv Mock

```typescript
const config = createBaseTestAppConfig({ /* ... */ });

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    skipSharePoint: () => false,
    shouldSkipLogin: () => false,
    getAppConfig: () => config,
    readEnv: (key: string, fallback = '') => {
      const val = (config as Record<string, any>)[key];
      return val === '' || val === undefined || val === null ? fallback : String(val);
    },
  };
});
```

### Per-Test Config Override

個別テストで config を一時的に上書きしたい場合：

```typescript
import { mergeTestConfig, setTestConfigOverride } from '../helpers/mockEnv';

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    getAppConfig: () => mergeTestConfig(), // ← mergeTestConfig を使う
    skipSharePoint: () => false,
    shouldSkipLogin: () => false,
  };
});

describe('spClient', () => {
  installTestResets(); // ← afterEach で自動的に override がリセットされる

  it('custom retry config only for this test', async () => {
    setTestConfigOverride({
      VITE_SP_RETRY_MAX: '1',
      VITE_SP_RETRY_BASE_MS: '0',
    });
    // ... test code that needs custom config ...
  });

  it('back to default config', async () => {
    // VITE_SP_RETRY_MAX は '3' に戻る
    // ... test code ...
  });
});
```

**重要**: `installTestResets()` を必ず呼ぶこと。afterEach で `resetTestConfigOverride()` が実行される。

## ⚠️ Critical Rules (禁止事項)

### ✅ Do

- ✅ `vi.mock` を対象モジュールの **import より前** に配置
- ✅ `vi.mock` を spec 側で直接宣言（helper に vi.mock を入れない）
- ✅ Module ID を **@/lib/env で統一**（./env, ../env は使わない）
- ✅ `...actual` を使って partial mock にする（undefined 事故を防ぐ）

### ❌ Don't

- ❌ helper の中で `vi.mock()` を実行しない（hoist の罠）
- ❌ 相対パス `./env` or `../env` を使う（module ID 分裂）
- ❌ actual を spread しない（不足キーが undefined になる）
- ❌ vi.mock を import 後に配置（module が先に eval される）

## 🔄 Import Order (絶対ルール)

```typescript
// ❌ WRONG
import { createSpClient } from '@/lib/spClient'; // ← 先に import

vi.mock('@/lib/env', ...); // ← 後から mock
```

```typescript
// ✅ CORRECT
vi.mock('@/lib/env', ...); // ← 先に mock

import { createSpClient } from '@/lib/spClient'; // ← 後に import
```

## 📝 Checklist

新しい spec を書く時：

- [ ] `vi.mock('@/lib/env', async () => { ... })` を最上部に
- [ ] 対象モジュールの import を vi.mock の **後** に
- [ ] `installTestResets()` を describe 直下に
- [ ] config 値が必要なら `createBaseTestAppConfig({ ... })`
- [ ] readEnv を mock したい場合は返却時に関数を追加
- [ ] ESLint: 相対 env import があったら lint が引っかかる

## 🚀 Benefits

- **再発防止**: import 順を固定、module ID を統一
- **簡潔**: spec は「mock 1行 + import + helper呼び出し」で完結
- **保守性**: config 定義が helper に集中
- **安全性**: actual を spread → 不足キーがない

