import Box from '@mui/material/Box';
import type { Meta, StoryObj } from '@storybook/react';
import { userEvent } from '@storybook/test';
import React from 'react';
import TagPills from './TagPills';

const meta: Meta<typeof TagPills> = {
  title: 'Nurse/Components/TagPills',
  component: TagPills,
  args: {
    options: ['顔色良好', 'やや眠気', '食欲低下', '咳あり', '便秘傾向'],
    value: ['顔色良好'],
  },
};

export default meta;

type Story = StoryObj<typeof TagPills>;

export const Basic: Story = {
  render: (args: Story['args'] = {}) => {
    const options = (args?.options ?? meta.args?.options ?? []) as string[];
    const initialValue = (args?.value ?? meta.args?.value ?? []) as string[];
    const valueSignature = React.useMemo(() => initialValue.join('|'), [initialValue]);
    const [value, setValue] = React.useState<string[]>(initialValue);

    React.useEffect(() => {
      setValue(initialValue);
    }, [valueSignature]);

    return (
      <Box sx={{ width: 520 }}>
        <TagPills
          options={options}
          value={value}
          onChange={setValue}
        />
      </Box>
    );
  },
};

export const KeyboardToggle: Story = {
  args: {
    options: ['顔色良好', 'やや眠気', '食欲低下'],
    value: [],
  },
  play: async () => {
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
  },
};
