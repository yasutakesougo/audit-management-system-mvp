import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, test } from "vitest";

import AppShell from "@/app/AppShell";
import { routerFutureFlags } from "@/app/routerFuture";
import { FeatureFlagsProvider, featureFlags } from "@/config/featureFlags";

// Wrap with MemoryRouter since AppShell renders navigation links using router context.
test("AppShell snapshot", () => {
  const { container } = render(
    <FeatureFlagsProvider value={{ ...featureFlags, schedules: true }}>
      <MemoryRouter future={routerFutureFlags}>
        <AppShell>
          <div data-testid="snapshot-content">content</div>
        </AppShell>
      </MemoryRouter>
    </FeatureFlagsProvider>
  );

  expect(container).toMatchSnapshot();
});
