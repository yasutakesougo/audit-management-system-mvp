import React from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Chip, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Paper,
  Tooltip
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { driftEventCollector } from '@/lib/sp/driftCollector';
import { driftKpiAggregator, DriftKpi } from '@/lib/sp/driftKpi';

export const DriftActionPanel: React.FC = () => {
  const [kpis, setKpis] = React.useState<DriftKpi[]>([]);
  const [events, setEvents] = React.useState(driftEventCollector.getSummary());

  // 定期更新 (ポーリング)
  React.useEffect(() => {
    const update = () => {
      setKpis(driftKpiAggregator.getAllKpis());
      setEvents(driftEventCollector.getSummary());
    };
    const timer = setInterval(update, 2000);
    update();
    return () => clearInterval(timer);
  }, []);

  const getScoreColor = (score: number) => {
    if (score > 0.9) return 'success';
    if (score > 0.7) return 'warning';
    return 'error';
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberIcon color="warning" /> Drift Actions & Health KPI
      </Typography>

      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, 
        gap: 2,
        mb: 3
      }}>
        {kpis.map((kpi) => (
          <Card key={`${kpi.domain}-${kpi.listKey}`} variant="outlined">
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                {kpi.listKey} ({kpi.domain})
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                <Typography variant="h4" color={`${getScoreColor(kpi.healthScore)}.main`}>
                  {Math.round(kpi.healthScore * 100)}%
                </Typography>
                <Tooltip title={`Total: ${kpi.totalResolutions}, Drift: ${kpi.driftCount}, Error: ${kpi.errorCount}`}>
                  <Chip 
                    label={kpi.healthScore > 0.9 ? 'Healthy' : kpi.healthScore > 0.7 ? 'Degraded' : 'Critical'} 
                    color={getScoreColor(kpi.healthScore)}
                    size="small"
                  />
                </Tooltip>
              </Box>
            </CardContent>
          </Card>
        ))}
        {kpis.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 4 }}>
            No drift KPI data collected yet. Run some operations to see metrics.
          </Typography>
        )}
      </Box>

      <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>
        Recent Resolved Drift Events (Summary)
      </Typography>
      
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Severity</TableCell>
              <TableCell>Domain</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Field</TableCell>
              <TableCell>Message</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No drift events detected in this session.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              events.map((e, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    {e.severity === 'error' ? <ErrorOutlineIcon color="error" fontSize="small" /> : 
                     e.severity === 'warn' ? <WarningAmberIcon color="warning" fontSize="small" /> : 
                     <CheckCircleOutlineIcon color="success" fontSize="small" />}
                  </TableCell>
                  <TableCell>{e.domain}</TableCell>
                  <TableCell><Chip label={e.kind} size="small" variant="outlined" /></TableCell>
                  <TableCell>{e.canonicalField || '-'}</TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                      {e.message}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
