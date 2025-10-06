import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, test } from "vitest";

import AppShell from "@/app/AppShell";

// Wrap with MemoryRouter since AppShell renders navigation links using router context.
test("AppShell snapshot", () => {
  const { container } = render(
    <MemoryRouter>
      <AppShell>
        <div data-testid="snapshot-content">content</div>
      </AppShell>
    </MemoryRouter>
  );

  expect(container).toMatchSnapshot();
});
