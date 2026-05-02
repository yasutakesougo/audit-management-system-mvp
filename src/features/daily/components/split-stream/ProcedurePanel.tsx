import type { BehaviorInterventionPlan } from '@/features/analysis/domain/interventionTypes';
import { getScheduleKey } from '@/features/daily/domain/getScheduleKey';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { memo, useMemo } from 'react';
import type { ProcedureSource } from '@/features/daily/domain/ProcedureRepository';
import { getParentOrderForChild } from '@/features/planning-sheet/constants/procedureRows';

export type ScheduleItem = {
  id?: string;
  rowNo?: number;
  block?: 'morning' | 'afternoon' | 'outing';
  time: string;
  activity: string;
  instruction: string;
  activityDetail?: string;
  instructionDetail?: string;
  condition?: string;
  isKey: boolean;
  linkedInterventionIds?: string[];
  source?: ProcedureSource;
  sourceStepOrder?: number;
};

type GuidedProcedurePanelProps = {
  title?: string;
  schedule: ScheduleItem[];
  onEdit?: () => void;
  selectedStepId?: string | null;
  onSelectStep?: (step: ScheduleItem, stepId: string) => void;
  filledStepIds?: Set<string>;
  scrollToStepId?: string | null;
  showUnfilledOnly?: boolean;
  onToggleUnfilledOnly?: () => void;
  unfilledCount?: number;
  totalCount?: number;
  interventionPlans?: BehaviorInterventionPlan[];
  selectableStateByStepId?: Map<string, { conflicted: boolean; blockingOrders: number[] }>;
  hiddenStepOrders?: Set<number>;
  children?: React.ReactNode;
};

type CustomProcedurePanelProps = {
  title?: string;
  children: React.ReactNode;
  schedule?: never;
};

export type ProcedurePanelProps = GuidedProcedurePanelProps | CustomProcedurePanelProps;

const isGuidedProcedurePanel = (props: ProcedurePanelProps): props is GuidedProcedurePanelProps =>
  'schedule' in props;

const getItemScheduleKey = (item: ScheduleItem) => getScheduleKey(item.time, item.activity);

/**
 * 子行の活動名から冗長な親の名称を削除する
 */
const cleanActivityName = (name: string, isNested: boolean) => {
  if (!isNested) return name;
  const match = name.match(/[(（](.*?)[)）]/);
  const cleaned = match && match[1] ? match[1] : name.replace(/^.*日中活動\s*/, '');
  if (cleaned === '外活動') return '外活動参加';
  return cleaned;
};

const ProcedureStepRow = ({
  item,
  isSelected,
  isFilled,
  onSelect,
  selectableState,
  isChild = false,
}: {
  item: ScheduleItem;
  isSelected: boolean;
  isFilled: boolean;
  onSelect?: (step: ScheduleItem, id: string) => void;
  selectableState?: { conflicted: boolean; blockingOrders: number[] };
  isChild?: boolean;
}) => {
  const key = getItemScheduleKey(item);
  const stageLabel = (item.sourceStepOrder === 16 || item.sourceStepOrder === 18) ? '準備' : '参加';
  const displayActivity = isChild ? cleanActivityName(item.activity, true) : item.activity;

  return (
    <Card
      onClick={() => onSelect?.(item, key)}
      sx={{
        cursor: 'pointer',
        mb: 0.5,
        border: '1px solid',
        borderColor: isSelected ? 'primary.main' : isFilled ? 'success.light' : 'divider',
        bgcolor: isSelected ? 'action.selected' : isFilled ? 'success.50' : 'background.paper',
        '&:hover': { bgcolor: 'action.hover' },
        transition: 'all 0.2s ease',
        boxShadow: isSelected ? 2 : 0,
      }}
    >
      <CardActionArea sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          {/* Time / Stage Column */}
          <Box sx={{ minWidth: 80, pt: 0.5 }}>
            <Chip 
              size="small" 
              label={isChild ? stageLabel : item.time} 
              color={isChild ? "warning" : "primary"}
              variant={isChild ? "outlined" : "filled"}
              sx={{ fontWeight: 700, width: '100%', height: 24 }}
            />
          </Box>

          {/* Details Column */}
          <Box sx={{ flex: 1 }}>
            <Stack spacing={0.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant={isChild ? "body2" : "body1"} fontWeight={700}>
                  {displayActivity}
                </Typography>
                {isFilled && <CheckCircleIcon color="success" sx={{ fontSize: 18 }} />}
                {selectableState?.conflicted && (
                  <Tooltip title={`競合: 行${selectableState.blockingOrders.join(', ')}が既に記録されています`}>
                    <Chip size="small" label="競合あり" color="error" variant="filled" sx={{ height: 20, fontSize: 10 }} />
                  </Tooltip>
                )}
              </Stack>

              {item.activityDetail && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, lineHeight: 1.4 }}>
                  <Box component="span" sx={{ bgcolor: 'grey.200', px: 0.5, borderRadius: 0.5, fontSize: '0.65rem', fontWeight: 700, flexShrink: 0 }}>本人</Box>
                  {item.activityDetail}
                </Typography>
              )}

              {item.instructionDetail && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, lineHeight: 1.4 }}>
                  <Box component="span" sx={{ bgcolor: 'secondary.100', px: 0.5, borderRadius: 0.5, fontSize: '0.65rem', fontWeight: 700, flexShrink: 0, color: 'secondary.main' }}>支援</Box>
                  {item.instructionDetail}
                </Typography>
              )}

              {item.condition && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, lineHeight: 1.4 }}>
                  <Box component="span" sx={{ bgcolor: 'success.100', px: 0.5, borderRadius: 0.5, fontSize: '0.65rem', fontWeight: 700, flexShrink: 0, color: 'success.dark' }}>様子</Box>
                  {item.condition}
                </Typography>
              )}
            </Stack>
          </Box>
        </Stack>
      </CardActionArea>
    </Card>
  );
};

export const ProcedurePanel = (props: ProcedurePanelProps): JSX.Element => {
  const isGuided = isGuidedProcedurePanel(props);
  const {
    title,
    schedule = [],
    onEdit,
    selectedStepId,
    onSelectStep,
    filledStepIds = new Set(),
    showUnfilledOnly = false,
    onToggleUnfilledOnly,
    unfilledCount,
    totalCount,
    selectableStateByStepId,
    hiddenStepOrders,
  } = isGuided ? props : { title: props.title, schedule: [], onEdit: undefined, selectedStepId: null, onSelectStep: undefined, filledStepIds: new Set(), showUnfilledOnly: false, onToggleUnfilledOnly: undefined, unfilledCount: 0, totalCount: 0, selectableStateByStepId: new Map(), hiddenStepOrders: new Set() };

  const isHidden = (item: ScheduleItem) => {
    return typeof item.sourceStepOrder === 'number' && hiddenStepOrders?.has(item.sourceStepOrder);
  };

  const visibleSchedule = useMemo(() => {
    if (!showUnfilledOnly) return schedule;
    return schedule.filter((item) => !filledStepIds.has(getItemScheduleKey(item)));
  }, [filledStepIds, schedule, showUnfilledOnly]);

  const groupedSchedule = useMemo(() => {
    type GroupedItem = { parent: ScheduleItem; children: ScheduleItem[] };
    const morningItems: ScheduleItem[] = [];
    const afternoonItems: ScheduleItem[] = [];
    const outingItems: ScheduleItem[] = [];
    const otherItems: ScheduleItem[] = [];

    for (const item of visibleSchedule) {
      if (item.block === 'morning') {
        morningItems.push(item);
      } else if (item.block === 'afternoon') {
        afternoonItems.push(item);
      } else if (item.block === 'outing') {
        outingItems.push(item);
      } else {
        // block 情報がない場合（旧データなど）
        if (item.sourceStepOrder && item.source === 'planning_sheet') {
          const parentOrder = getParentOrderForChild({ source: item.source, sourceStepOrder: item.sourceStepOrder });
          if (parentOrder != null) {
             // 外活動系として扱う（旧ロジック互換）
             outingItems.push(item);
             continue;
          }
        }
        otherItems.push(item);
      }
    }

    // 基本は rowNo 順に並べる
    const result: GroupedItem[] = [];
    
    // morning -> afternoon -> outing の順で組み立て
    [...morningItems, ...afternoonItems].sort((a, b) => (a.rowNo ?? 0) - (b.rowNo ?? 0)).forEach(item => {
      result.push({ parent: item, children: [] });
    });

    // outing は AM/PM 日中活動の「子」として扱われていた旧 UI 表現を尊重しつつ、
    // 新設計では 16, 17 行目として独立して並べる
    if (outingItems.length > 0) {
      // 日中活動（rowNo 5 or 10）の後ろに挿入するか、最後にまとめるか
      // ここでは 17行フォームの順序に従い、午後の最後（rowNo 15）の後に配置
      outingItems.sort((a, b) => (a.rowNo ?? 0) - (b.rowNo ?? 0)).forEach(item => {
        result.push({ parent: item, children: [] });
      });
    }

    // その他（あれば）
    otherItems.forEach(item => {
      result.push({ parent: item, children: [] });
    });

    return result;
  }, [visibleSchedule]);

  if (!isGuided) {
    return (
      <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'grey.50' }}>
        <CardContent sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" fontWeight="bold">{title ?? '支援手順 (Plan)'}</Typography>
        </CardContent>
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>{props.children}</Box>
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'grey.50' }}>
      <CardContent sx={{ py: 1, px: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="subtitle2" fontWeight="bold">
            {title ?? '支援手順 (Plan)'}
          </Typography>
          {onEdit && <IconButton onClick={onEdit} size="small" color="primary"><EditIcon fontSize="small" /></IconButton>}
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {typeof unfilledCount === 'number' && (
              <Chip label={`${unfilledCount}/${totalCount}`} size="small" variant="outlined" sx={{ height: 22 }} />
            )}
            {onToggleUnfilledOnly && (
              <Switch checked={showUnfilledOnly} onChange={onToggleUnfilledOnly} size="small" color="primary" />
            )}
          </Box>
        </Box>
      </CardContent>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
        <List disablePadding>
          {groupedSchedule.map(({ parent, children }) => {
            const parentKey = getItemScheduleKey(parent);
            if (isHidden(parent)) {
              return (
                <Box key={parentKey} sx={{ mb: 1.5, p: 1.5, bgcolor: 'grey.100', borderRadius: 1.5, border: '1px dashed', borderColor: 'grey.300', textAlign: 'center' }}>
                  <Typography variant="caption" color="text.primary" sx={{ fontWeight: 500 }}>
                    {parent.activity}：外活動ルート選択中のため、この手順は不要です
                  </Typography>
                </Box>
              );
            }

            return (
              <Box key={parentKey} sx={{ mb: 1.5 }}>
                <ProcedureStepRow
                  item={parent}
                  isSelected={selectedStepId === parentKey}
                  isFilled={filledStepIds.has(parentKey)}
                  onSelect={onSelectStep}
                  selectableState={selectableStateByStepId?.get(parentKey)}
                />

                {children.length > 0 && (
                  <Box sx={{ ml: 3, mt: 0.5, borderLeft: '2px solid', borderColor: 'divider', pl: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 700, fontSize: '0.65rem' }}>
                      【外活動オプション】
                    </Typography>
                    {children.map((child) => {
                      const childKey = getItemScheduleKey(child);
                      if (isHidden(child)) return null;

                      return (
                        <ProcedureStepRow
                          key={childKey}
                          item={child}
                          isSelected={selectedStepId === childKey}
                          isFilled={filledStepIds.has(childKey)}
                          onSelect={onSelectStep}
                          selectableState={selectableStateByStepId?.get(childKey)}
                          isChild
                        />
                      );
                    })}
                  </Box>
                )}
              </Box>
            );
          })}
        </List>

        {showUnfilledOnly && visibleSchedule.length === 0 && schedule.length > 0 && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">未記入の手順はありません。</Typography>
          </Box>
        )}
      </Box>
    </Card>
  );
};

export default memo(ProcedurePanel);
