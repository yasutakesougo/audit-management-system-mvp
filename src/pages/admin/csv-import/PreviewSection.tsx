/**
 * PreviewSection — Step 2 プレビュー表示
 *
 * StatCard, UsersPreviewTable, GenericPreviewTable, バリデーション警告を含む。
 * state を持たず、全て props 経由。
 */
import React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Fade from '@mui/material/Fade';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import type { UnifiedImportPreview } from '@/features/import/hooks/useUnifiedCSVImport';
import type { TargetConfig } from './types';

// ─────────────────────────────────────────────
// StatCard
// ─────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        textAlign: 'center',
        borderRadius: 2,
        borderColor: `${color}30`,
        background: `${color}06`,
      }}
    >
      <Typography variant="h4" fontWeight={800} sx={{ color, letterSpacing: '-0.02em' }}>
        {value.toLocaleString()}
      </Typography>
      <Typography variant="caption" color="text.secondary" fontWeight={600}>
        {label}
      </Typography>
    </Paper>
  );
}

// ─────────────────────────────────────────────
// UsersPreviewTable
// ─────────────────────────────────────────────

function UsersPreviewTable({
  rows,
  maxRows = 10,
}: {
  rows: { UserID: string; FullName: string; AttendanceDays: string[]; IsActive: boolean; IsHighIntensitySupportTarget: boolean }[];
  maxRows?: number;
}) {
  const display = rows.slice(0, maxRows);
  const remaining = rows.length - maxRows;

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
        📋 データプレビュー（先頭 {Math.min(rows.length, maxRows)} 件）
      </Typography>
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ borderRadius: 2, maxHeight: 400 }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover' }}>利用者ID</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover' }}>氏名</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover' }}>通所曜日</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover' }} align="center">状態</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover' }} align="center">強度行動障害</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {display.map((row) => (
              <TableRow key={row.UserID} hover>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                    {row.UserID}
                  </Typography>
                </TableCell>
                <TableCell>{row.FullName}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {row.AttendanceDays.map((day) => (
                      <Chip
                        key={day}
                        label={day}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem', height: 22 }}
                      />
                    ))}
                  </Stack>
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={row.IsActive ? '有効' : '無効'}
                    size="small"
                    color={row.IsActive ? 'success' : 'default'}
                    variant="filled"
                    sx={{ fontSize: '0.7rem' }}
                  />
                </TableCell>
                <TableCell align="center">
                  {row.IsHighIntensitySupportTarget && (
                    <Tooltip title="強度行動障害対象">
                      <Chip
                        label="対象"
                        size="small"
                        color="error"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem' }}
                      />
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {remaining > 0 && (
        <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
          他 {remaining} 件のレコード…
        </Typography>
      )}
    </Box>
  );
}

// ─────────────────────────────────────────────
// GenericPreviewTable (support / care)
// ─────────────────────────────────────────────

function GenericPreviewTable({
  data,
  target,
  maxUsers = 5,
}: {
  data: Map<string, Record<string, unknown>[]>;
  target: 'support' | 'care';
  maxUsers?: number;
}) {
  const entries = Array.from(data.entries()).slice(0, maxUsers);

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
        📋 データプレビュー（先頭 {Math.min(data.size, maxUsers)} ユーザー）
      </Typography>

      <Stack spacing={1}>
        {entries.map(([userCode, items]) => (
          <Paper key={userCode} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Chip
                label={userCode}
                size="small"
                variant="outlined"
                color="primary"
                sx={{ fontFamily: 'monospace', fontWeight: 700 }}
              />
              <Typography variant="caption" color="text.secondary">
                {items.length} 件
              </Typography>
            </Box>
            <Stack spacing={0.5}>
              {items.slice(0, 4).map((item, i) => (
                <Typography key={i} variant="caption" color="text.secondary" sx={{ pl: 1 }}>
                  {target === 'support'
                    ? `${(item as { time?: string }).time ?? '?'} — ${(item as { activity?: string }).activity ?? '?'}`
                    : (item as { targetBehavior?: string }).targetBehavior ?? '(データ)'}
                </Typography>
              ))}
              {items.length > 4 && (
                <Typography variant="caption" color="text.disabled" sx={{ pl: 1 }}>
                  他 {items.length - 4} 件…
                </Typography>
              )}
            </Stack>
          </Paper>
        ))}
      </Stack>

      {data.size > maxUsers && (
        <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
          他 {data.size - maxUsers} ユーザー…
        </Typography>
      )}
    </Box>
  );
}

// ─────────────────────────────────────────────
// PreviewSection (composite)
// ─────────────────────────────────────────────

interface PreviewSectionProps {
  preview: UnifiedImportPreview;
  activeConfig: TargetConfig;
}

export const PreviewSection: React.FC<PreviewSectionProps> = ({ preview, activeConfig }) => (
  <Fade in>
    <Card variant="outlined" sx={{ mb: 2, borderRadius: 2 }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Chip
            label="STEP 2"
            size="small"
            sx={{
              fontWeight: 800,
              fontSize: '0.65rem',
              background: activeConfig.gradient,
              color: '#fff',
            }}
          />
          <Typography variant="subtitle1" fontWeight={700}>
            プレビュー確認
          </Typography>
        </Box>

        {/* Summary Stats */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: 1.5,
            mb: 2,
          }}
        >
          <StatCard label="ユーザー数" value={preview.summary.userCount} color={activeConfig.color} />
          <StatCard label="レコード数" value={preview.summary.recordCount} color="#10b981" />
          <StatCard label="総行数" value={preview.summary.totalRows} color="#8b5cf6" />
          {preview.summary.skippedRows > 0 && (
            <StatCard label="スキップ行" value={preview.summary.skippedRows} color="#ef4444" />
          )}
        </Box>

        {/* Validation Issues */}
        {preview.validationIssues.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Alert severity="warning" variant="outlined" icon={<WarningAmberIcon />}>
              {preview.validationIssues.length} 件のバリデーション警告があります
            </Alert>
            <Collapse in>
              <Box sx={{ mt: 1, maxHeight: 200, overflow: 'auto' }}>
                {preview.validationIssues.slice(0, 10).map((issue, i) => (
                  <Box
                    key={i}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      py: 0.5,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Chip
                      label={`行 ${issue.row}`}
                      size="small"
                      variant="outlined"
                      color={issue.severity === 'error' ? 'error' : 'warning'}
                      sx={{ minWidth: 60 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      <strong>{issue.field}:</strong> {issue.message}
                    </Typography>
                  </Box>
                ))}
                {preview.validationIssues.length > 10 && (
                  <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>
                    他 {preview.validationIssues.length - 10} 件の警告…
                  </Typography>
                )}
              </Box>
            </Collapse>
          </Box>
        )}

        {/* Users Preview Table */}
        {preview.target === 'users' && (
          <UsersPreviewTable rows={preview.tableRows} maxRows={10} />
        )}

        {/* Support/Care Preview */}
        {(preview.target === 'support' || preview.target === 'care') && (
          <GenericPreviewTable
            data={preview.data as Map<string, { id?: string; time?: string; activity?: string; targetBehavior?: string }[]>}
            target={preview.target}
            maxUsers={5}
          />
        )}
      </CardContent>
    </Card>
  </Fade>
);
