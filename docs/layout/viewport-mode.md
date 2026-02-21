# Viewport Mode (Shell Layout Strategy)

This project uses a tokenized viewport strategy in `AppShell`:

- `viewportMode: "fixed"`
- `viewportMode: "adaptive"`

The goal is to make scrolling responsibility and layout behavior explicit.

---

## 1. Modes

### 🔒 fixed (default)

`viewportMode="fixed"`

- Shell height: `height: 100dvh`
- Only `main` scrolls
- Header / Footer remain structurally stable
- Recommended for most application screens

Use for:
- dashboard
- settings
- data management screens
- pages where footer must stay predictable

This is the **standard mode**.

---

### 🌊 adaptive

`viewportMode="adaptive"`

- Shell height: `minHeight: 100dvh`
- Page height can grow naturally
- Prevents visible top gaps caused by nested `100dvh` stacking
- Used where layout stacking causes scroll band issues

Use for:
- schedules
- complex time-grid pages
- pages with sticky sub-headers inside `main`

---

## 2. Route Rule

| Route Type | Mode |
|------------|------|
| schedules/* | adaptive |
| everything else | fixed |

This rule avoids accidental viewport regressions.

---

## 3. Scroll Responsibility Contract

- Body must NOT scroll.
- Shell must NOT scroll.
- Only `main` may scroll.
- Sticky elements must live inside `main`.

If this contract is broken:
- top gray band appears
- footer disappears
- scroll freeze occurs

---

## 4. Anti-Patterns

- ❌ Using `100vh` inside page content
- ❌ Nested `100dvh` containers
- ❌ Allowing body scroll
- ❌ Mixing internal page scroll with shell scroll
- ❌ Reintroducing `lockViewportHeight` at call-site

---

## 5. Deprecated Notice

`lockViewportHeight` is deprecated.

- Do not use in new code.
- Use `viewportMode` instead.
- Removal scheduled after observation period.

---

## 6. Regression Protection

Protected by:

- `tests/e2e/schedule-layout.regression.spec.ts`

Covers:
- schedules/day top gap
- main-only scroll
- 125% equivalent layout stability
