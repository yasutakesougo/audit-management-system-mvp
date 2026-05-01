import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { ExecutionToggle } from '../ExecutionToggle';
import { useExecutionRecord } from '../../../hooks/useExecutionRecord';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// Mock the hook to isolate UI testing from store/async complexity
vi.mock('../../../hooks/useExecutionRecord', () => ({
  useExecutionRecord: vi.fn(),
}));

// Mock MUI Tooltip to avoid portal/animation issues
vi.mock('@mui/material/Tooltip', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));

// Silent theme to suppress ripple/transition noise
const theme = createTheme({
  components: {
    MuiButtonBase: { defaultProps: { disableRipple: true } },
    MuiToggleButton: { defaultProps: { disableRipple: true } },
  },
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

const TEST_SLOT = 'slot-0900';

describe('ExecutionToggle (UI)', () => {
  const mockSetStatus = vi.fn();
  const mockSetMemo = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useExecutionRecord).mockReturnValue({
      record: { status: 'unrecorded', memo: '' },
      setStatus: mockSetStatus,
      setMemo: mockSetMemo,
      isLoading: false,
    } as unknown as ReturnType<typeof useExecutionRecord>);
  });

  afterEach(() => {
    cleanup();
  });

  it('calls setStatus when a button is clicked', async () => {
    const user = userEvent.setup();
    render(<ExecutionToggle date="2025-01-01" userId="U1" scheduleItemId={TEST_SLOT} />, { wrapper: Wrapper });

    const completedBtn = await screen.findByTestId(`exec-btn-completed-${TEST_SLOT}`);
    
    // Wrap in act to ensure all MUI internal state updates are captured
    await act(async () => {
      await user.click(completedBtn);
    });

    expect(mockSetStatus).toHaveBeenCalledWith('completed');
  });

  it('shows memo field and calls setMemo', async () => {
    vi.mocked(useExecutionRecord).mockReturnValue({
      record: { status: 'triggered', memo: 'initial' },
      setStatus: mockSetStatus,
      setMemo: mockSetMemo,
      isLoading: false,
    } as unknown as ReturnType<typeof useExecutionRecord>);

    render(<ExecutionToggle date="2025-01-01" userId="U1" scheduleItemId={TEST_SLOT} />, { wrapper: Wrapper });

    const input = await screen.findByPlaceholderText(/発動メモ/);
    expect(input).toHaveValue('initial');

    // Use fireEvent for memo to avoid character-by-character async complexity in this UI test
    await act(async () => {
      fireEvent.change(input, { target: { value: 'new memo' } });
    });

    expect(mockSetMemo).toHaveBeenCalledWith('new memo');
  });

  it('reflects correct pressed state from record', async () => {
    vi.mocked(useExecutionRecord).mockReturnValue({
      record: { status: 'completed', memo: '' },
      setStatus: mockSetStatus,
      setMemo: mockSetMemo,
      isLoading: false,
    } as unknown as ReturnType<typeof useExecutionRecord>);

    render(<ExecutionToggle date="2025-01-01" userId="U1" scheduleItemId={TEST_SLOT} />, { wrapper: Wrapper });

    const completedBtn = await screen.findByTestId(`exec-btn-completed-${TEST_SLOT}`);
    expect(completedBtn).toHaveAttribute('aria-pressed', 'true');

    const triggeredBtn = await screen.findByTestId(`exec-btn-triggered-${TEST_SLOT}`);
    expect(triggeredBtn).toHaveAttribute('aria-pressed', 'false');
  });
});
