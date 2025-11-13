import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { Meta, StoryObj } from '@storybook/react';
import VitalCard from './VitalCard';

const meta: Meta<typeof VitalCard> = {
  title: 'Nurse/Components/VitalCard Thresholds',
  component: VitalCard,
};

export default meta;

type Story = StoryObj<typeof VitalCard>;

export const TemperatureSweep: Story = {
  name: 'Temperature (36.6 / 37.5 / 38.0)',
  render: () => {
    const values = [36.6, 37.5, 38.0];
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, width: 720 }}>
        {values.map((value) => (
          <Box key={value}>
            <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>
              {value}℃
            </Typography>
            <VitalCard
              label="体温"
              unit="℃"
              value={value}
              onChange={() => undefined}
              isDanger={value >= 38 || value < 34}
              step={0.1}
            />
          </Box>
        ))}
      </Box>
    );
  },
};

export const SpO2Sweep: Story = {
  name: 'SpO2 (97 / 93 / 92)',
  render: () => {
    const values = [97, 93, 92];
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, width: 720 }}>
        {values.map((value) => (
          <Box key={value}>
            <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>
              {value}%
            </Typography>
            <VitalCard
              label="SpO2"
              unit="%"
              value={value}
              onChange={() => undefined}
              isDanger={value <= 92}
              step={1}
            />
          </Box>
        ))}
      </Box>
    );
  },
};
