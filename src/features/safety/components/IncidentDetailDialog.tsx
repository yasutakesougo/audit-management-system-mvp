// ---------------------------------------------------------------------------
// IncidentDetailDialog — インシデント詳細ダイアログ（read-only）
//
// IncidentHistoryList の行クリックで開き、1件の全フィールドを表示する。
// 編集機能は持たず、閲覧のみ。
// ---------------------------------------------------------------------------
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { RiskSeverity } from '@/domain/support/highRiskIncident';
import type { IncidentRecord, IncidentType } from '@/domain/support/incidentRepository';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEVERITY_COLORS: Record<RiskSeverity, 'default' | 'info' | 'warning' | 'error'> = {
  '低': 'default',
  '中': 'info',
  '高': 'warning',
  '重大インシデント': 'error',
};

const SEVERITY_ICONS: Record<RiskSeverity, React.ReactNode> = {
  '低': null,
  '中': <ErrorOutlineIcon fontSize="small" />,
  '高': <WarningAmberIcon fontSize="small" />,
  '重大インシデント': <ReportProblemIcon fontSize="small" />,
};

const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  behavior: '行動',
  injury: '負傷',
  property: '物品破損',
  elopement: '離設',
  other: 'その他',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type IncidentDetailDialogProps = {
  open: boolean;
  incident: IncidentRecord | null;
  onClose: () => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** ラベル+値のペアを表示する行 */
function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Typography
        variant="caption"
        color="text.secondary"
        fontWeight={600}
        sx={{ mb: 0.25, display: 'block' }}
      >
        {label}
      </Typography>
      <Box sx={{ pl: 0.5 }}>{children}</Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function IncidentDetailDialog({
  open,
  incident,
  onClose,
}: IncidentDetailDialogProps) {
  if (!incident) return null;

  const occurredDate = new Date(incident.occurredAt);
  const reportedDate = new Date(incident.reportedAt);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderTop: '4px solid',
          borderTopColor: `${SEVERITY_COLORS[incident.severity]}.main`,
        },
      }}
    >
      {/* ── Title ──────────────────────────────── */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" fontWeight={700}>
            インシデント詳細
          </Typography>
          <Chip
            size="small"
            icon={SEVERITY_ICONS[incident.severity] as React.ReactElement | undefined}
            label={incident.severity}
            color={SEVERITY_COLORS[incident.severity]}
            variant={incident.severity === '重大インシデント' ? 'filled' : 'outlined'}
          />
        </Stack>
        <IconButton
          aria-label="閉じる"
          onClick={onClose}
          size="small"
          edge="end"
        >
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      {/* ── Content ────────────────────────────── */}
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={2}>
          {/* 1. 発生日時 */}
          <DetailRow label="発生日時">
            <Typography variant="body2">
              {occurredDate.toLocaleString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Typography>
          </DetailRow>

          {/* 2. 重症度 — ヘッダーの Chip で表示済み、ここでは省略 */}

          {/* 3. 種別 */}
          <DetailRow label="種別">
            <Typography variant="body2">
              {INCIDENT_TYPE_LABELS[incident.incidentType] ?? incident.incidentType}
            </Typography>
          </DetailRow>

          {/* 4. 概要 */}
          <DetailRow label="概要">
            <Typography
              variant="body2"
              sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
              {incident.description || '—'}
            </Typography>
          </DetailRow>

          {/* 5. 即時対応 */}
          {incident.immediateResponse && (
            <DetailRow label="即時対応">
              <Typography
                variant="body2"
                sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              >
                {incident.immediateResponse}
              </Typography>
            </DetailRow>
          )}

          {/* 6. 報告者・報告日時 */}
          <Stack direction="row" spacing={3}>
            <DetailRow label="報告者">
              <Typography variant="body2">{incident.reportedBy}</Typography>
            </DetailRow>
            <DetailRow label="報告日時">
              <Typography variant="body2">
                {reportedDate.toLocaleString('ja-JP', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Typography>
            </DetailRow>
          </Stack>

          {/* 7. 関係者 */}
          {incident.relatedStaff.length > 0 && (
            <DetailRow label="関係者">
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {incident.relatedStaff.map((staff) => (
                  <Chip key={staff} label={staff} size="small" variant="outlined" />
                ))}
              </Stack>
            </DetailRow>
          )}

          {/* 8. 結果・転帰 */}
          {incident.outcome && (
            <DetailRow label="結果・転帰">
              <Typography
                variant="body2"
                sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              >
                {incident.outcome}
              </Typography>
            </DetailRow>
          )}

          <Divider />

          {/* 9. F/U 状況 */}
          <DetailRow label="フォローアップ">
            <Stack spacing={0.5}>
              <Chip
                size="small"
                label={incident.followUpRequired ? '要フォローアップ' : 'フォローアップ不要'}
                color={incident.followUpRequired ? 'warning' : 'default'}
                variant="outlined"
              />
              {incident.followUpNotes && (
                <Typography
                  variant="body2"
                  sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', mt: 0.5 }}
                >
                  {incident.followUpNotes}
                </Typography>
              )}
            </Stack>
          </DetailRow>

          {/* 10. メモ */}
          {incident.notes && (
            <DetailRow label="メモ">
              <Typography
                variant="body2"
                sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              >
                {incident.notes}
              </Typography>
            </DetailRow>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
