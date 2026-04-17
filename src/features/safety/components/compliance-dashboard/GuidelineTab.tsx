/**
 * GuidelineTab — 指針整備状況タブ
 */
import React, { useMemo } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import DescriptionIcon from '@mui/icons-material/Description';

import type { GuidelineVersion, GuidelineSummary, GuidelineRequiredItems } from '@/domain/safety/guidelineVersion';
import { REQUIRED_ITEM_LABELS } from '@/domain/safety/guidelineVersion';
import { TESTIDS } from '@/testids';
import { formatDateJapanese, formatDateYmd } from '@/lib/dateFormat';

interface GuidelineTabProps {
  versions: GuidelineVersion[];
  summary: GuidelineSummary;
}

export const GuidelineTab: React.FC<GuidelineTabProps> = ({ versions, summary }) => {
  const currentVersion = useMemo(
    () => versions.find((v) => v.status === 'active'),
    [versions],
  );

  return (
    <Box data-testid={TESTIDS['compliance-guideline-tab']}>
      {/* Current Version Card */}
      <Card variant="outlined" sx={{ mb: 3, p: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={2}>
          <DescriptionIcon color="primary" />
          <Typography variant="subtitle1" fontWeight={700}>
            現行版
          </Typography>
          {summary.currentVersion && (
            <Chip
              label={`v${summary.currentVersion}`}
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
        </Stack>

        {!currentVersion ? (
          <Typography color="text.secondary">
            指針が登録されていません。指針の策定を行ってください。
          </Typography>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              施行日: {summary.currentEffectiveDate ? formatDateJapanese(summary.currentEffectiveDate) : '未設定'}
            </Typography>

            {/* Required Items Progress */}
            <Box sx={{ mt: 2, mb: 1 }}>
              <Stack direction="row" justifyContent="space-between" mb={0.5}>
                <Typography variant="body2" fontWeight={600}>
                  必須項目の充足状況
                </Typography>
                <Typography variant="body2" fontWeight={700} color={summary.allItemsFulfilled ? 'success.main' : 'warning.main'}>
                  {summary.currentFulfilledItems} / 7 ({summary.currentFulfillmentRate}%)
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={summary.currentFulfillmentRate}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: 'grey.200',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: summary.allItemsFulfilled ? 'success.main' : 'warning.main',
                  },
                }}
              />
            </Box>

            {/* Required Items Checklist */}
            <List dense sx={{ mt: 1 }}>
              {(Object.entries(currentVersion.requiredItems) as [keyof GuidelineRequiredItems, boolean][]).map(
                ([key, fulfilled]) => (
                  <ListItem key={key} disablePadding sx={{ py: 0.25 }}>
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      {fulfilled ? (
                        <CheckCircleIcon fontSize="small" color="success" />
                      ) : (
                        <CancelIcon fontSize="small" color="error" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={REQUIRED_ITEM_LABELS[key]}
                      primaryTypographyProps={{
                        variant: 'body2',
                        color: fulfilled ? 'text.primary' : 'error.main',
                        fontWeight: fulfilled ? 400 : 600,
                      }}
                    />
                  </ListItem>
                ),
              )}
            </List>
          </>
        )}
      </Card>

      {/* Version History */}
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        バージョン履歴
      </Typography>
      {versions.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          指針のバージョン履歴はまだありません
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 700 }}>バージョン</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>施行日</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>変更種別</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>必須項目</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>ステータス</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {versions.map((v) => (
                <TableRow key={v.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      v{v.version}
                    </Typography>
                  </TableCell>
                  <TableCell>{formatDateYmd(v.effectiveDate)}</TableCell>
                  <TableCell>
                    <Chip label={v.changeType} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    {Object.values(v.requiredItems).filter(Boolean).length} / 7
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={
                        v.status === 'active'
                          ? '現行'
                          : v.status === 'archived'
                            ? '旧版'
                            : '下書き'
                      }
                      size="small"
                      color={
                        v.status === 'active'
                          ? 'success'
                          : v.status === 'archived'
                            ? 'default'
                            : 'warning'
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};
