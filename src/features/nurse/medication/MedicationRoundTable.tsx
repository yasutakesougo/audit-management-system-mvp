/**
 * MedicationRoundTable.tsx — Presentational table for medication inventory entries.
 *
 * Extracted from MedicationRound.tsx (L382-443).
 * Receives filtered entries as props; owns no state.
 */
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import React from 'react';
import { categorizeStatus, statusColorMap, statusLabel } from './medicationRoundHelpers';
import type { MedicationInventoryEntry } from './medicationRoundTypes';

type Props = {
  entries: MedicationInventoryEntry[];
};

const MedicationRoundTable: React.FC<Props> = ({ entries }) => (
  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ width: 96 }}>区分</TableCell>
          <TableCell>薬剤名・用法</TableCell>
          <TableCell sx={{ width: 120 }}>在庫</TableCell>
          <TableCell sx={{ width: 160 }}>消費期限</TableCell>
          <TableCell>処方元</TableCell>
          <TableCell>保管場所</TableCell>
          <TableCell>備考</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {entries.map((entry) => {
          const status = categorizeStatus(entry);
          return (
            <TableRow key={entry.id} hover>
              <TableCell>
                <Stack spacing={0.5}>
                  <Typography fontWeight={600}>{entry.category}</Typography>
                  <Chip
                    size="small"
                    label={statusLabel(status)}
                    color={statusColorMap[status]}
                    variant="outlined"
                  />
                </Stack>
              </TableCell>
              <TableCell>
                <Typography fontWeight={600}>{entry.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {entry.dosage}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography fontWeight={600}>
                  {entry.stock} {entry.unit}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography>{entry.expirationDate}</Typography>
              </TableCell>
              <TableCell>
                <Typography>{entry.prescribedBy}</Typography>
              </TableCell>
              <TableCell>
                <Typography>{entry.storage}</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary">
                  {entry.notes || '—'}
                </Typography>
              </TableCell>
            </TableRow>
          );
        })}
        {entries.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="body2" color="text.secondary">
                条件に合致する在庫がありません。検索条件やステータスを調整してください。
              </Typography>
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  </Box>
);

export default MedicationRoundTable;
