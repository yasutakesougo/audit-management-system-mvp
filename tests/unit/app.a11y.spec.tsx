import AppShell from "@/app/AppShell";
import { routerFutureFlags } from "@/app/routerFuture";
import { FeatureFlagsProvider, featureFlags } from "@/config/featureFlags";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithAppProviders } from "../helpers/renderWithAppProviders";

describe("AppShell accessibility landmarks", () => {
  it("has single <main> landmark", () => {
    renderWithAppProviders(
      <FeatureFlagsProvider value={{ ...featureFlags, schedules: true }}>
        <AppShell>
          <div data-testid="app-shell-children">child content</div>
        </AppShell>
      </FeatureFlagsProvider>,
      {
        future: routerFutureFlags,
      }
    );

    expect(screen.getAllByRole("main")).toHaveLength(1);
  });
});
