import { screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import AppShell from "@/app/AppShell";
import { routerFutureFlags } from "@/app/routerFuture";
import { FeatureFlagsProvider, featureFlags } from "@/config/featureFlags";
import { renderWithAppProviders } from "../helpers/renderWithAppProviders";

vi.mock("@/lib/spClient", () => ({
  useSP: () => ({
    spFetch: vi.fn(() => Promise.resolve({ ok: true })),
  }),
}));

// Wrap with MemoryRouter since AppShell renders navigation links using router context.
test("AppShell snapshot", async () => {
  const { container } = renderWithAppProviders(
    <FeatureFlagsProvider value={{ ...featureFlags, schedules: true }}>
      <AppShell>
        <div data-testid="snapshot-content">content</div>
      </AppShell>
    </FeatureFlagsProvider>,
    { future: routerFutureFlags }
  );

  await waitFor(() => {
    const statuses = screen.getAllByRole("status");
    expect(statuses.some((status) => status.textContent?.includes("SP Connected"))).toBe(true);
  });

  expect(container).toMatchSnapshot();
});
