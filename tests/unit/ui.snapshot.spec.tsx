import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, test, vi } from "vitest";

import AppShell from "@/app/AppShell";
import { routerFutureFlags } from "@/app/routerFuture";
import { FeatureFlagsProvider, featureFlags } from "@/config/featureFlags";

vi.mock("@/lib/spClient", () => ({
  useSP: () => ({
    spFetch: vi.fn(() => Promise.resolve({ ok: true })),
  }),
}));

// Wrap with MemoryRouter since AppShell renders navigation links using router context.
test("AppShell snapshot", async () => {
  const { container } = render(
    <FeatureFlagsProvider value={{ ...featureFlags, schedules: true }}>
      <MemoryRouter future={routerFutureFlags}>
        <AppShell>
          <div data-testid="snapshot-content">content</div>
        </AppShell>
      </MemoryRouter>
    </FeatureFlagsProvider>
  );

  await waitFor(() => {
    expect(screen.getByRole("status")).toHaveTextContent("SP Connected");
  });

  expect(container).toMatchSnapshot();
});
