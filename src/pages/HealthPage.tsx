import React from "react";
import { HealthDiagnosisPage } from "../features/diagnostics/health/HealthDiagnosisPage";
import { HealthContext, ListSpec } from "../features/diagnostics/health/types";
import { getRuntimeEnv } from "@/env";

/**
 * ✅ 診断対象リスト（3つのメインリスト + 必須フィールドチェック）
 * 
 * 各リストの必須フィールドは src/sharepoint/fields.ts の定義に基づく
 * - Users_Master: Title, UserID, FullName
 * - Staff_Master: Title, StaffID, FullName  
 * - SupportRecord_Daily: Title, cr013_personId, cr013_date, cr013_reporterId
 */
const listSpecs: ListSpec[] = [
  {
    key: "Users_Master",
    displayName: "Users_Master",
    requiredFields: [
      { internalName: "Title", typeHint: "Text" },
      { internalName: "UserID", typeHint: "Text" },
      { internalName: "FullName", typeHint: "Text" },
    ],
    createItem: { Title: "healthcheck-user", UserID: "user-health-test", FullName: "健康診断テスト用" },
    updateItem: { Title: "healthcheck-user-updated" },
  },
  {
    key: "Staff_Master",
    displayName: "Staff_Master",
    requiredFields: [
      { internalName: "Title", typeHint: "Text" },
      { internalName: "StaffID", typeHint: "Text" },
      { internalName: "FullName", typeHint: "Text" },
    ],
    createItem: { Title: "healthcheck-staff", StaffID: "staff-health-test", FullName: "スタッフ健康診断テスト用" },
    updateItem: { Title: "healthcheck-staff-updated" },
  },
  {
    key: "SupportRecord_Daily",
    displayName: "SupportRecord_Daily",
    requiredFields: [
      { internalName: "Title", typeHint: "Text" },
      { internalName: "cr013_personId", typeHint: "Number" },
      { internalName: "cr013_date", typeHint: "DateTime" },
      { internalName: "cr013_reporterId", typeHint: "Text" },
    ],
    createItem: { 
      Title: "healthcheck-record", 
      cr013_personId: "1",
      cr013_date: new Date().toISOString(),
      cr013_reporterId: "healthcheck"
    },
    updateItem: { Title: "healthcheck-record-updated" },
  },
];

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
