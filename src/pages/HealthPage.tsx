import React from "react";
import { HealthDiagnosisPage } from "../features/diagnostics/health/HealthDiagnosisPage";
import { HealthContext, ListSpec } from "../features/diagnostics/health/types";
import { getRuntimeEnv } from "@/env";

/**
 * ✅ 診断対象リスト（SSOT から自動生成）
 * 
 * 運用に必要な全リストを対象とし、必須フィールドは registry の essentialFields を使用する。
 */
import { SP_LIST_REGISTRY } from "@/sharepoint/spListRegistry";
import { SpFieldSpec } from "../features/diagnostics/health/types";

const listSpecs: ListSpec[] = SP_LIST_REGISTRY.map((entry) => {
  // 1. All fields from provisioning (default: optional)
  const provisionFields: SpFieldSpec[] = (entry.provisioningFields || []).map((f) => ({
    internalName: f.internalName,
    isEssential: (entry.essentialFields || []).includes(f.internalName),
    typeHint: f.type,
  }));

  // 2. Ensure essentials (ID, etc.) are present
  const essentials = ["Id", "Title", ...(entry.essentialFields || [])];
  const combined: SpFieldSpec[] = [...provisionFields];

  for (const name of essentials) {
    const existing = combined.find(
      (f) => f.internalName.toLowerCase() === name.toLowerCase()
    );
    if (!existing) {
      combined.push({
        internalName: name,
        isEssential: true,
        typeHint: "Core",
      });
    } else if (
      (entry.essentialFields || []).some(
        (e) => e.toLowerCase() === existing.internalName.toLowerCase()
      ) ||
      name.toLowerCase() === "id"
    ) {
      existing.isEssential = true;
    }
  }

  return {
    key: entry.key,
    displayName: entry.displayName,
    resolvedTitle: entry.resolve(),
    requiredFields: combined,
    createItem:
      entry.key === "users_master"
        ? {
            Title: "healthcheck-user",
            UserID: "user-health-test",
            FullName: "健康診断テスト用",
          }
        : entry.key === "staff_master"
        ? {
            Title: "healthcheck-staff",
            StaffID: "staff-health-test",
            StaffName: "健康診断テスト用",
          }
        : { Title: "healthcheck-root" },
    updateItem: { Title: "healthcheck-updated" },
  };
});

export default function HealthPage() {
  const env = getRuntimeEnv() as Record<string, unknown>;
  
  const ctx: HealthContext = {
    env,
    siteUrl:
      String(env.VITE_SP_RESOURCE ?? "") +
      String(env.VITE_SP_SITE_RELATIVE ?? ""),
    listSpecs,
    isProductionLike:
      String(env.MODE ?? "").toLowerCase() === "production" ||
      String(env.VITE_APP_ENV ?? "").toLowerCase() === "production",
  };

  return <HealthDiagnosisPage ctx={ctx} />;
}
