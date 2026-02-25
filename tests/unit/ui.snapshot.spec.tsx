import { screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { routerFutureFlags } from "@/app/routerFuture";
import { FeatureFlagsProvider, featureFlags } from "@/config/featureFlags";
import { renderWithAppProviders } from "../helpers/renderWithAppProviders";

vi.mock("@/lib/spClient", () => ({
  useSP: () => ({
    spFetch: vi.fn(() => Promise.resolve({ ok: true })),
  }),
}));

vi.mock("@/auth/MsalProvider", () => ({
	useMsalContext: () => ({
		accounts: [],
		instance: {
			getActiveAccount: () => null,
			getAllAccounts: () => [],
			acquireTokenSilent: vi.fn(() => Promise.resolve({ accessToken: 'mock-token' })),
		},
		inProgress: 'none',
	}),
}));

vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  const falseyKeys = new Set([
    "VITE_SKIP_SHAREPOINT",
    "VITE_FORCE_SHAREPOINT",
    "VITE_FEATURE_SCHEDULES_SP",
    "VITE_SKIP_LOGIN",
    "VITE_FORCE_DEMO",
    "VITE_DEMO_MODE",
    "VITE_E2E_MSAL_MOCK",
  ]);
  return {
    ...actual,
    readBool: (key: string, fallback = false, envOverride?: unknown) => {
      if (falseyKeys.has(key)) return false;
      return actual.readBool(key, fallback, envOverride as any);
    },
    shouldSkipLogin: () => false,
    isE2eMsalMockEnabled: () => false,
  };
});

// Verify AppShell renders correctly with all app providers, router context, and router future flags.
// Note: renderWithAppProviders already includes ToastProvider, so do not wrap UI with it again.
test("AppShell snapshot", async () => {
  const AppShell = (await import("@/app/AppShell")).default;
  renderWithAppProviders(
    <FeatureFlagsProvider value={{ ...featureFlags, schedules: true }}>
      <AppShell>
        <div data-testid="snapshot-content">content</div>
      </AppShell>
    </FeatureFlagsProvider>,
    { future: routerFutureFlags }
  );

  await waitFor(async () => {
    const status = await screen.findByTestId("sp-connection-status");
    expect(status.textContent ?? "").toMatch(/SP (Connected|Checking|Sign[- ]?In|required)/);
  });

  expect(screen.getByTestId("app-shell")).toBeTruthy();
  expect(screen.getByTestId("snapshot-content")).toHaveTextContent("content");
  expect(
    screen.getByRole("button", { name: /ナビゲーションを(開く|閉じる)|メニューを開く/i })
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "表示設定" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "テーマ切り替え" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "監査ログ" })).toBeTruthy();
});
