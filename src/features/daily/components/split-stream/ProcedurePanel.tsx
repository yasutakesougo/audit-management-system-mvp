import type { BehaviorInterventionPlan } from '@/features/analysis/domain/interventionTypes';
import BipSummaryPopover from '@/features/daily/components/procedure/BipSummaryPopover';
import { getScheduleKey } from '@/features/daily/domain/getScheduleKey';
import EditIcon from '@mui/icons-material/Edit';
import ShieldIcon from '@mui/icons-material/Shield';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

export type ScheduleItem = {
  id?: string;
  time: string;
  activity: string;
  instruction: string;
  isKey: boolean;
  /** この時間帯に紐づく行動対応プラン（BIP）のIDリスト */
  linkedInterventionIds?: string[];
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
  showUnfilledOnly?: boolean;
  onToggleUnfilledOnly?: () => void;
  unfilledCount?: number;
  totalCount?: number;
  /** BIPポップオーバー表示用の全プランデータ */
  interventionPlans?: BehaviorInterventionPlan[];
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
  const isGuided = isGuidedProcedurePanel(props);
  const {
    title,
    schedule = [],
    isAcknowledged = false,
    onAcknowledged: _onAcknowledged,
    onEdit,
    selectedStepId,
    onSelectStep,
    filledStepIds,
    scrollToStepId,
    showUnfilledOnly = false,
    onToggleUnfilledOnly,
    unfilledCount,
    totalCount,
    interventionPlans,
    children,
  } = isGuided
    ? props
    : {
        title: props.title,
        children: props.children,
      };
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLLIElement | null>());
  const lastScrolledStepRef = useRef<string | null>(null);

  // BIP Popover state
  const [bipAnchorEl, setBipAnchorEl] = useState<HTMLElement | null>(null);
  const [bipPopoverPlans, setBipPopoverPlans] = useState<BehaviorInterventionPlan[]>([]);

  const handleBipChipClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, linkedIds: string[]) => {
      event.stopPropagation();
      if (!interventionPlans) return;
      const linked = interventionPlans.filter((p) => linkedIds.includes(p.id));
      if (linked.length === 0) return;
      setBipPopoverPlans(linked);
      setBipAnchorEl(event.currentTarget);
    },
    [interventionPlans],
  );

  const handleBipPopoverClose = useCallback(() => {
    setBipAnchorEl(null);
    setBipPopoverPlans([]);
  }, []);

  const scheduleKeys = useMemo(() => schedule.map((item) => getItemScheduleKey(item)), [schedule]);
  const visibleSchedule = useMemo(() => {
    if (!showUnfilledOnly) return schedule;
    if (!filledStepIds) return schedule;
    return schedule.filter((item) => !filledStepIds.has(getItemScheduleKey(item)));
  }, [filledStepIds, schedule, showUnfilledOnly]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current || isAcknowledged) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const nearBottom = scrollHeight - scrollTop - clientHeight < 64;
    if (nearBottom) {
      scrollRef.current.dataset.reachedBottom = 'true';
    }
  }, [isAcknowledged]);

  const handleSelectStep = useCallback((step: ScheduleItem, stepId: string) => {
    onSelectStep?.(step, stepId);
    if (showUnfilledOnly && onToggleUnfilledOnly) {
      flushSync(() => {
        onToggleUnfilledOnly();
      });
    }
  }, [onSelectStep, onToggleUnfilledOnly, showUnfilledOnly]);

  useEffect(() => {
    if (!scrollToStepId) return;
    if (lastScrolledStepRef.current === scrollToStepId) return;
    const targetRef = itemRefs.current.get(scrollToStepId);
    if (!targetRef) return;
    lastScrolledStepRef.current = scrollToStepId;
    targetRef.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [scrollToStepId, scheduleKeys]);

  if (!isGuided) {
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

  return (
    <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'grey.50' }}>
      <CardContent sx={{ py: 1, px: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, overflow: 'hidden' }}>
          <Typography variant="subtitle2" component="h2" fontWeight="bold" noWrap sx={{ flexShrink: 1, minWidth: 0 }}>
            {title ?? '支援手順 (Plan)'}
          </Typography>
          {onEdit && (
            <IconButton
              onClick={onEdit}
              size="small"
              color="primary"
              aria-label="手順を編集"
              data-testid="procedure-edit-button"
              sx={{ flexShrink: 0 }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          )}
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            {typeof unfilledCount === 'number' && typeof totalCount === 'number' && (
              <Chip
                label={`${unfilledCount}/${totalCount}`}
                size="small"
                color={unfilledCount === 0 ? 'success' : 'default'}
                variant={unfilledCount === 0 ? 'filled' : 'outlined'}
                sx={{ height: 22, '& .MuiChip-label': { px: 0.8 } }}
              />
            )}
            {onToggleUnfilledOnly && (
              <Switch
                checked={Boolean(showUnfilledOnly)}
                onChange={onToggleUnfilledOnly}
                size="small"
                color="primary"
              />
            )}
          </Box>
        </Box>
      </CardContent>

      <Box
        ref={scrollRef}
        onScroll={handleScroll}
        sx={{ flex: 1, overflowY: 'auto', p: 0 }}
        data-testid="procedure-scroll-container"
      >
        <List disablePadding>
          {visibleSchedule.map((item) => {
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
              onPointerDown={
                onSelectStep
                  ? (event) => {
                      if ('button' in event && event.button !== 0) return;
                      event.preventDefault();
                      handleSelectStep(item, stepId);
                    }
                  : undefined
              }
              onKeyDown={
                onSelectStep
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleSelectStep(item, stepId);
                      }
                    }
                  : undefined
              }
              sx={{
                borderBottom: '1px solid',
                borderColor: 'divider',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 1,
                py: 1,
                px: 1.5,
                bgcolor: isSelected ? 'primary.100' : item.isKey ? 'warning.50' : 'background.paper',
                borderLeft: isFilled ? '3px solid' : '3px solid transparent',
                borderLeftColor: isSelected ? 'primary.main' : isFilled ? 'success.main' : 'transparent',
                boxShadow: isSelected ? 1 : 0,
                transition: 'background-color 0.15s ease',
                cursor: onSelectStep ? 'pointer' : 'default',
                minHeight: 0,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                <Typography variant="caption" color="primary" fontWeight="bold" sx={{ minWidth: 40, flexShrink: 0 }}>
                  {item.time}
                </Typography>
                <Typography variant="body2" fontWeight="bold" noWrap sx={{ flex: 1 }}>
                  {item.activity}
                </Typography>
                {/* BIP シールドチップ */}
                {(item.linkedInterventionIds?.length ?? 0) > 0 && interventionPlans && (
                  <Chip
                    icon={<ShieldIcon sx={{ fontSize: 14 }} />}
                    label={item.linkedInterventionIds!.length}
                    size="small"
                    color="warning"
                    variant="filled"
                    onClick={(e) => handleBipChipClick(e, item.linkedInterventionIds!)}
                    sx={{ cursor: 'pointer', fontWeight: 'bold', height: 22 }}
                    data-testid={`bip-chip-${stepId}`}
                  />
                )}
                {item.isKey && (
                  <Typography variant="caption" color="warning.dark" fontWeight="bold">
                    重要
                  </Typography>
                )}
                {filledStepIds && (
                  <Chip
                    label={isFilled ? '済' : '未'}
                    size="small"
                    color={isFilled ? 'success' : 'default'}
                    variant={isFilled ? 'filled' : 'outlined'}
                    sx={{ height: 22, minWidth: 0, '& .MuiChip-label': { px: 0.8 } }}
                  />
                )}
              </Box>
            </ListItem>
          );
          })}
        </List>

        {showUnfilledOnly && visibleSchedule.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              未記入の手順はありません。
            </Typography>
          </Box>
        )}

        <Box sx={{ p: 2 }} />
      </Box>

      {/* BIP Summary Popover */}
      <BipSummaryPopover
        anchorEl={bipAnchorEl}
        plans={bipPopoverPlans}
        onClose={handleBipPopoverClose}
      />
    </Card>
  );
}

export default memo(ProcedurePanel);
