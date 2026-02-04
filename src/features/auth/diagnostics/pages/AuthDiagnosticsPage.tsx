import React from 'react';
import { Container, Stack, Typography, Paper, TableContainer, Table, TableHead, TableBody, TableRow, TableCell, Button, Box } from '@mui/material';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import { useAuthDiagnosticsSnapshot } from '../hooks/useAuthDiagnosticsSnapshot';
import { authDiagnostics } from '../collector';
import AuthDiagnosticsSummaryCards from '../components/AuthDiagnosticsSummaryCards';
import AuthDiagnosticsReasonsTable from '../components/AuthDiagnosticsReasonsTable';

export default function AuthDiagnosticsPage(): React.ReactElement {
  const snapshot = useAuthDiagnosticsSnapshot();
  const [copyFeedback, setCopyFeedback] = React.useState<string | null>(null);

  const recentEvents = authDiagnostics.getRecent(20);

  const handleCopyJSON = () => {
    const json = JSON.stringify(snapshot, null, 2);
    navigator.clipboard.writeText(json);
    setCopyFeedback('Copied to clipboard!');
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Stack spacing={1} sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Auth Diagnostics
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Real-time authentication event tracking and analysis
        </Typography>
      </Stack>

      {/* Summary Cards */}
      <AuthDiagnosticsSummaryCards stats={snapshot} />

      {/* Top Reasons */}
      <Stack spacing={2} sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          Top Failure Reasons
        </Typography>
        <AuthDiagnosticsReasonsTable stats={snapshot} />
      </Stack>

      {/* Recent Events */}
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Recent Events ({recentEvents.length})
          </Typography>
          <Button
            startIcon={<FileCopyIcon />}
            size="small"
            onClick={handleCopyJSON}
            variant="outlined"
          >
            {copyFeedback || 'Copy JSON'}
          </Button>
        </Box>

        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>Timestamp</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Reason</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Outcome</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Route</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recentEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'textSecondary' }}>
                    No events recorded yet
                  </TableCell>
                </TableRow>
              ) : (
                recentEvents.map((event, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell sx={{ fontSize: '0.875rem' }}>
                      {new Date(event.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.875rem' }}>{event.reason}</TableCell>
                    <TableCell>
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          backgroundColor:
                            event.outcome === 'recovered'
                              ? '#c8e6c9'
                              : event.outcome === 'manual-fix'
                                ? '#fff9c4'
                                : '#ffcdd2',
                          color:
                            event.outcome === 'recovered'
                              ? '#2e7d32'
                              : event.outcome === 'manual-fix'
                                ? '#f57f17'
                                : '#c62828',
                        }}
                      >
                        {event.outcome}
                      </span>
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.875rem', fontFamily: 'monospace' }}>
                      {event.route}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    </Container>
  );
}
