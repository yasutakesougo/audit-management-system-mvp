import React from "react";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Collapse,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { HealthDiagnosisPage } from "../features/diagnostics/health/HealthDiagnosisPage";
import { HealthContext, ListSpec } from "../features/diagnostics/health/types";
import { useHealthChecks } from "../features/diagnostics/health/useHealthChecks";
import { getRuntimeEnv } from "@/env";
import latestDecision from "../sharepoint/latest-decision.json";

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
import { PLAN_GOAL_CANDIDATES } from "@/sharepoint/fields/planGoalFields";
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
    for (const cands of Object.values(PLAN_GOAL_CANDIDATES) as unknown as readonly string[][]) {
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




function buildListSpecs(): ListSpec[] {
  return SP_LIST_REGISTRY.map((entry) => {
  const effectiveEssentials = DRIFT_ESSENTIALS_BY_KEY[entry.key] ?? (entry.essentialFields || []);
  const essentialSet = new Set(DRIFT_ESSENTIALS_BY_KEY[entry.key] ?? (entry.essentialFields || []));

  // 1. All fields from provisioning (default: optional)
  const driftOverride = DRIFT_CANDIDATES_BY_KEY[entry.key];
  const provisionFields: SpFieldSpec[] = (entry.provisioningFields || []).map((f) => ({
    internalName: f.internalName,
    isEssential: essentialSet.has(f.internalName),
    typeHint: f.type,
    candidates: driftOverride?.[f.internalName] ?? (f.candidates ? [...f.candidates] : undefined),
    isSilent: f.isSilent,
  }));

  // 2. Ensure essentials (ID, etc.) are present
  const essentials = ["Id", "Title", ...essentialSet];
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
    isDeleteOptional: !entry.operations.includes("D"),
  };
  });
}

/**
 * 🎯 Nightly Decision Signal 型定義
 */
export type HealthDecisionSignal = {
  type: 'drift' | 'index' | 'zombie' | 'concurrency'
  severity: 'info' | 'warn' | 'critical'
  listKey?: string
  message: string
  recommendation: string
  affectedItems?: string[]
}

const SEVERITY_ORDER = { critical: 0, warn: 1, info: 2 };

/**
 * 🚀 OperationalSignalCard
 * 「5秒見れば次の一手が分かる」最小UI
 */
function OperationalSignalCard({ report, _loading }: { report: any, _loading: boolean }) {
  const [showInfo, setShowInfo] = React.useState(false);
  const rawSignals = (latestDecision.interpretation?.signals as unknown as HealthDecisionSignal[]) || [];
  
  const today = new Date().toISOString().split('T')[0];
  const isStale = latestDecision.date !== today;
  const isSystemHealthy = report?.overall === 'pass';
  
  // ✅ 以下のいずれかの場合、古い ZOMBIE 項目（入力欠損など）はノイズなので隠す
  // 1. 最新診断が PASS
  // 2. 判定日が今日ではない（＝古い判定における欠損報告は現在の診断で上書きされるため不要）
  const shouldHideZombies = isSystemHealthy || isStale;

  const signals = shouldHideZombies
    ? rawSignals.filter(s => s.type !== 'zombie')
    : rawSignals;

  if (signals.length === 0) return null;

  const sortedSignals = [...signals].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );

  const urgentSignals = sortedSignals.filter((s) => s.severity !== "info");
  const infoSignals = sortedSignals.filter((s) => s.severity === "info");

  const hasCritical = urgentSignals.some(s => s.severity === 'critical');

  return (
    <Paper
      elevation={4}
      sx={{
        p: 2.5,
        borderRadius: 3,
        background: "linear-gradient(135deg, #ffffff 0%, #f0f7ff 100%)",
        border: "1px solid",
        borderColor: hasCritical ? "error.light" : "primary.light",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          width: "6px",
          height: "100%",
          backgroundColor: hasCritical ? "error.main" : "primary.main",
        }
      }}
    >
      <Stack spacing={2.5}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" sx={{ fontWeight: 800, color: "text.primary", display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <span style={{ fontSize: '1.2rem' }}>🎯</span> Nightly Decision Engine
            <Chip 
              size="small" 
              label={`Analyzed: ${latestDecision.date ?? '---'}`} 
              color={isStale ? "default" : "primary"}
              variant={isStale ? "outlined" : "filled"}
              sx={{ 
                ml: 1, 
                height: 22, 
                fontSize: '0.7rem', 
                fontWeight: 600,
                opacity: isStale ? 0.6 : 1
              }} 
            />
            {isStale && (
              <Chip 
                size="small" 
                label="STALE" 
                sx={{ height: 18, fontSize: '0.6rem', fontWeight: 900, ml: 0.5, bgcolor: 'divider' }} 
              />
            )}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
             <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', opacity: isStale ? 0.5 : 1 }}>
               Nightly Status:
             </Typography>
             <Chip 
               label={latestDecision.final?.line ?? 'Unknown'} 
               color={hasCritical ? "error" : "warning"}
               size="small"
               variant={isStale ? "outlined" : "filled"}
               sx={{ fontWeight: 700, fontSize: '0.75rem', opacity: isStale ? 0.6 : 1 }}
             />
          </Box>
        </Stack>
        {isStale && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: -1, display: 'block', fontStyle: 'italic' }}>
            ※ この判定は {latestDecision.date} のものです。現在のシステム状態は下の「環境診断」を参照してください。
          </Typography>
        )}

        {/* 緊急度の高いシグナル (Critical / Warn) */}
        <Stack spacing={1.5}>
          {urgentSignals.map((signal, idx) => (
            <Alert
              key={idx}
              severity={signal.severity === "critical" ? "error" : "warning"}
              icon={signal.severity === "critical" ? <ErrorOutlineIcon fontSize="medium" /> : <WarningAmberIcon fontSize="medium" />}
              sx={{ 
                borderRadius: 2,
                border: '1px solid',
                borderColor: signal.severity === 'critical' ? 'error.light' : 'warning.light',
                boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                "& .MuiAlert-message": { width: '100%' }
              }}
            >
              <AlertTitle sx={{ fontWeight: 700, mb: 0.5 }}>
                {signal.listKey ?? signal.type.toUpperCase()} 
                {signal.listKey && (
                  <Typography component="span" variant="caption" sx={{ opacity: 0.8, ml: 1, fontWeight: 400 }}>
                    [{signal.type.toUpperCase()}]
                  </Typography>
                )}
              </AlertTitle>
              <Stack spacing={1.5}>
                <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.5 }}>
                  {signal.message}
                </Typography>
                
                <Box 
                  sx={{ 
                    p: 1.5, 
                    borderRadius: 1.5, 
                    bgcolor: signal.severity === 'critical' ? 'rgba(211, 47, 47, 0.05)' : 'rgba(237, 108, 2, 0.05)',
                    borderLeft: '4px solid',
                    borderColor: 'inherit',
                  }}
                >
                  <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 800, mb: 0.5, color: 'inherit' }}>
                    💡 次のアクション (Recommendation)
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {signal.recommendation}
                  </Typography>
                </Box>
              </Stack>
            </Alert>
          ))}
          
          {urgentSignals.length === 0 && (
            <Box sx={{ py: 2, textAlign: 'center', opacity: 0.6 }}>
               <Typography variant="body2">⚠️ 緊急の対処が必要なシグナルはありません</Typography>
            </Box>
          )}
        </Stack>

        {/* 認容済みのシグナル (Info) - 折りたたみ表示 */}
        {infoSignals.length > 0 && (
          <Box>
            <Button
              size="small"
              onClick={() => setShowInfo(!showInfo)}
              startIcon={<InfoOutlinedIcon sx={{ fontSize: '1rem' }} />}
              endIcon={<ExpandMoreIcon sx={{ transform: showInfo ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />}
              sx={{ 
                color: "text.secondary", 
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'none',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.03)' }
              }}
            >
              認容済みの差分を表示 ({infoSignals.length} 件)
            </Button>
            <Collapse in={showInfo}>
              <Stack spacing={1} sx={{ mt: 1.5 }}>
                {infoSignals.map((signal, idx) => (
                  <Paper
                    key={idx}
                    variant="outlined"
                    sx={{ 
                      p: 1.25, 
                      bgcolor: 'rgba(0,0,0,0.01)', 
                      borderStyle: 'dashed',
                      borderColor: 'divider',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.03)' }
                    }}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Chip label={signal.type} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.6rem', color: 'text.disabled' }} />
                      <Typography variant="caption" sx={{ fontWeight: 700, minWidth: '100px' }}>
                        {signal.listKey ?? 'General'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {signal.message}
                      </Typography>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Collapse>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}

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
