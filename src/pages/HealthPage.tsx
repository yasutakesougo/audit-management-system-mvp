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
import {
  DAILY_RECORD_CANONICAL_CANDIDATES,
  DAILY_RECORD_ROW_AGGREGATE_CANDIDATES,
  DAILY_ACTIVITY_RECORDS_CANDIDATES,
} from "@/sharepoint/fields/dailyFields";
import { ACTIVITY_DIARY_CANDIDATES } from "@/sharepoint/fields/activityDiaryFields";
import {
  USERS_MASTER_CANDIDATES,
  USER_BENEFIT_PROFILE_CANDIDATES,
  USER_BENEFIT_PROFILE_EXT_CANDIDATES,
} from "@/sharepoint/fields/userFields";
import { STAFF_MASTER_CANDIDATES as STAFF_CANDIDATES_ORIGINAL } from "@/sharepoint/fields/staffFields";
import {
  MONITORING_MEETING_CANDIDATES,
  MONITORING_MEETING_ESSENTIALS,
} from "@/sharepoint/fields/monitoringMeetingFields";
import { SERVICE_PROVISION_CANDIDATES } from "@/sharepoint/fields/serviceProvisionFields";
import {
  ATTENDANCE_CANDIDATES,
  ATTENDANCE_ESSENTIALS,
  STAFF_ATTENDANCE_CANDIDATES,
  ATTENDANCE_USERS_CANDIDATES,
  ATTENDANCE_DAILY_CANDIDATES,
} from "@/sharepoint/fields/attendanceFields";
import { PROCEDURE_RECORD_CANDIDATES, ISP_MASTER_CANDIDATES } from "@/sharepoint/fields/ispThreeLayerFields";
import {
  TRANSPORT_LOG_CANDIDATES,
  TRANSPORT_SETTING_CANDIDATES,
} from "@/sharepoint/fields/transportFields";
import { BILLING_SUMMARY_CANDIDATES } from "@/sharepoint/fields/billingFields";
import { SURVEY_TOKUSEI_CANDIDATES } from "@/sharepoint/fields/surveyTokuseiFields";
import { PLAN_GOALS_CANDIDATES } from "@/sharepoint/fields/planGoalFields";
import { SCHEDULE_EVENTS_CANDIDATES } from "@/sharepoint/fields/scheduleFields";
import { SUPPORT_PLANS_CANDIDATES } from "@/sharepoint/fields/supportPlanFields";
import { MEETING_MINUTES_CANDIDATES } from "@/sharepoint/fields/meetingMinutesFields";
import { HANDOFF_CANDIDATES } from "@/sharepoint/fields/handoffFields";
import { MEETING_SESSIONS_CANDIDATES } from "@/sharepoint/fields/meetingSessionFields";
import { NURSE_OBS_CANDIDATES } from "@/sharepoint/fields/nurseObservationFields";



/**
 * リストキー → フィールド内部名 → drift 候補名[] のオーバーライドマップ
 * provisioningFields の internalName をキーとして、代替内部名を提供する。
 */
const DRIFT_CANDIDATES_BY_KEY: Record<string, Record<string, string[]>> = {
  users_master: (() => {
    const map: Record<string, string[]> = {};
    for (const cands of Object.values(USERS_MASTER_CANDIDATES) as unknown as readonly string[][]) {
      const primary = cands[0];
      map[primary] = [...cands];
    }
    return map;
  })(),

  staff_master: (() => {
    const map: Record<string, string[]> = {};
    for (const cands of Object.values(STAFF_CANDIDATES_ORIGINAL) as unknown as readonly string[][]) {
      const primary = cands[0];
      map[primary] = [...cands];
    }
    return map;
  })(),

  monitoring_meetings: (() => {
    const map: Record<string, string[]> = {};
    for (const cands of Object.values(MONITORING_MEETING_CANDIDATES) as unknown as readonly string[][]) {
      const primary = cands[0];
      map[primary] = [...cands];
    }
    return map;
  })(),

  support_record_daily: (() => {
    const map: Record<string, string[]> = {};
    for (const cands of Object.values(DAILY_RECORD_CANONICAL_CANDIDATES) as unknown as string[][]) {
      const primary = cands[0];
      map[primary] = [...cands];
    }
    for (const cands of Object.values(DAILY_RECORD_ROW_AGGREGATE_CANDIDATES) as unknown as string[][]) {
      const primary = cands[0];
      if (!map[primary]) {
        map[primary] = [...cands];
      }
    }
    return map;
  })(),

  activity_diary: (() => {
    const map: Record<string, string[]> = {};
    for (const cands of Object.values(ACTIVITY_DIARY_CANDIDATES) as unknown as readonly string[][]) {
      const primary = cands[0];
      map[primary] = [...cands];
    }
    return map;
  })(),

  service_provision_records: (() => {
    const map: Record<string, string[]> = {};
    for (const cands of Object.values(SERVICE_PROVISION_CANDIDATES) as unknown as readonly string[][]) {
      const primary = cands[0];
      map[primary] = [...cands];
    }
    return map;
  })(),

  staff_attendance: (() => {
    const map: Record<string, string[]> = {};
    for (const cands of Object.values(STAFF_ATTENDANCE_CANDIDATES) as unknown as readonly string[][]) {
      const primary = cands[0];
      map[primary] = [...cands];
    }
    return map;
  })(),

  attendance_users: (() => {
    const map: Record<string, string[]> = {};
    for (const cands of Object.values(ATTENDANCE_USERS_CANDIDATES) as unknown as readonly string[][]) {
      const primary = cands[0];
      map[primary] = [...cands];
    }
    return map;
  })(),

  attendance_daily: (() => {
    const map: Record<string, string[]> = {};
    for (const cands of Object.values(ATTENDANCE_DAILY_CANDIDATES) as unknown as readonly string[][]) {
      const primary = cands[0];
      map[primary] = [...cands];
    }
    return map;
  })(),

  support_procedure_record_daily: (() => {
    const map: Record<string, string[]> = {};
    for (const cands of Object.values(PROCEDURE_RECORD_CANDIDATES) as unknown as readonly string[][]) {
      const primary = cands[0];
      map[primary] = [...cands];
    }
    return map;
  })(),

  support_record_rows: (() => {
    const map: Record<string, string[]> = {};
    for (const cands of Object.values(DAILY_RECORD_ROW_AGGREGATE_CANDIDATES) as unknown as readonly string[][]) {
      const primary = cands[0];
      map[primary] = [...cands];
    }
    return map;
  })(),
  
  transport_log: (() => {
    const map: Record<string, string[]> = {};
    for (const cands of Object.values(TRANSPORT_LOG_CANDIDATES) as unknown as readonly string[][]) {
      const primary = cands[0];
      map[primary] = [...cands];
    }
    return map;
  })(),

  user_transport_settings: (() => {
    const map: Record<string, string[]> = {};
    for (const cands of Object.values(TRANSPORT_SETTING_CANDIDATES) as unknown as readonly string[][]) {
      const primary = cands[0];
      map[primary] = [...cands];
    }
    return map;
  })(),

  billing_summary: (() => {
    const map: Record<string, string[]> = {};
    for (const cands of Object.values(BILLING_SUMMARY_CANDIDATES) as unknown as readonly string[][]) {
      const primary = cands[0];
      map[primary] = [...cands];
    }
    return map;
  })(),

  survey_tokusei: (() => {
    const map: Record<string, string[]> = {};
    for (const cands of Object.values(SURVEY_TOKUSEI_CANDIDATES) as unknown as readonly string[][]) {
      const primary = cands[0];
      map[primary] = [...cands];
    }
    return map;
  })(),
  
  plan_goals: (() => {
    const map: Record<string, string[]> = {};
    for (const cands of Object.values(PLAN_GOALS_CANDIDATES) as unknown as readonly string[][]) {
      const primary = cands[0];
      map[primary] = [...cands];
    }
    return map;
  })(),

  user_benefit_profile: (() => {
    const map: Record<string, string[]> = {};
    for (const cands of Object.values(USER_BENEFIT_PROFILE_CANDIDATES) as unknown as readonly string[][]) {
      const primary = cands[0];
      map[primary] = [...cands];
    }
    return map;
  })(),

  user_benefit_profile_ext: (() => {
    const map: Record<string, string[]> = {};
    for (const cands of Object.values(USER_BENEFIT_PROFILE_EXT_CANDIDATES) as unknown as readonly string[][]) {
      const primary = cands[0];
      map[primary] = [...cands];
    }
    return map;
  })(),

  daily_attendance: (() => {
    const map: Record<string, string[]> = {};
    for (const cands of Object.values(ATTENDANCE_CANDIDATES) as unknown as readonly string[][]) {
      const primary = cands[0];
      map[primary] = [...cands];
    }
    return map;
  })(),

  schedule_events: (() => {
    const map: Record<string, string[]> = {};
    for (const cands of Object.values(SCHEDULE_EVENTS_CANDIDATES) as unknown as readonly string[][]) {
      const primary = cands[0];
      map[primary] = [...cands];
    }
    return map;
  })(),

  support_plans: (() => {
    const map: Record<string, string[]> = {};
    for (const cands of Object.values(SUPPORT_PLANS_CANDIDATES) as unknown as readonly string[][]) {
      const primary = cands[0];
      map[primary] = [...cands];
    }
    return map;
  })(),

  daily_activity_records: (() => {
    const map: Record<string, string[]> = {};
    for (const cands of Object.values(DAILY_ACTIVITY_RECORDS_CANDIDATES) as unknown as readonly string[][]) {
      const primary = cands[0];
      map[primary] = [...cands];
    }
    return map;
  })(),

  isp_master: (() => {
    const map: Record<string, string[]> = {};
    for (const cands of Object.values(ISP_MASTER_CANDIDATES) as unknown as readonly string[][]) {
      const primary = cands[0];
      map[primary] = [...cands];
    }
    return map;
  })(),

  meeting_minutes: (() => {
    const map: Record<string, string[]> = {};
    for (const cands of Object.values(MEETING_MINUTES_CANDIDATES) as unknown as readonly string[][]) {
      const primary = cands[0];
      map[primary] = [...cands];
    }
    return map;
  })(),

  handoff: (() => {
    const map: Record<string, string[]> = {};
    for (const cands of Object.values(HANDOFF_CANDIDATES) as unknown as readonly string[][]) {
      const primary = cands[0];
      map[primary] = [...cands];
    }
    return map;
  })(),

  meeting_sessions: (() => {
    const map: Record<string, string[]> = {};
    for (const cands of Object.values(MEETING_SESSIONS_CANDIDATES) as unknown as readonly string[][]) {
      const primary = cands[0];
      map[primary] = [...cands];
    }
    return map;
  })(),

  nurse_observations: (() => {
    const map: Record<string, string[]> = {};
    for (const cands of Object.values(NURSE_OBS_CANDIDATES) as unknown as readonly string[][]) {
      const primary = cands[0];
      map[primary] = [...cands];
    }
    return map;
  })(),
};

const DRIFT_ESSENTIALS_BY_KEY: Record<string, readonly string[]> = {
  monitoring_meetings: MONITORING_MEETING_ESSENTIALS.map(
    (key) => MONITORING_MEETING_CANDIDATES[key][0],
  ),
  daily_attendance: ATTENDANCE_ESSENTIALS.map(
    (key) => ATTENDANCE_CANDIDATES[key][0],
  ),
};




const listSpecs: ListSpec[] = SP_LIST_REGISTRY.map((entry) => {
  const effectiveEssentials = DRIFT_ESSENTIALS_BY_KEY[entry.key] ?? (entry.essentialFields || []);

  // 1. All fields from provisioning (default: optional)
  const driftOverride = DRIFT_CANDIDATES_BY_KEY[entry.key];
  const provisionFields: SpFieldSpec[] = (entry.provisioningFields || []).map((f) => ({
    internalName: f.internalName,
    isEssential: effectiveEssentials.includes(f.internalName),
    typeHint: f.type,
    candidates: driftOverride?.[f.internalName],
  }));

  // 2. Ensure essentials (ID, etc.) are present
  const essentials = ["Id", "Title", ...effectiveEssentials];
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
        candidates: name.toLowerCase() === 'id' ? ['ID', 'Id'] : [name],
      });
    } else if (
      effectiveEssentials.some(
        (e) => e.toLowerCase() === existing.internalName.toLowerCase()
      ) ||
      name.toLowerCase() === "id"
    ) {
      existing.isEssential = true;
      if (name.toLowerCase() === 'id' && !existing.candidates) {
        existing.candidates = ['ID', 'Id'];
      }
    }
  }

  const stamp = Date.now().toString();
  const uuidSuffix =
    globalThis.crypto?.randomUUID?.().slice(0, 8) ??
    Math.random().toString(36).slice(2, 10);
  const uniqueId = `hc-${stamp}-${uuidSuffix}`;

  const createItem: Record<string, unknown> = { Title: `healthcheck-root-${uniqueId}` };
  if (entry.key === "users_master") {
    createItem["UserID"] = `user-${uniqueId}`;
    createItem["FullName"] = "健康診断テスト用";
  } else if (entry.key === "staff_master") {
    createItem["StaffID"] = `staff-${uniqueId}`;
    createItem["StaffName"] = "健康診断テスト用";
  } else if (entry.key === "user_transport_settings" || entry.key === "user_benefit_profile" || entry.key === "user_benefit_profile_ext") {
    createItem["UserID"] = `user-${uniqueId}`;
  } else if (entry.key === "monitoring_meetings") {
    createItem["cr014_recordId"] = `rec-health-${uniqueId}`;
    createItem["cr014_userId"] = `user-health-${uniqueId}`;
    createItem["cr014_meetingDate"] = new Date().toISOString();
    createItem["cr014_status"] = "draft";
  }

  return {
    key: entry.key,
    displayName: entry.displayName,
    resolvedTitle: entry.resolve(),
    requiredFields: combined,
    createItem,
    updateItem: { Title: `healthcheck-updated-${uniqueId}` },
    isReadOnly: !entry.operations.includes("W"),
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
    autonomyLevel: 'F', // デフォルトは提案ベース（Level F）
  };

  return <HealthDiagnosisPage ctx={ctx} />;
}
