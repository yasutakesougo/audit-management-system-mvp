"use client";

import React, { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { isDev } from '@/env';
import { useTelemetryStore } from '@/lib/sp/telemetryStore';
import { computeTelemetrySummary } from '@/lib/sp/computeTelemetrySummary';

export default function QueryTelemetryHUD() {
  const [expanded, setExpanded] = useState(false);
  const entries = useTelemetryStore((state) => state.entries);
  const clearEntries = useTelemetryStore((state) => state.clearEntries);

  // Compute summary off the current entries
  const summary = useMemo(() => computeTelemetrySummary(entries), [entries]);

  // Determine health color
  // 赤: 直近 N 件に Error がある、または High リスクがある
  // 黄: 直近 N 件に Medium リスクがある または Slow Query がある
  // 緑: 上記以外
  const healthColor = useMemo(() => {
    if (summary.errorCount > 0 || summary.highCount > 0) return '#d32f2f'; // MUI error.main
    if (summary.mediumCount > 0 || summary.slowCount > 0) return '#ed6c02'; // MUI warning.main
    return '#2e7d32'; // MUI success.main
  }, [summary]);

  if (!isDev) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        maxWidth: 600,
      }}
    >
      <Paper elevation={4} sx={{ overflow: 'hidden', border: `1px solid ${healthColor}` }}>
        {/* Header - Always visible */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1,
            bgcolor: 'background.paper',
            cursor: 'pointer',
            borderBottom: expanded ? '1px solid' : 'none',
            borderColor: 'divider',
          }}
          onClick={() => setExpanded(!expanded)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                bgcolor: healthColor,
              }}
            />
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              SP Telemetry ({entries.length})
            </Typography>
          </Box>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
            {expanded ? <ExpandMoreIcon /> : <ExpandLessIcon />}
          </IconButton>
        </Box>

        {/* Body - Collapsible */}
        <Collapse in={expanded}>
          <Box sx={{ p: 2, bgcolor: 'background.default', maxHeight: 400, overflowY: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  <strong>Total:</strong> {summary.total} | <strong>Slow:</strong> {summary.slowCount} | <strong>Errors:</strong> {summary.errorCount}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Risk (H/M/L):</strong> {summary.highCount} / {summary.mediumCount} / {summary.lowCount}
                </Typography>
                {Object.keys(summary.byWarningCode).length > 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    <strong>Warnings:</strong>{' '}
                    {Object.entries(summary.byWarningCode)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 3)
                      .map(([code, count]) => `${code}(${count})`)
                      .join(', ')}
                  </Typography>
                )}
              </Box>
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                startIcon={<DeleteOutlineIcon />}
                onClick={() => clearEntries()}
              >
                Clear
              </Button>
            </Box>

            {entries.length > 0 ? (
              <Table size="small" sx={{ '& th, & td': { p: 0.5, fontSize: '0.75rem', borderBottom: '1px solid rgba(224, 224, 224, 1)' } }}>
                <TableHead>
                  <TableRow>
                    <TableCell>List</TableCell>
                    <TableCell>Ms</TableCell>
                    <TableCell>Score</TableCell>
                    <TableCell>Codes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entries.slice(0, 10).map((metric, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{metric.listName || '-'}</TableCell>
                      <TableCell sx={{ color: metric.durationMs > 500 ? 'warning.main' : 'inherit' }}>
                        {metric.durationMs}
                      </TableCell>
                      <TableCell sx={{
                        color: metric.riskLevel === 'high' ? 'error.main' : metric.riskLevel === 'medium' ? 'warning.main' : 'inherit',
                        fontWeight: 'bold'
                      }}>
                        {metric.riskScore} ({metric.riskLevel[0]?.toUpperCase()})
                      </TableCell>
                      <TableCell sx={{ maxWidth: 120, WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box' }}>
                        {metric.isError ? `ERR: ${metric.errorMessage}` : (metric.warningCodes.length ? metric.warningCodes.join(',') : '-')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Typography variant="caption" color="text.disabled">No queries recorded yet.</Typography>
            )}
            
            {entries.length > 10 && (
              <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
                Showing last 10 of {entries.length} items
              </Typography>
            )}
          </Box>
        </Collapse>
      </Paper>
    </Box>
  );
}
