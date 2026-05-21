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

import { HealthReport } from "../../features/diagnostics/health/types";
import latestDecision from "../../sharepoint/latest-decision.json";

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
export function OperationalSignalCard({ report, _loading }: { report: HealthReport | null, _loading: boolean }) {
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
