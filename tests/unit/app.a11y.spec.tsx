import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppShell from "@/app/AppShell";
import { FeatureFlagsProvider, featureFlags } from "@/config/featureFlags";
import { routerFutureFlags } from "@/app/routerFuture";

describe("AppShell accessibility landmarks", () => {
  it("has single <main> landmark", () => {
    render(
      <FeatureFlagsProvider value={{ ...featureFlags, schedules: true }}>
        <MemoryRouter future={routerFutureFlags}>
          <AppShell>
            <div data-testid="app-shell-children">child content</div>
          </AppShell>
        </MemoryRouter>
      </FeatureFlagsProvider>
    );

    expect(screen.getAllByRole("main")).toHaveLength(1);
  });
});
