import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { getScheduleKey } from '@/features/daily/domain/getScheduleKey';

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
  selectedStepId?: string | null;
  onSelectStep?: (step: ScheduleItem, stepId: string) => void;
  filledStepIds?: Set<string>;
  scrollToStepId?: string | null;
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

const getItemScheduleKey = (item: ScheduleItem) => getScheduleKey(item.time, item.activity);

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
    onEdit,
    selectedStepId,
    onSelectStep,
    filledStepIds,
    scrollToStepId
  } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLLIElement | null>());

  const scheduleKeys = useMemo(() => schedule.map((item) => getItemScheduleKey(item)), [schedule]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current || isAcknowledged) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const nearBottom = scrollHeight - scrollTop - clientHeight < 64;
    if (nearBottom) {
      scrollRef.current.dataset.reachedBottom = 'true';
    }
  }, [isAcknowledged]);

  useEffect(() => {
    if (!scrollToStepId) return;
    const targetRef = itemRefs.current.get(scrollToStepId);
    if (!targetRef) return;
    targetRef.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [scrollToStepId, scheduleKeys]);

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
          {schedule.map((item) => {
            const stepId = getItemScheduleKey(item);
            const isFilled = filledStepIds?.has(stepId) ?? false;
            const isSelected = selectedStepId === stepId;
            return (
            <ListItem
              key={stepId}
              alignItems="flex-start"
              ref={(node) => {
                itemRefs.current.set(stepId, node);
              }}
              role={onSelectStep ? 'button' : undefined}
              tabIndex={onSelectStep ? 0 : undefined}
              onClick={onSelectStep ? () => onSelectStep(item, stepId) : undefined}
              onKeyDown={
                onSelectStep
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelectStep(item, stepId);
                      }
                    }
                  : undefined
              }
              sx={{
                borderBottom: '1px solid',
                borderColor: 'divider',
                flexDirection: 'column',
                gap: 1,
                py: 2,
                px: 2,
                bgcolor: isSelected ? 'primary.50' : item.isKey ? 'warning.50' : 'background.paper',
                borderLeft: isFilled ? '4px solid' : '4px solid transparent',
                borderLeftColor: isFilled ? 'success.main' : 'transparent',
                cursor: onSelectStep ? 'pointer' : 'default'
              }}
            >
              <Box display="flex" justifyContent="space-between" width="100%" mb={0.5}>
                <Typography variant="subtitle2" color="primary" fontWeight="bold">
                  {item.time}
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  {filledStepIds && (
                    <Chip
                      label={isFilled ? '記録済み' : '未記入'}
                      size="small"
                      color={isFilled ? 'success' : 'default'}
                      variant={isFilled ? 'filled' : 'outlined'}
                    />
                  )}
                  {item.isKey && (
                    <Typography variant="caption" color="warning.dark" fontWeight="bold">
                      重要
                    </Typography>
                  )}
                </Box>
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
          );
          })}
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
