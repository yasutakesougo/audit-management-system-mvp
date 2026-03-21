import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { ImportHistoryTimeline } from '@/features/planning-sheet/components/ImportHistoryTimeline';
import type { AuditHistoryFilter } from '@/features/planning-sheet/domain/filterAuditHistory';
import type { ImportAuditRecord } from '@/features/planning-sheet/stores/importAuditStore';

type ImportHistorySectionProps = {
  auditRecords: ImportAuditRecord[];
  filteredAuditRecords: ImportAuditRecord[];
  historyFilter: AuditHistoryFilter;
  onHistoryFilterChange: (next: AuditHistoryFilter) => void;
};

export function ImportHistorySection({
  auditRecords,
  filteredAuditRecords,
  historyFilter,
  onHistoryFilterChange,
}: ImportHistorySectionProps) {
  if (auditRecords.length === 0) {
    return (
      <Alert severity="info" variant="outlined" id="monitoring-history-timeline">
        モニタリング履歴はまだありません。モニタリング取込後に履歴が表示されます。
      </Alert>
    );
  }

  return (
    <Box id="monitoring-history-timeline">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        sx={{ mb: 1 }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          モニタリング履歴 / 取込履歴
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={historyFilter}
          onChange={(_event, next) => {
            if (next) onHistoryFilterChange(next as AuditHistoryFilter);
          }}
          aria-label="履歴フィルタ"
        >
          <ToggleButton value="all">すべて</ToggleButton>
          <ToggleButton value="monitoring">モニタリング</ToggleButton>
          <ToggleButton value="assessment">アセスメント</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        モニタリング取込後の反映履歴はこのセクションで確認できます。必要に応じて履歴フィルタを切り替えてください。
      </Typography>
      {filteredAuditRecords.length > 0 ? (
        <ImportHistoryTimeline records={filteredAuditRecords} compact />
      ) : (
        <Alert severity="info" variant="outlined">
          選択した条件に一致する履歴はありません。履歴フィルタを切り替えて確認してください。
        </Alert>
      )}
    </Box>
  );
}
