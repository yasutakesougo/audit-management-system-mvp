/**
 * PlanSlotSelector — 時間帯選択 + 選択中の Plan 表示
 *
 * RecordPanel から抽出。スケジュールの時間帯チップ選択 + Activity/Instruction 表示。
 */
import { motionTokens } from '@/app/theme';
import { getScheduleKey } from '@/features/daily/domain/getScheduleKey';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { RefObject } from 'react';
import { memo, useEffect, useRef, useState } from 'react';
import type { ScheduleItem } from './ProcedurePanel';

type PlanSlotSelectorProps = {
  schedule: ScheduleItem[];
  effectiveSelectedSlotKey: string;
  selectedSlot: ScheduleItem | null;
  showEmptyState: boolean;
  slotSelected: boolean;
  isLocked: boolean;
  selectedActivityRef: RefObject<HTMLDivElement>;
  onSlotChange: (next: string) => void;
};

function PlanSlotSelector({
  schedule,
  effectiveSelectedSlotKey,
  selectedSlot,
  showEmptyState,
  slotSelected,
  isLocked,
  selectedActivityRef,
  onSlotChange,
}: PlanSlotSelectorProps): JSX.Element | null {
  // ── Fade-in transition on slot change ──
  const [contentOpacity, setContentOpacity] = useState(1);
  const prevSlotKeyRef = useRef(effectiveSelectedSlotKey);

  useEffect(() => {
    if (prevSlotKeyRef.current !== effectiveSelectedSlotKey && effectiveSelectedSlotKey) {
      // Trigger fade: dip to 0, then restore to 1 after a frame
      setContentOpacity(0);
      const raf = requestAnimationFrame(() => {
        setContentOpacity(1);
      });
      prevSlotKeyRef.current = effectiveSelectedSlotKey;
      return () => cancelAnimationFrame(raf);
    }
    prevSlotKeyRef.current = effectiveSelectedSlotKey;
  }, [effectiveSelectedSlotKey]);

  if (!schedule.length) {
    return (
      <Alert severity="info">
        ProcedurePanel 未選択のため時間割とリンクしていません。通常の行動記録が行えます。
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        対象の時間帯を選択 (Plan参照)
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1, mb: 2 }}>
        {schedule.map((item) => {
          const key = getScheduleKey(item.time, item.activity);
          const isSelected = effectiveSelectedSlotKey === key;
          return (
            <Chip
              key={key}
              label={item.time}
              color={isSelected ? 'primary' : 'default'}
              variant={isSelected ? 'filled' : 'outlined'}
              onClick={() => !isLocked && onSlotChange(key)}
              disabled={isLocked}
              sx={{ fontWeight: isSelected ? 'bold' : undefined, minWidth: 72 }}
            />
          );
        })}
      </Box>
      {/* Single Paper always mounted to prevent DOM swap flicker */}
      <Paper
        ref={selectedActivityRef}
        variant="outlined"
        sx={{
          p: 2,
          bgcolor: 'background.paper',
          borderColor: selectedSlot ? 'primary.main' : 'divider',
          transition: motionTokens.transition.fadeBorder,
          boxShadow: 0,
          minHeight: { xs: 140, md: 180 },
          display: 'flex',
          // GPU compositing optimization (prevent subpixel artifacts)
          isolation: 'isolate',
          contain: 'paint',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
        }}
      >
        {showEmptyState ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              時間帯を選択すると、支援内容(Plan)が表示されます
            </Typography>
          </Box>
        ) : selectedSlot ? (
          <Box
            sx={{
              opacity: contentOpacity,
              transition: motionTokens.transition.fadeContent,
              width: '100%',
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ width: '100%' }}>
              <Box flex={1}>
                <Typography variant="caption" color="text.secondary" fontWeight="bold">
                  本人のやること (Activity)
                </Typography>
                <Typography variant="body1" fontWeight="bold">
                  {selectedSlot.activity}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedSlot.time}
                </Typography>
              </Box>
              <Box
                flex={1.5}
                sx={{
                  borderLeft: '3px solid',
                  borderLeftColor: 'primary.main',
                  pl: 1.5,
                  bgcolor: 'primary.50',
                  borderRadius: 1,
                  py: 1,
                }}
              >
                <Typography variant="caption" color="primary.dark" fontWeight="bold">
                  📋 支援者のやること (Instruction)
                </Typography>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', fontWeight: 500 }}>
                  {selectedSlot.instruction}
                </Typography>
              </Box>
            </Stack>
          </Box>
        ) : null}
      </Paper>
      {!slotSelected ? (
        <Alert severity="info" sx={{ mt: 1 }}>
          💡 上の時間帯チップを選択すると、Plan の内容が表示されます。
        </Alert>
      ) : null}
    </Box>
  );
}

export default memo(PlanSlotSelector);
