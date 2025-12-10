import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { useCallback, useRef } from 'react';

export type ScheduleItem = {
  id?: string;
  time: string;
  activity: string;
  instruction: string;
  isKey: boolean;
};

type GuidedProcedurePanelProps = {
  title?: string;
  schedule: ScheduleItem[];
  isAcknowledged: boolean;
  onAcknowledged: () => void;
  onEdit?: () => void;
  children?: undefined;
};

type CustomProcedurePanelProps = {
  title?: string;
  children: ReactNode;
  schedule?: never;
  isAcknowledged?: never;
  onAcknowledged?: never;
};

export type ProcedurePanelProps = GuidedProcedurePanelProps | CustomProcedurePanelProps;

const isGuidedProcedurePanel = (props: ProcedurePanelProps): props is GuidedProcedurePanelProps =>
  'schedule' in props;

export function ProcedurePanel(props: ProcedurePanelProps): JSX.Element {
  if (!isGuidedProcedurePanel(props)) {
    const { title, children } = props;
    return (
      <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'grey.50' }}>
        <CardContent sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6" component="h2" fontWeight="bold">
            {title ?? '支援手順 (Plan)'}
          </Typography>
        </CardContent>
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
          {children}
        </Box>
      </Card>
    );
  }

  const {
    title,
    schedule,
    isAcknowledged,
    onAcknowledged,
    onEdit
  } = props;
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current || isAcknowledged) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const nearBottom = scrollHeight - scrollTop - clientHeight < 64;
    if (nearBottom) {
      scrollRef.current.dataset.reachedBottom = 'true';
    }
  }, [isAcknowledged]);

  return (
    <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'grey.50' }}>
      <CardContent sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
          <Box>
            <Typography variant="h6" component="h2" fontWeight="bold">
              {title ?? '支援手順 (Plan)'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ※最後までスクロールして手順を確認してから記録を開始してください
            </Typography>
          </Box>
          {onEdit && (
            <IconButton
              onClick={onEdit}
              size="small"
              color="primary"
              aria-label="手順を編集"
              data-testid="procedure-edit-button"
            >
              <EditIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      </CardContent>

      <Box
        ref={scrollRef}
        onScroll={handleScroll}
        sx={{ flex: 1, overflowY: 'auto', p: 0 }}
        data-testid="procedure-scroll-container"
      >
        <List disablePadding>
          {schedule.map((item, index) => (
            <ListItem
              key={item.id ?? `${item.time}-${index}`}
              alignItems="flex-start"
              sx={{
                borderBottom: '1px solid',
                borderColor: 'divider',
                flexDirection: 'column',
                gap: 1,
                py: 2,
                px: 2,
                bgcolor: item.isKey ? 'warning.50' : 'background.paper'
              }}
            >
              <Box display="flex" justifyContent="space-between" width="100%" mb={0.5}>
                <Typography variant="subtitle2" color="primary" fontWeight="bold">
                  {item.time}
                </Typography>
                {item.isKey && (
                  <Typography variant="caption" color="warning.dark" fontWeight="bold">
                    重要
                  </Typography>
                )}
              </Box>
              <ListItemText
                primary={
                  <Typography variant="subtitle1" fontWeight="bold" sx={{ fontSize: '1.05rem' }}>
                    {item.activity}
                  </Typography>
                }
                secondary={
                  <Typography
                    variant="body2"
                    color="text.primary"
                    sx={{
                      whiteSpace: 'pre-wrap',
                      bgcolor: 'background.default',
                      p: 1.5,
                      borderRadius: 1,
                      border: '1px dashed',
                      borderColor: 'divider'
                    }}
                  >
                    {item.instruction}
                  </Typography>
                }
              />
            </ListItem>
          ))}
        </List>

        <Box sx={{ p: 3, textAlign: 'center', bgcolor: isAcknowledged ? 'success.50' : 'error.50' }}>
          <Typography variant="body2" fontWeight="bold" gutterBottom>
            {isAcknowledged ? '手順確認済み' : '手順を確認しましたか？'}
          </Typography>
          <Button
            variant={isAcknowledged ? 'outlined' : 'contained'}
            color={isAcknowledged ? 'success' : 'warning'}
            size="large"
            startIcon={<CheckCircleIcon />}
            disabled={isAcknowledged}
            onClick={onAcknowledged}
            data-testid="procedure-acknowledge-button"
          >
            {isAcknowledged ? '記録入力が解放されています' : '確認してロック解除'}
          </Button>
        </Box>
      </Box>
    </Card>
  );
}

export default ProcedurePanel;
