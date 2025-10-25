import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TimeFlowSupportRecordPage from '@/pages/TimeFlowSupportRecordPage';
import { FeatureFlagsProvider, featureFlags } from '@/config/featureFlags';

// Mock dependencies
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({}),
    useNavigate: () => vi.fn(),
  };
});

const mockUsers = [
  { Id: '1', FullName: 'User A', IsActive: true, IsSupportProcedureTarget: true, planType: '個別' },
  { Id: '2', FullName: 'User B', IsActive: true, IsSupportProcedureTarget: true, planType: '個別' },
];

const mockActivities = [
    { time: '10:00', title: 'Activity 1', personTodo: 'Todo 1', supporterTodo: 'Support 1', stage: 'proactive' },
    { time: '11:00', title: 'Activity 2', personTodo: 'Todo 2', supporterTodo: 'Support 2', stage: 'earlyResponse' },
];

vi.mock('@/features/users/store', () => ({
  useUsersStore: vi.fn(() => ({
    data: mockUsers,
  })),
}));

vi.mock('@/features/planDeployment/supportFlow', () => ({
  resolveSupportFlowForUser: () => ({ activities: mockActivities }),
  fallbackSupportActivities: [],
}));

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('TimeFlowSupportRecordPage', () => {
  it('renders the main heading', () => {
    render(
      <FeatureFlagsProvider value={{ ...featureFlags, schedules: true }}>
        <MemoryRouter>
          <TimeFlowSupportRecordPage />
        </MemoryRouter>
      </FeatureFlagsProvider>
    );

    expect(screen.getByRole('heading', { name: '支援手順兼記録' })).toBeInTheDocument();
  });

  it('shows user records when a user is selected', async () => {
    render(
      <FeatureFlagsProvider value={{ ...featureFlags, schedules: true }}>
        <MemoryRouter>
          <TimeFlowSupportRecordPage />
        </MemoryRouter>
      </FeatureFlagsProvider>
    );

    const userAButtons = screen.getAllByText('User A');
    fireEvent.click(userAButtons[0]);

    expect(await screen.findByText('記録サマリー - User A')).toBeInTheDocument();
  });

  it('switches between input and review tabs', async () => {
    render(
      <FeatureFlagsProvider value={{ ...featureFlags, schedules: true }}>
        <MemoryRouter>
          <TimeFlowSupportRecordPage />
        </MemoryRouter>
      </FeatureFlagsProvider>
    );

    const userAButtons = screen.getAllByText('User A');
    fireEvent.click(userAButtons[0]);
    
    // Wait for the content to be loaded
    await screen.findByText('記録サマリー - User A');

    const inputTab = screen.getByRole('tab', { name: '記録入力' });
    const reviewTab = screen.getByRole('tab', { name: '記録閲覧' });

    fireEvent.click(reviewTab);
    expect(reviewTab).toHaveAttribute('aria-selected', 'true');
    
    fireEvent.click(inputTab);
    expect(inputTab).toHaveAttribute('aria-selected', 'true');
  });

  it('filters users by search term', () => {
    render(
      <FeatureFlagsProvider value={{ ...featureFlags, schedules: true }}>
        <MemoryRouter>
          <TimeFlowSupportRecordPage />
        </MemoryRouter>
      </FeatureFlagsProvider>
    );

    const searchInput = screen.getByRole('textbox', { name: '利用者名で検索' });
    fireEvent.change(searchInput, { target: { value: 'User A' } });

    expect(screen.getByText('User A')).toBeInTheDocument();
    expect(screen.queryByText('User B')).not.toBeInTheDocument();
  });

  it('stepper functionality works', async () => {
    render(
      <FeatureFlagsProvider value={{ ...featureFlags, schedules: true }}>
        <MemoryRouter>
          <TimeFlowSupportRecordPage />
        </MemoryRouter>
      </FeatureFlagsProvider>
    );

    const userAButtons = screen.getAllByText('User A');
    fireEvent.click(userAButtons[0]);

    await screen.findByText('記録サマリー - User A');

    const nextButton = screen.getByRole('button', { name: '次へ' });
    const prevButton = screen.getByRole('button', { name: '前へ' });

    expect(screen.getByText('1 / 2 件')).toBeInTheDocument();
    expect(screen.getByText('10:00 Activity 1')).toBeInTheDocument();

    fireEvent.click(nextButton);

    expect(screen.getByText('2 / 2 件')).toBeInTheDocument();
    expect(screen.getByText('11:00 Activity 2')).toBeInTheDocument();

    fireEvent.click(prevButton);

    expect(screen.getByText('1 / 2 件')).toBeInTheDocument();
    expect(screen.getByText('10:00 Activity 1')).toBeInTheDocument();
  });

  it('creates a new record', async () => {
    render(
      <FeatureFlagsProvider value={{ ...featureFlags, schedules: true }}>
        <MemoryRouter>
          <TimeFlowSupportRecordPage />
        </MemoryRouter>
      </FeatureFlagsProvider>
    );

    const userAButtons = screen.getAllByText('User A');
    fireEvent.click(userAButtons[0]);

    await screen.findByText('記録サマリー - User A');

    const firstAccordion = screen.getAllByRole('button', { name: /Activity 1/i })[0];
    fireEvent.click(firstAccordion);

    const moodChip = screen.getByText('落ち着いている');
    fireEvent.click(moodChip);

    const notesInput = screen.getByLabelText('特記事項');
    fireEvent.change(notesInput, { target: { value: 'Test note' } });

    const saveButton = screen.getByTestId('supportProcedures.form.save');
    fireEvent.click(saveButton);

    // Accordion should close, so the notes input should not be visible
    expect(screen.queryByLabelText('特記事項')).not.toBeInTheDocument();
  });

  it('falls back to in-memory storage when localStorage is not available', () => {
    // Mock localStorage to throw an error
    const localStorageMock = (() => {
      let store: { [key: string]: string } = {};
      return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
          throw new Error('localStorage is not available');
        },
        removeItem: (key: string) => {
          delete store[key];
        },
        clear: () => {
          store = {};
        },
      };
    })();
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });

    render(
      <FeatureFlagsProvider value={{ ...featureFlags, schedules: true }}>
        <MemoryRouter>
          <TimeFlowSupportRecordPage />
        </MemoryRouter>
      </FeatureFlagsProvider>
    );

    const headings = screen.getAllByRole('heading', { name: '支援手順兼記録' });
    expect(headings.length).toBe(1);
  });
});
