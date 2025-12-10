import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import NurseSyncHud from './NurseSyncHud';

const meta = {
  title: 'Nurse/Status/SyncHUD',
  component: NurseSyncHud,
  args: { compact: false },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof NurseSyncHud>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Ok: Story = {
  name: 'Success State',
  parameters: {
    globals: {
      nurseMode: 'ok',
      bulkEntry: true,
    },
    docs: {
      description: {
        story: 'HUD showing successful sync state with all entries processed correctly.',
      },
    },
  },
};

export const Partial: Story = {
  name: 'Partial Sync State',
  parameters: {
    globals: {
      nurseMode: 'partial',
      bulkEntry: true,
    },
    docs: {
      description: {
        story: 'HUD showing partial sync state where some entries succeeded and others failed.',
      },
    },
  },
};

export const Error: Story = {
  name: 'Error State',
  parameters: {
    globals: {
      nurseMode: 'error',
      bulkEntry: true,
    },
    docs: {
      description: {
        story: 'HUD showing error state where sync operations failed.',
      },
    },
  },
};

export const Compact: Story = {
  name: 'Compact Mode',
  args: { compact: true },
  parameters: {
    globals: {
      nurseMode: 'partial',
      bulkEntry: true,
    },
    docs: {
      description: {
        story: 'Compact HUD that hides detailed entries breakdown for minimal screen real estate usage.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('NURSE_SYNC_HUD')).toBeVisible();
    await expect(canvas.getByTestId('NURSE_SYNC_MINUTE_LABEL')).toBeVisible();
  },
};

export const LocalMinuteBasis: Story = {
  name: 'Local Time Basis',
  args: { minuteBasis: 'local' },
  parameters: {
    globals: {
      nurseMode: 'ok',
      minuteBasis: 'local',
      bulkEntry: true,
    },
    docs: {
      description: {
        story: 'HUD using local time basis for minute labels instead of UTC.',
      },
    },
  },
};

export const AlwaysShow: Story = {
  name: 'Always Visible (Including Pending)',
  args: { showWhen: 'always' },
  parameters: {
    globals: {
      nurseMode: 'ok',
      bulkEntry: true,
    },
    docs: {
      description: {
        story: 'HUD configured to show even during pending sync states.',
      },
    },
  },
};