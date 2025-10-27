import { render, screen, waitFor } from "@testing-library/react";
import { Outlet, RouterProvider, createMemoryRouter } from "react-router-dom";
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
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <FeatureFlagsProvider value={{ ...featureFlags, schedules: true }}>
            <AppShell>
              <Outlet />
            </AppShell>
          </FeatureFlagsProvider>
        ),
        children: [
          {
            index: true,
            element: <div data-testid="snapshot-content">content</div>,
          },
        ],
      },
    ],
    { initialEntries: ["/"], future: routerFutureFlags }
  );

  const { container } = render(<RouterProvider router={router} />);

  await waitFor(() => {
    expect(screen.getByRole("status")).toHaveTextContent("SP Connected");
  });

  expect(container).toMatchSnapshot();
});
