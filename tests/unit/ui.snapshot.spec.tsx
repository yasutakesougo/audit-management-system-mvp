import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, test } from "vitest";

import AppShell from "@/app/AppShell";
import { routerFutureFlags } from "@/app/routerFuture";

// Wrap with MemoryRouter since AppShell renders navigation links using router context.
test("AppShell snapshot", () => {
  const { container } = render(
  <MemoryRouter future={routerFutureFlags}>
      <AppShell>
        <div data-testid="snapshot-content">content</div>
      </AppShell>
    </MemoryRouter>
  );

  expect(container).toMatchSnapshot();
});
