import { NavAudience } from '@/app/config/navigationConfig';
import { computeNavigationDiagnostics } from '@/app/navigation/diagnostics/navigationDiagnostics';
import { ORPHAN_ALLOWLIST_DETAILS } from '@/app/navigation/diagnostics/pathUtils';
import { APP_ROUTE_PATHS } from '@/app/routes/appRoutePaths';
import { TESTIDS } from '@/testids';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { useMemo, useState } from 'react';

export const NavigationDiagnosticsPage: React.FC = () => {
  const [role, setRole] = useState<NavAudience>('admin');
  const [searchText, setSearchText] = useState('');
  const [tab, setTab] = useState('summary');

  // Feature Flags state
  const [flags, setFlags] = useState({
    schedulesEnabled: true,
    complianceFormEnabled: true,
    icebergPdcaEnabled: true,
    staffAttendanceEnabled: true,
    todayOpsEnabled: true,
  });

  const handleFlagChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFlags({
      ...flags,
      [event.target.name]: event.target.checked,
    });
  };

  const diagnostics = useMemo(
    () =>
      computeNavigationDiagnostics({
        role,
        searchText,
        ...flags,
      }),
    [role, flags, searchText],
  );

  const {
    counts,
    navItemsFlat,
    footerItemsFlat,
    missingInRouter,
    orphanRoutes,
    allowlistedOrphans,
  } = diagnostics;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }} data-testid={TESTIDS.nav.navigationDiagnostics}>
      <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
        ナビ診断（Navigation Diagnostics）
      </Typography>

      {/* Control Panel */}
      <Paper sx={{ p: 3, mb: 4 }} variant="outlined">
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={4}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              評価対象ロール (Role)
            </Typography>
            <RadioGroup
              row
              value={role}
              onChange={(e) => setRole(e.target.value as NavAudience)}
            >
              <FormControlLabel value="admin" control={<Radio size="small" />} label="Admin" />
              <FormControlLabel value="staff" control={<Radio size="small" />} label="Staff" />
              <FormControlLabel value="reception" control={<Radio size="small" />} label="Reception" />
              <FormControlLabel value="viewer" control={<Radio size="small" />} label="Viewer" />
            </RadioGroup>
          </Box>

          <Box flex={1}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Feature Flags 状態
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap">
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={flags.schedulesEnabled}
                    onChange={handleFlagChange}
                    name="schedulesEnabled"
                  />
                }
                label="schedules"
              />
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={flags.complianceFormEnabled}
                    onChange={handleFlagChange}
                    name="complianceFormEnabled"
                  />
                }
                label="compliance"
              />
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={flags.icebergPdcaEnabled}
                    onChange={handleFlagChange}
                    name="icebergPdcaEnabled"
                  />
                }
                label="icebergPdca"
              />
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={flags.staffAttendanceEnabled}
                    onChange={handleFlagChange}
                    name="staffAttendanceEnabled"
                  />
                }
                label="staffAttendance"
              />
            </Stack>
          </Box>

          <Box minWidth={250}>
            <TextField
              size="small"
              fullWidth
              label="パス・ラベル検索"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="/dashboard 等"
            />
          </Box>
        </Stack>
      </Paper>

      {/* Content Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab value="summary" label="Summary" />
          <Tab value="matrix" label={`露出マトリクス (${navItemsFlat.length + footerItemsFlat.length})`} />
          <Tab value="router" label={`ルーターパス (${counts.routerPaths})`} />
          <Tab value="allowlist" label={`許可リスト (${allowlistedOrphans.length})`} />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      {tab === 'summary' && (
        <Stack spacing={3}>
          <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
            <Card variant="outlined" sx={{ flex: 1, minWidth: 200 }}>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>Nav Items (Side)</Typography>
                <Typography variant="h4">{counts.sideNavItems}</Typography>
              </CardContent>
            </Card>
            <Card variant="outlined" sx={{ flex: 1, minWidth: 200 }}>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>Footer Actions</Typography>
                <Typography variant="h4">{counts.footerItems}</Typography>
              </CardContent>
            </Card>
            <Card variant="outlined" sx={{ flex: 1, minWidth: 200 }}>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>Total Router Paths</Typography>
                <Typography variant="h4">{counts.routerPaths}</Typography>
              </CardContent>
            </Card>
          </Stack>

          <Paper variant="outlined" sx={{ p: 2, borderColor: counts.missingInRouter > 0 ? 'error.main' : undefined }}>
            <Typography variant="h6" color={counts.missingInRouter > 0 ? 'error.main' : 'text.primary'} gutterBottom>
              Nav 👉 Router 不整合 (404等になるルート)
              <Chip size="small" label={counts.missingInRouter} color={counts.missingInRouter > 0 ? 'error' : 'success'} sx={{ ml: 2 }} />
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              設定されたサイドメニューやフッターに定義されているが、`APP_ROUTE_PATHS` に存在しないリンクです。
            </Typography>
            {counts.missingInRouter > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {missingInRouter.map((p) => (
                  <Chip key={p} label={p} color="error" variant="outlined" />
                ))}
              </Stack>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, borderColor: counts.orphanRoutes > 0 ? 'warning.main' : undefined }}>
            <Typography variant="h6" color={counts.orphanRoutes > 0 ? 'warning.main' : 'text.primary'} gutterBottom>
              Router 👉 Nav 幽霊ルート (露出漏れの疑い)
              <Chip size="small" label={counts.orphanRoutes} color={counts.orphanRoutes > 0 ? 'warning' : 'success'} sx={{ ml: 2 }} />
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Routerには存在するが、現在のロールとフラグ環境下でどこにも露出しておらず、許可リストにもないパスです。
            </Typography>
            {counts.orphanRoutes > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {orphanRoutes.map((p) => (
                  <Chip key={p} label={p} color="warning" variant="outlined" />
                ))}
              </Stack>
            )}
          </Paper>
        </Stack>
      )}

      {tab === 'matrix' && (
        <Stack spacing={4}>
          <TableContainer component={Paper} variant="outlined">
            <Typography variant="subtitle1" fontWeight="bold" sx={{ p: 2 }}>Side Navigation</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Label</TableCell>
                  <TableCell>Href</TableCell>
                  <TableCell>Visible</TableCell>
                  <TableCell>Reason/Audience</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {navItemsFlat.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell><code style={{ fontSize: '0.8em' }}>{row.href}</code></TableCell>
                    <TableCell>
                      <Chip label={row.visible ? 'YES' : 'NO'} size="small" color={row.visible ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.85em' }}>{row.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TableContainer component={Paper} variant="outlined">
            <Typography variant="subtitle1" fontWeight="bold" sx={{ p: 2 }}>Footer Navigation</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Label</TableCell>
                  <TableCell>Href</TableCell>
                  <TableCell>Visible</TableCell>
                  <TableCell>Condition</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {footerItemsFlat.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell><code style={{ fontSize: '0.8em' }}>{row.href}</code></TableCell>
                    <TableCell>
                      <Chip label="YES" size="small" color="success" />
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.85em' }}>{row.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      )}

      {tab === 'router' && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Router Path (Source of Truth)</TableCell>
                <TableCell width={150}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {APP_ROUTE_PATHS.map((path: string) => {
                const isOrphan = orphanRoutes.includes(path.startsWith('/') ? path : `/${path}`);
                const isAllowlisted = allowlistedOrphans.includes(path.startsWith('/') ? path : `/${path}`);
                let statusMsg = 'Exposed';
                let color: 'success' | 'warning' | 'default' = 'success';
                if (isOrphan) {
                  statusMsg = 'Orphan';
                  color = 'warning';
                } else if (isAllowlisted) {
                  statusMsg = 'Allowlisted';
                  color = 'default';
                }

                return (
                  <TableRow key={path}>
                    <TableCell><code style={{ fontSize: '0.8em' }}>{path}</code></TableCell>
                    <TableCell>
                      <Chip label={statusMsg} color={color} size="small" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tab === 'allowlist' && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Allowlisted Path / Pattern</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Reason</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ORPHAN_ALLOWLIST_DETAILS.map(({ path, category, reason }) => (
                <TableRow key={path}>
                  <TableCell><code style={{ fontSize: '0.8em' }}>{path}</code></TableCell>
                  <TableCell>
                    <Chip label={category} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.85em' }}>
                    {reason}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  );
};

export default NavigationDiagnosticsPage;
