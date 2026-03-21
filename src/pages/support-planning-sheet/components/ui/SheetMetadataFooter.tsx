import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { SupportPlanningSheet } from '@/domain/isp/schema';
import { formatDateTimeIntl } from '@/lib/dateFormat';

type SheetMetadataFooterProps = {
  sheet: SupportPlanningSheet;
};

export function SheetMetadataFooter({ sheet }: SheetMetadataFooterProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        編集後は更新日・更新者を確認し、意図した内容で保存されていることを確認してください。
      </Typography>
      <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
        <Typography variant="caption" color="text.secondary">
          作成日: {formatDateTimeIntl(sheet.createdAt, { year: 'numeric', month: '2-digit', day: '2-digit' })}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          作成者: {sheet.createdBy}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          更新日: {formatDateTimeIntl(sheet.updatedAt, { year: 'numeric', month: '2-digit', day: '2-digit' })}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          更新者: {sheet.updatedBy}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          ID: {sheet.id}
        </Typography>
      </Stack>
    </Paper>
  );
}
