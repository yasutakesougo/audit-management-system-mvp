# CI Stabilization & Testing Best Practices

This document outlines the testing architecture and stabilization patterns used in this project to ensure a deterministic and resilient CI.

## 🛠️ Hybrid Isolation Model

To balance test performance with dependency requirements (especially for modules that evaluate browser APIs at import time), we use a **Hybrid Isolation** model in `vitest.setup.ts`.

### 1. Persistent Stubs (Module Level)
- **Problem**: Some modules or hooks (like `AppShell` or `settingsModel`) access `localStorage` or `matchMedia` during evaluation (when the file is loaded).
- **Solution**: We stub these APIs at the module level using `vi.stubGlobal`.
- **Constraint**: DO NOT use `vi.unstubAllGlobals()` in `afterEach`. This will break subsequent tests that lazy-load or import modules depending on these globals.

### 2. Per-Test Data Clearance (Lifecycle Hooks)
- While the *stubs* are persistent, the **data** within them is not.
- Use `beforeEach` to clear mock storage:
  ```typescript
  beforeEach(() => {
    mockLS.clear(); // Clear data, keep the stub
    vi.clearAllMocks(); // Clear call history
  });
  ```

## 🏗️ Structural Locks

### Node.js Version
- CI worksflows are pinned to **Node 20**.
- Local development should ideally align with this version.

### Line Endings (LF)
- Netlify specifically requires LF line endings for the `_headers` file.
- We enforce this via `.gitattributes`:
  ```gitattributes
  public/_headers text eol=lf
  ```

## 🚀 Flake Mitigation Patterns

### 1. Robust Timeouts
- For heavy UI tests (smoke tests), use an arrival timeout:
  ```typescript
  const arrivalOptions = { timeout: process.env.CI ? 30_000 : 15_000 };
  await screen.findByTestId('key', undefined, arrivalOptions);
  ```

### 2. Async Flush
- Ensure microtasks are flushed before assertions if you use complex state management or navigation:
  ```typescript
  await Promise.resolve();
  ```

### 3. Environment Isolation
- Always reset the environment schema cache between tests if you manipulate `process.env`.
- Use the provided `resetParsedEnvForTests()` helper in `vitest.setup.ts`.
