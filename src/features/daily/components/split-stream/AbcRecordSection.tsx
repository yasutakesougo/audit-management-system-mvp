/**
 * AbcRecordSection — ABC(問題行動)記録セクション
 *
 * RecordPanel から抽出。行動選択、強度スライダー、先行事象・結果選択。
 */
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { memo, useMemo } from 'react';
import { type BehaviorIntensity, DEFAULT_OBSERVATION_MASTER } from '@/domain/behavior';

type AbcRecordSectionProps = {
  selectedBehavior: string | null;
  selectedAntecedent: string | null;
  selectedConsequence: string | null;
  intensity: BehaviorIntensity;
  isLocked: boolean;
  onBehaviorChange: (value: string | null) => void;
  onAntecedentChange: (value: string | null) => void;
  onConsequenceChange: (value: string | null) => void;
  onIntensityChange: (value: BehaviorIntensity) => void;
};

function AbcRecordSection({
  selectedBehavior,
  selectedAntecedent,
  selectedConsequence,
  intensity,
  isLocked,
  onBehaviorChange,
  onAntecedentChange,
  onConsequenceChange,
  onIntensityChange,
}: AbcRecordSectionProps): JSX.Element {
  const chipSize = useMemo(() => ({ py: 1.2, px: 1.5, fontSize: '0.95rem' }), []);

  return (
    <>
      <Divider>
        <Chip label="問題行動があった場合のみ入力" size="small" />
      </Divider>

      <Box>
        <Typography variant="caption" color="text.secondary">
          特異行動・インシデント (ABC記録)
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
          {DEFAULT_OBSERVATION_MASTER.behaviors.map((behavior) => {
            const isSelected = selectedBehavior === behavior;
            return (
              <Chip
                key={behavior}
                label={behavior}
                color={isSelected ? 'error' : 'default'}
                variant={isSelected ? 'filled' : 'outlined'}
                onClick={() => !isLocked && onBehaviorChange(selectedBehavior === behavior ? null : behavior)}
                sx={chipSize}
                disabled={isLocked}
              />
            );
          })}
        </Box>
      </Box>

      {selectedBehavior && (
        <Box sx={{ animation: 'fadeIn 0.3s ease', pl: 2, borderLeft: '4px solid', borderColor: 'error.light' }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                強度 (Intensity)
              </Typography>
              <Slider
                value={intensity}
                min={1}
                max={5}
                step={1}
                marks
                valueLabelDisplay="auto"
                onChange={(_, value) => onIntensityChange(value as BehaviorIntensity)}
                sx={{ color: 'error.main' }}
                data-testid="behavior-intensity-slider"
                disabled={isLocked}
              />
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">
                直前の状況 (Antecedent)
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                {DEFAULT_OBSERVATION_MASTER.antecedents.map((antecedent) => (
                  <Chip
                    key={antecedent}
                    label={antecedent}
                    size="small"
                    color={selectedAntecedent === antecedent ? 'primary' : 'default'}
                    onClick={() =>
                      onAntecedentChange(selectedAntecedent === antecedent ? null : antecedent)
                    }
                    disabled={isLocked}
                  />
                ))}
              </Box>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">
                対応・結果 (Consequence)
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                {DEFAULT_OBSERVATION_MASTER.consequences.map((consequence) => (
                  <Chip
                    key={consequence}
                    label={consequence}
                    size="small"
                    color={selectedConsequence === consequence ? 'success' : 'default'}
                    onClick={() =>
                      onConsequenceChange(selectedConsequence === consequence ? null : consequence)
                    }
                    disabled={isLocked}
                  />
                ))}
              </Box>
            </Box>
          </Stack>
        </Box>
      )}
    </>
  );
}

export default memo(AbcRecordSection);
