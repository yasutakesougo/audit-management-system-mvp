import { afterEach, describe, expect, it, vi } from "vitest";
import type { UseSP } from "@/lib/spClient";
import * as scheduleClient from "@/features/schedule/spClient.schedule";

const createSp = () => {
  const json = vi.fn().mockResolvedValue({ value: [] });
  const spFetch = vi.fn().mockResolvedValue({ json });
  return { client: { spFetch } as unknown as UseSP, spFetch };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getMonthlySchedule", () => {
  it("queries entire calendar month window", async () => {
    const { client, spFetch } = createSp();

    await scheduleClient.getMonthlySchedule(client, { year: 2025, month: 10 });

    expect(spFetch).toHaveBeenCalledTimes(1);
    const [path] = spFetch.mock.calls[0] ?? [];
    expect(typeof path).toBe("string");
    if (typeof path === "string") {
      const decoded = decodeURIComponent(path).replace(/\+/g, " ");
      expect(decoded).toContain("EventDate lt datetime'2025-11-01T00:00:00.000Z'");
      expect(decoded).toContain("EndDate gt datetime'2025-10-01T00:00:00.000Z'");
    }
  });

  it("rejects invalid month values", async () => {
    const { client } = createSp();
    await expect(
      scheduleClient.getMonthlySchedule(client, { year: 2025, month: 0 })
    ).rejects.toThrow("Invalid month value");
  });
});
