import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PersonDaily } from '../../../domain/daily/types';
import { DailyRecordList } from '../DailyRecordList';

// Create a mock record with proper data structure
const createMockRecord = (overrides = {}): PersonDaily => ({
  id: 1,
  personId: 'P001',
  personName: 'テスト太郎',
  date: '2025-01-01',
  status: '完了',
  reporter: {
    name: 'スタッフA'
  },
  draft: {
    isDraft: false
  },
  kind: 'A',
  data: {
    amActivities: ['散歩'],
    pmActivities: ['読書'],
    mealAmount: '完食',
    problemBehavior: {
      selfHarm: false,
      violence: false,
      loudVoice: false,
      pica: false,
      other: false
    },
    seizureRecord: {
      occurred: false
    }
  },
  ...overrides
});

const mockProps = {
  records: [],
  loading: false,
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onOpenAttendance: vi.fn()
};

describe('DailyRecordList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty States', () => {
    it('shows loading state when loading is true', () => {
      render(<DailyRecordList {...mockProps} loading={true} />);

      expect(screen.getByTestId('daily-record-list-loading')).toBeInTheDocument();
      expect(screen.getByText('読み込み中...')).toBeInTheDocument();
    });

    it('shows empty state when no records', () => {
      render(<DailyRecordList {...mockProps} records={[]} loading={false} />);

      expect(screen.getByTestId('daily-record-list-empty')).toBeInTheDocument();
      expect(screen.getByText('まだ日次記録がありません')).toBeInTheDocument();
    });
  });

  describe('Record Display', () => {
    it('renders basic record information', () => {
      const record = createMockRecord({ id: 10 });
      const { container } = render(<DailyRecordList {...mockProps} records={[record]} />);

      expect(screen.getByTestId('person-name-10')).toHaveTextContent('テスト太郎');
      expect(screen.getByTestId('person-id-10')).toHaveTextContent('ID: P001');
      expect(container).toHaveTextContent('2025-01-01');
      expect(container).toHaveTextContent('スタッフA');
    });

    it('renders status chip correctly', () => {
      const record = createMockRecord({ id: 11 });
      render(<DailyRecordList {...mockProps} records={[record]} />);

      expect(screen.getByTestId('status-chip-11')).toBeInTheDocument();
      expect(screen.getByTestId('status-chip-11')).toHaveTextContent('完了');
    });

    it('formats meal amount correctly', () => {
      const record = createMockRecord({ id: 12 });
      const { container } = render(<DailyRecordList {...mockProps} records={[record]} />);

      expect(container).toHaveTextContent('食事摂取量: 完食');
    });
  });

  describe('Highlighting', () => {
    it('highlights record when userId and date match', () => {
      const record = createMockRecord({ id: 13 });
      render(
        <DailyRecordList
          {...mockProps}
          records={[record]}
          highlightUserId="P001"
          highlightDate="2025-01-01"
        />
      );

      const card = screen.getByTestId('daily-record-card-13');
      expect(card).toHaveAttribute('data-highlighted', 'true');
    });
  });

  describe('Problem Behavior', () => {
    it('shows problem behavior when present', () => {
      const record = createMockRecord({
        id: 14,
        data: {
          ...createMockRecord().data, // Include all base data
          problemBehavior: {
            selfHarm: true,
            violence: false,
            loudVoice: false,
            pica: false,
            other: false,
            otherDetail: ''
          }
        }
      });

      const { container } = render(<DailyRecordList {...mockProps} records={[record]} />);

      expect(container).toHaveTextContent('自傷');
    });

    it('does not show problem behavior section when not present', () => {
      const record = createMockRecord({
        id: 15,
        data: {
          ...createMockRecord().data, // Include all base data
          problemBehavior: {
            selfHarm: false,
            violence: false,
            loudVoice: false,
            pica: false,
            other: false,
            otherDetail: ''
          }
        }
      });

      const { container } = render(<DailyRecordList {...mockProps} records={[record]} />);

      expect(container).not.toHaveTextContent('自傷');
      expect(container).not.toHaveTextContent('暴力');
      expect(container).not.toHaveTextContent('大声');
      expect(container).not.toHaveTextContent('異食');
      expect(container).not.toHaveTextContent('その他');
    });
  });

  describe('Menu Interactions', () => {
    it('shows attendance link when onOpenAttendance is provided', () => {
      const record = createMockRecord({ id: 16 });
      render(<DailyRecordList {...mockProps} records={[record]} />);

      const menuButton = screen.getByTestId('menu-button-16');
      fireEvent.click(menuButton);

      expect(screen.getByText('通所状況を見る')).toBeInTheDocument();
    });

    it('calls onEdit when edit menu item is clicked', () => {
      const record = createMockRecord({ id: 17 });
      render(<DailyRecordList {...mockProps} records={[record]} />);

      const menuButton = screen.getByTestId('menu-button-17');
      fireEvent.click(menuButton);

      const editMenuItem = screen.getByTestId('edit-record-menu-item-17');
      fireEvent.click(editMenuItem);

      expect(mockProps.onEdit).toHaveBeenCalledWith(record);
    });

    it('calls onDelete when delete menu item is clicked', () => {
      const record = createMockRecord({ id: 18 });
      render(<DailyRecordList {...mockProps} records={[record]} />);

      const menuButton = screen.getByTestId('menu-button-18');
      fireEvent.click(menuButton);

      const deleteMenuItem = screen.getByTestId('delete-record-menu-item-18');
      fireEvent.click(deleteMenuItem);

      expect(mockProps.onDelete).toHaveBeenCalledWith(18);
    });
  });

  describe('Accessibility', () => {
    it('has proper aria-label on menu button', () => {
      const record = createMockRecord({ id: 19 });
      render(<DailyRecordList {...mockProps} records={[record]} />);

      const menuButton = screen.getByTestId('menu-button-19');
      expect(menuButton).toHaveAttribute('aria-label', 'テスト太郎さんのメニューを開く');
    });
  });
});