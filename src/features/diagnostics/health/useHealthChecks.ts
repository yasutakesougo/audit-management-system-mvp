import { useEffect, useMemo, useState } from "react";
import { HealthContext, HealthReport, HealthStatus, HealthCheckResult } from "./types";
import { createSpAdapterWithAuth } from "./spAdapter";
import { runHealthChecks } from "./checks";
import { useAuth } from "../../../auth/useAuth";

const statusRank: Record<HealthStatus, number> = { pass: 0, warn: 1, fail: 2 };
const worst = (a: HealthStatus, b: HealthStatus): HealthStatus =>
  statusRank[a] >= statusRank[b] ? a : b;

function summarize(results: HealthCheckResult[]): HealthReport {
  const counts = { pass: 0, warn: 0, fail: 0 } as Record<HealthStatus, number>;
  const byCategory: HealthReport["byCategory"] = {
    config: { overall: "pass", counts: { pass: 0, warn: 0, fail: 0 } },
    auth: { overall: "pass", counts: { pass: 0, warn: 0, fail: 0 } },
    connectivity: { overall: "pass", counts: { pass: 0, warn: 0, fail: 0 } },
    lists: { overall: "pass", counts: { pass: 0, warn: 0, fail: 0 } },
    schema: { overall: "pass", counts: { pass: 0, warn: 0, fail: 0 } },
    permissions: { overall: "pass", counts: { pass: 0, warn: 0, fail: 0 } },
  };

  let overall: HealthStatus = "pass";
  for (const r of results) {
    counts[r.status]++;
    byCategory[r.category].counts[r.status]++;
    byCategory[r.category].overall = worst(
      byCategory[r.category].overall,
      r.status
    );
    overall = worst(overall, r.status);
  }

  return {
    generatedAt: new Date().toISOString(),
    overall,
    counts,
    byCategory,
    results,
  };
}

export function useHealthChecks(ctx: HealthContext) {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { acquireToken } = useAuth();
  const sp = useMemo(() => createSpAdapterWithAuth(acquireToken), [acquireToken]);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await runHealthChecks(ctx, sp);
      setReport(summarize(results));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    run();
  }, []);

  return { report, loading, error, run };
}
