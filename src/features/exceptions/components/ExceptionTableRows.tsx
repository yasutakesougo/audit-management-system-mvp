import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { EmptyStateAction } from '@/components/ui/EmptyStateAction';
import type { FlatWithGroupInfo } from '../domain/groupExceptionsByParent';
import { EXCEPTION_CATEGORIES } from '../domain/exceptionLogic';
import {
  TEMPERATURE_LABELS,
  severityToPriority,
} from '../domain/mapSuggestionToException';
import { SEVERITY_CONFIG } from './ExceptionTable.logic';
import { CorrectiveActionsCell } from './CorrectiveActionsCell';
import type {
  ExceptionDisplayRow,
  ExceptionTableDisplayMode,
  ExceptionTableSuggestionActions,
} from './ExceptionTable.types';

type ExceptionTableRowsProps = {
  sourceItemCount: number;
  displayRows: ExceptionDisplayRow[];
  displayMode: ExceptionTableDisplayMode;
  parentChildGroups: FlatWithGroupInfo[];
  collapsedParents: Set<string>;
  onToggleParent: (parentId: string) => void;
  expandedGroups: Record<string, boolean>;
  onToggleGroup: (groupId: string) => void;
  onNavigate: (path: string) => void;
  suggestionActions?: ExceptionTableSuggestionActions;
};

const FlatItemRow: React.FC<{
  row: ExceptionDisplayRow & { kind: 'item' };
  displayMode: ExceptionTableDisplayMode;
  parentChildGroups: FlatWithGroupInfo[];
  collapsedParents: Set<string>;
  onToggleParent: (parentId: string) => void;
  onNavigate: (path: string) => void;
  suggestionActions?: ExceptionTableSuggestionActions;
}> = ({
  row,
  displayMode,
  parentChildGroups,
  collapsedParents,
  onToggleParent,
  onNavigate,
  suggestionActions,
}) => {
  const item = row.item;
  const catMeta = EXCEPTION_CATEGORIES[item.category];
  const sevConfig = SEVERITY_CONFIG[item.severity];
  const isChild = Boolean(item.parentId);
  const parentGroup =
    displayMode === 'flat'
      ? parentChildGroups.find((g) => g.kind === 'parent' && g.item.id === item.id)
      : undefined;
  const isParent = parentGroup?.kind === 'parent';
  const childCount = isParent ? parentGroup.childCount : 0;
  const isCollapsed = isParent && collapsedParents.has(item.id);

  if (isChild && item.parentId && collapsedParents.has(item.parentId)) {
    return null;
  }

  return (
    <TableRow
      key={item.id}
      hover
      sx={{
        borderLeft: 4,
        borderLeftColor: isChild ? 'transparent' : catMeta.color,
        '&:last-child td': { borderBottom: 0 },
        ...(isChild && {
          bgcolor: 'action.hover',
        }),
        ...(isParent && {
          cursor: 'pointer',
        }),
      }}
      onClick={isParent ? () => onToggleParent(item.id) : undefined}
      data-testid={`exception-row-${item.id}`}
    >
      <TableCell>
        {isParent && (
          <IconButton
            size="small"
            sx={{ p: 0, mr: 0.5 }}
            aria-label={isCollapsed ? '子例外を展開' : '子例外を折りたたむ'}
            data-testid={`exception-toggle-${item.id}`}
          >
            {isCollapsed ? (
              <ChevronRightIcon sx={{ fontSize: 16 }} />
            ) : (
              <ExpandMoreIcon sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        )}
        {isChild && (
          <Box
            component="span"
            sx={{
              display: 'inline-block',
              width: 12,
              height: 12,
              borderLeft: '2px solid',
              borderBottom: '2px solid',
              borderColor: 'grey.400',
              borderRadius: '0 0 0 4px',
              mr: 0.5,
              mb: -0.25,
            }}
          />
        )}
        <Chip
          label={
            item.category === 'corrective-action'
              ? TEMPERATURE_LABELS[severityToPriority(item.severity) ?? 'P2'] ??
                sevConfig.label
              : sevConfig.label
          }
          size="small"
          color={sevConfig.color}
          sx={{ fontWeight: 600, fontSize: '0.7rem' }}
        />
      </TableCell>
      <TableCell>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Box sx={{ fontSize: 14, ...(isChild && { opacity: 0.5 }) }}>
            {catMeta.icon}
          </Box>
          <Typography
            variant="caption"
            sx={{ fontWeight: 600, ...(isChild && { color: 'text.secondary' }) }}
          >
            {isChild ? '└ 個別' : catMeta.label}
          </Typography>
        </Stack>
      </TableCell>
      <TableCell sx={isChild ? { pl: 3 } : undefined}>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, ...(isChild && { fontSize: '0.8rem' }) }}
          >
            {item.title}
          </Typography>
          {isParent && childCount > 0 && (
            <Chip
              label={`${childCount}件`}
              size="small"
              variant="outlined"
              sx={{
                fontSize: '0.65rem',
                height: 18,
                '& .MuiChip-label': { px: 0.5 },
              }}
            />
          )}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {item.description}
        </Typography>
        {item.remediationProposal && (
          <Box sx={{ 
            mt: 0.5, 
            p: 0.75, 
            bgcolor: 'primary.50', 
            borderRadius: 0.5, 
            borderLeft: '2px solid', 
            borderColor: 'primary.main' 
          }}>
            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', color: 'primary.dark', lineHeight: 1.2 }}>
              💡 推奨修復: {item.remediationProposal.impact}
            </Typography>
          </Box>
        )}
      </TableCell>
      <TableCell>
        {item.targetUserId ? (
          <Button
            variant="text"
            size="small"
            sx={{
              textTransform: 'none',
              p: 0,
              minWidth: 'auto',
              fontWeight: 600,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(`/users/${item.targetUserId}`);
            }}
            data-testid={`exception-user-link-${item.id}`}
          >
            {item.targetUser ?? '—'}
          </Button>
        ) : (
          <Typography variant="body2">{item.targetUser ?? '—'}</Typography>
        )}
      </TableCell>
      <TableCell>
        <Typography variant="caption" color="text.secondary">
          {item.targetDate ?? item.updatedAt}
        </Typography>
      </TableCell>
      <TableCell sx={{ minWidth: 160 }}>
        <CorrectiveActionsCell
          item={item}
          onNavigate={onNavigate}
          suggestionActions={suggestionActions}
        />
      </TableCell>
    </TableRow>
  );
};

const GroupedRow: React.FC<{
  row: ExceptionDisplayRow & { kind: 'corrective-group' };
  expandedGroups: Record<string, boolean>;
  onToggleGroup: (groupId: string) => void;
  onNavigate: (path: string) => void;
  suggestionActions?: ExceptionTableSuggestionActions;
}> = ({ row, expandedGroups, onToggleGroup, onNavigate, suggestionActions }) => {
  const { group, representative } = row;
  const catMeta = EXCEPTION_CATEGORIES[representative.category];
  const sevConfig = SEVERITY_CONFIG[representative.severity];
  const isExpanded = expandedGroups[group.userId] ?? false;
  const canExpand = group.items.length > 1;
  const userName =
    group.userName ??
    representative.targetUser ??
    (group.userId === '__unknown__' ? '共通・その他' : '—');
  const canOpenUser = group.userId !== '__unknown__';
  const groupTitle =
    group.userId === '__unknown__'
      ? `共通・その他の例外 (${group.count}件)`
      : `${userName} の例外 (${group.count}件)`;

  return (
    <React.Fragment key={`group-${group.userId}`}>
      <TableRow
        hover
        sx={{
          borderLeft: 4,
          borderLeftColor: catMeta.color,
        }}
        data-testid={`exception-row-${representative.id}`}
      >
        <TableCell>
          <Chip
            label={
              TEMPERATURE_LABELS[severityToPriority(representative.severity) ?? 'P2'] ??
              sevConfig.label
            }
            size="small"
            color={sevConfig.color}
            sx={{ fontWeight: 600, fontSize: '0.7rem' }}
          />
        </TableCell>
        <TableCell>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Box sx={{ fontSize: 14 }}>{catMeta.icon}</Box>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              {catMeta.label}
            </Typography>
          </Stack>
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {groupTitle}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {representative.description}
            {group.count > 1 ? ` / 他 ${group.count - 1} 件` : ''}
          </Typography>
        </TableCell>
        <TableCell>
          {canOpenUser ? (
            <Button
              variant="text"
              size="small"
              sx={{ textTransform: 'none', p: 0, minWidth: 'auto', fontWeight: 600 }}
              onClick={() => onNavigate(`/users/${group.userId}`)}
              data-testid={`exception-user-link-${representative.id}`}
            >
              {userName}
            </Button>
          ) : (
            <Typography variant="body2">{userName}</Typography>
          )}
        </TableCell>
        <TableCell>
          <Typography variant="caption" color="text.secondary">
            {representative.targetDate ?? representative.updatedAt}
          </Typography>
        </TableCell>
        <TableCell sx={{ minWidth: 180 }}>
          <Stack spacing={0.5} alignItems="flex-start">
            <CorrectiveActionsCell
              item={representative}
              onNavigate={onNavigate}
              suggestionActions={suggestionActions}
            />
            {canExpand && (
              <Button
                size="small"
                variant="text"
                sx={{ textTransform: 'none', p: 0, minHeight: 'auto' }}
                onClick={() => onToggleGroup(group.userId)}
                data-testid={`exception-group-toggle-${group.userId}`}
              >
                {isExpanded ? '個別例外を隠す' : '個別例外を表示'} ({group.count})
              </Button>
            )}
          </Stack>
        </TableCell>
      </TableRow>
      {canExpand && isExpanded && (
        <TableRow data-testid={`exception-group-details-${group.userId}`}>
          <TableCell colSpan={6} sx={{ bgcolor: 'action.hover', py: 1.25 }}>
            <Stack spacing={1}>
              {group.items.map((item) => {
                const detailConfig = SEVERITY_CONFIG[item.severity];
                return (
                  <Paper
                    key={item.id}
                    variant="outlined"
                    sx={{ p: 1, borderRadius: 1, bgcolor: 'background.paper' }}
                  >
                    <Stack spacing={0.75}>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <Chip
                          label={
                            TEMPERATURE_LABELS[severityToPriority(item.severity) ?? 'P2'] ??
                            detailConfig.label
                          }
                          size="small"
                          color={detailConfig.color}
                          sx={{ fontWeight: 600, fontSize: '0.65rem' }}
                        />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {item.title}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {item.description}
                      </Typography>
                      <CorrectiveActionsCell
                        item={item}
                        onNavigate={onNavigate}
                        suggestionActions={suggestionActions}
                      />
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          </TableCell>
        </TableRow>
      )}
    </React.Fragment>
  );
};

export const ExceptionTableRows: React.FC<ExceptionTableRowsProps> = ({
  sourceItemCount,
  displayRows,
  displayMode,
  parentChildGroups,
  collapsedParents,
  onToggleParent,
  expandedGroups,
  onToggleGroup,
  onNavigate,
  suggestionActions,
}) => {
  if (displayRows.length === 0) {
    return (
      <EmptyStateAction
        icon={sourceItemCount === 0 ? '🎉' : '🔍'}
        title={
          sourceItemCount === 0
            ? '例外なし — すべて正常です'
            : 'フィルタ条件に一致する例外はありません'
        }
        description={
          sourceItemCount === 0
            ? '現在、対応が必要な例外は見つかっていません。'
            : 'フィルタ条件を変更してください。'
        }
        variant={sourceItemCount === 0 ? 'success' : 'info'}
        testId="exception-table-empty"
      />
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'action.hover' }}>
            <TableCell sx={{ fontWeight: 700, width: 80, color: 'text.primary' }}>重要度</TableCell>
            <TableCell sx={{ fontWeight: 700, width: 120, color: 'text.primary' }}>種類</TableCell>
            <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>内容</TableCell>
            <TableCell sx={{ fontWeight: 700, width: 100, color: 'text.primary' }}>対象者</TableCell>
            <TableCell sx={{ fontWeight: 700, width: 100, color: 'text.primary' }}>日付</TableCell>
            <TableCell sx={{ fontWeight: 700, width: 160, color: 'text.primary' }}>是正アクション</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {displayRows.map((row) => {
            if (row.kind === 'item') {
              return (
                <FlatItemRow
                  key={row.item.id}
                  row={row}
                  displayMode={displayMode}
                  parentChildGroups={parentChildGroups}
                  collapsedParents={collapsedParents}
                  onToggleParent={onToggleParent}
                  onNavigate={onNavigate}
                  suggestionActions={suggestionActions}
                />
              );
            }

            return (
              <GroupedRow
                key={`group-${row.group.userId}`}
                row={row}
                expandedGroups={expandedGroups}
                onToggleGroup={onToggleGroup}
                onNavigate={onNavigate}
                suggestionActions={suggestionActions}
              />
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
