import HealthObservationPage from '@/pages/HealthObservationPage';
import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'Nurse/Pages/Observation Workspace',
  component: HealthObservationPage,
  parameters: {
    layout: 'fullscreen',
    router: {
      initialEntries: ['/nurse/observation'],
    },
  },
  args: {},
  tags: ['a11y'],
} satisfies Meta<typeof HealthObservationPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ObservationWorkspace: Story = {
  name: 'Observation Workspace',
  render: () => <HealthObservationPage />,
};
