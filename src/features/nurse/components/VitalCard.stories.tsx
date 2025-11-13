import { thresholds } from '@/features/nurse/constants/thresholds';
import { TESTIDS } from '@/testids';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import React from 'react';
import VitalCard from './VitalCard';

type VitalCardProps = React.ComponentProps<typeof VitalCard>;

const WeightPreviewCard: React.FC<{
  label: string;
  value: number;
  baseline: number;
  note: string;
}> = ({ label, value, baseline, note }) => {
  const [current, setCurrent] = React.useState<number>(value);
  React.useEffect(() => {
    setCurrent(value);
  }, [value]);
  const helpId = React.useId();
  const delta = Math.abs(current - baseline);
  const outOfRange = current < thresholds.weight.min || current > thresholds.weight.max;
  const danger = outOfRange || delta >= thresholds.weight.deltaDanger;
  const warn = !danger && delta >= thresholds.weight.deltaWarn;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="subtitle2">{label}</Typography>
      <Typography
        id={helpId}
        variant="caption"
        sx={{ color: danger ? 'error.main' : warn ? 'warning.main' : 'text.secondary' }}
      >
        {note}
      </Typography>
      <VitalCard
        label="体重"
        unit="kg"
        value={current}
        step={0.1}
        isDanger={danger}
        describedById={helpId}
        onChange={setCurrent}
      />
    </Box>
  );
};

const meta = {
  title: 'Nurse/Components/VitalCard',
  component: VitalCard,
  args: {
    label: '体温',
    unit: '℃',
    value: 36.6,
    step: 0.1,
    isDanger: false,
  },
  tags: ['autodocs'],
} satisfies Meta<typeof VitalCard>;

export default meta;

type Story = StoryObj<typeof VitalCard>;

function resolveVitalArgs<T extends VitalCardProps>(args: Partial<T> | undefined, fallback: T): T {
  return {
    ...fallback,
    ...(args ?? {}),
  } as T;
}

export const Temperature: Story = {
  render: (args: Story['args'] = {}) => {
    const props = resolveVitalArgs(args, {
      label: '体温',
      unit: '℃',
      value: 36.6,
      step: 0.1,
      isDanger: false,
      describedById: undefined,
      inputRef: undefined,
      onChange: () => undefined,
    });
    const [value, setValue] = React.useState<number>(props.value);
    React.useEffect(() => {
      setValue(props.value);
    }, [props.value]);
    const helpId = React.useId();

    return (
      <Box sx={{ width: 360 }}>
        <Typography id={helpId} variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          体温を + / − ボタンで上下して挙動を確認できます。
        </Typography>
        <VitalCard
          {...props}
          value={value}
          onChange={setValue}
          describedById={helpId}
          isDanger={
            Number.isFinite(value) &&
            (value >= thresholds.temp.danger ||
              value < thresholds.temp.min ||
              value > thresholds.temp.max)
          }
        />
      </Box>
    );
  },
};

export const Pulse: Story = {
  args: {
    label: '脈拍',
    unit: 'bpm',
    value: 76,
    step: 1,
    isDanger: false,
  },
  render: (args: Story['args'] = {}) => {
    const props = resolveVitalArgs(args, {
      label: '脈拍',
      unit: 'bpm',
      value: 76,
      step: 1,
      isDanger: false,
      describedById: undefined,
      inputRef: undefined,
      onChange: () => undefined,
    });
    const [value, setValue] = React.useState<number>(props.value);
    React.useEffect(() => {
      setValue(props.value);
    }, [props.value]);
    return (
      <VitalCard
        {...props}
        value={value}
        onChange={setValue}
        isDanger={
          Number.isFinite(value) &&
          (value < thresholds.pulse.warn[0] || value > thresholds.pulse.warn[1])
        }
      />
    );
  },
};

export const SpO2: Story = {
  args: {
    label: 'SpO2',
    unit: '%',
    value: 97,
    step: 1,
    isDanger: false,
  },
  render: (args: Story['args'] = {}) => {
    const props = resolveVitalArgs(args, {
      label: 'SpO2',
      unit: '%',
      value: 97,
      step: 1,
      isDanger: false,
      describedById: undefined,
      inputRef: undefined,
      onChange: () => undefined,
    });
    const [value, setValue] = React.useState<number>(props.value);
    React.useEffect(() => {
      setValue(props.value);
    }, [props.value]);
    return (
      <VitalCard
        {...props}
        value={value}
        onChange={setValue}
        isDanger={Number.isFinite(value) && value <= thresholds.spo2.danger}
      />
    );
  },
};

export const KeyboardIncrement: Story = {
  name: 'Keyboard: + ボタン→数値増分',
  render: Temperature.render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    const input = (await canvas.findByRole('textbox')) as HTMLInputElement;
    expect(input.value).toMatch(/36\.7|36,7/);
  },
};

export const ThresholdFlip: Story = {
  name: 'Keyboard: しきい値超過で aria-invalid 反転',
  render: Temperature.render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = (await canvas.findByRole('textbox')) as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, String(thresholds.temp.danger));
    expect(input).toHaveAttribute('aria-invalid', 'true');
  },
};

export const SpO2ThresholdFlip: Story = {
  name: 'Keyboard: SpO₂ しきい値で aria-invalid',
  render: SpO2.render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = (await canvas.findByRole('textbox')) as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, String(thresholds.spo2.danger));
    expect(input).toHaveAttribute('aria-invalid', 'true');
  },
};

export const PulseKeyboardIncrement: Story = {
  name: 'Keyboard: 脈拍 +1 増分と安全域',
  render: Pulse.render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    const input = (await canvas.findByRole('textbox')) as HTMLInputElement;
  expect(input.value).toMatch(/^77[.,]?/);
    expect(input).not.toHaveAttribute('aria-invalid', 'true');
  },
};

export const WeightGallery: Story = {
  name: 'Weight: ±Δギャラリー',
  render: () => {
    const baseline = 36.5;
    const samples = [
      { label: '基準 36.5kg', value: baseline, note: '比較の基準値' },
      { label: '+1.0kg (注意)', value: baseline + thresholds.weight.deltaWarn, note: '前回比 +1.0kg ／注意域' },
      { label: '-1.0kg (注意)', value: baseline - thresholds.weight.deltaWarn, note: '前回比 -1.0kg ／注意域' },
      { label: '+2.0kg (危険)', value: baseline + thresholds.weight.deltaDanger, note: '前回比 +2.0kg ／危険域' },
      { label: '-2.0kg (危険)', value: baseline - thresholds.weight.deltaDanger, note: '前回比 -2.0kg ／危険域' },
    ];

    return (
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
        {samples.map((sample) => (
          <WeightPreviewCard key={sample.label} {...sample} baseline={baseline} />
        ))}
      </Box>
    );
  },
};

export const WeightKeyboardIncrement: Story = {
  name: 'Weight: Tab → Enter 増分',
  render: () => {
    const baseline = 60.0;
    const [value, setValue] = React.useState<number>(baseline);
    const delta = Math.abs(value - baseline);
    const danger =
      !Number.isFinite(value) ||
      value < thresholds.weight.min ||
      value > thresholds.weight.max ||
      delta >= thresholds.weight.deltaDanger;

    return (
      <VitalCard
        label="体重"
        unit="kg"
        value={value}
        step={0.1}
        isDanger={danger}
        onChange={setValue}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    const input = (await canvas.findByTestId(TESTIDS.NURSE_OBS_WEIGHT_INPUT)) as HTMLInputElement;
    expect(input.value).toMatch(/^60\.1/);
    expect(input).not.toHaveAttribute('aria-invalid', 'true');
  },
};

export const WeightThresholdFlip: Story = {
  name: 'Weight: Δ2.0kg で危険域',
  render: () => {
    const baseline = 60.0;
    const [value, setValue] = React.useState<number>(baseline + thresholds.weight.deltaDanger - 0.1);
    const delta = Math.abs(value - baseline);
    const danger =
      !Number.isFinite(value) ||
      value < thresholds.weight.min ||
      value > thresholds.weight.max ||
      delta >= thresholds.weight.deltaDanger;

    return (
      <VitalCard
        label="体重"
        unit="kg"
        value={value}
        step={0.1}
        isDanger={danger}
        onChange={setValue}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const plus = await canvas.findByRole('button', { name: '体重を増やす' });
    await userEvent.click(plus);
    const input = (await canvas.findByTestId(TESTIDS.NURSE_OBS_WEIGHT_INPUT)) as HTMLInputElement;
    expect(input).toHaveAttribute('aria-invalid', 'true');
  },
};
