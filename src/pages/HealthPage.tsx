import React from "react";
import { Box } from "@mui/material";

import { HealthDiagnosisPage } from "../features/diagnostics/health/HealthDiagnosisPage";
import { HealthContext } from "../features/diagnostics/health/types";
import { useHealthChecks } from "../features/diagnostics/health/useHealthChecks";
import { getRuntimeEnv } from "@/env";
import { buildListSpecs } from "./health/driftCandidates";
import { OperationalSignalCard } from "./health/OperationalSignalCard";

export default function HealthPage() {
  const env = getRuntimeEnv() as Record<string, unknown>;
  
  const ctx: HealthContext = {
    env,
    siteUrl:
      String(env.VITE_SP_RESOURCE ?? "") +
      String(env.VITE_SP_SITE_RELATIVE ?? ""),
    listSpecs: buildListSpecs,
    isProductionLike:
      String(env.MODE ?? "").toLowerCase() === "production" ||
      String(env.VITE_APP_ENV ?? "").toLowerCase() === "production",
    autonomyLevel: 'F', // デフォルトは提案ベース（Level F）
  };

  const { report, loading, error, run } = useHealthChecks(ctx);

  return (
    <Box>
      <Box sx={{ p: 2, pb: 0 }}>
        <OperationalSignalCard report={report} _loading={loading} />
      </Box>
      <HealthDiagnosisPage 
        ctx={ctx} 
        report={report}
        loading={loading}
        error={error}
        run={run}
      />
    </Box>
  );
}
