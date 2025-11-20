import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BaseSchedule } from '@/features/schedule/types';
import type { ScheduleConflict, ConflictKind } from '@/features/schedule/conflictChecker';
import {
  ScheduleConflictGuideDialog,
  toGuideItem,
  kindLabel,
} from '@/features/schedule/components/ScheduleConflictGuideDialog';
import type { GuideItem } from '@/features/schedule/components/ScheduleConflictGuideDialog';

vi.mock('@/features/schedule/staffAlternativeEngine', () => ({
  generateDemoStaffProfiles: () => [
    { id: 'staff-profile-1', name: '田中太郎', availability: 'available', experience: 'senior' },
    { id: 'staff-profile-2', name: '佐藤花子', availability: 'available', experience: 'junior' },
  ],
  suggestStaffAlternatives: () => [
    {
      staffId: 'staff-1',
      staffName: '田中太郎',
      reason: '経験豊富な職員',
      priority: 90,
      skillsMatched: ['生活支援'],
      currentlyScheduled: false,
    },
    {
      staffId: 'staff-2',
      staffName: '佐藤花子',
      reason: '空きがある職員',
      priority: 80,
      skillsMatched: ['送迎'],
      currentlyScheduled: false,
    },
  ],
}));

vi.mock('@/features/schedule/vehicleAlternativeEngine', () => ({
  generateDemoVehicleProfiles: () => [
    { id: 'vehicle-1', name: '車両A', status: 'available', type: 'standard' },
    { id: 'vehicle-2', name: '車両B', status: 'available', type: 'wheelchair' },
  ],
  suggestVehicleAlternatives: () => [
    {
      vehicleId: 'vehicle-1',
      vehicleName: '車両A',
      reason: '利用可能',
      featuresMatched: ['標準車両'],
      capacityMatch: 'sufficient',
      availabilityWarning: undefined,
      currentlyBooked: false,
    },
    {
      vehicleId: 'vehicle-2',
      vehicleName: '車両B',
      reason: '車椅子対応',
      featuresMatched: ['車椅子対応'],
      capacityMatch: 'perfect',
      availabilityWarning: undefined,
      currentlyBooked: false,
    },
  ],
}));

vi.mock('@/features/schedule/roomAlternativeEngine', () => ({
  generateDemoRoomProfiles: () => [
    { id: 'room-1', name: '会議室A', capacity: 10, equipment: [] },
    { id: 'room-2', name: '会議室B', capacity: 6, equipment: ['projector'] },
  ],
  generateDemoEquipmentProfiles: () => [
    { id: 'eq-1', name: 'プロジェクター', status: 'available', location: 'main' },
    { id: 'eq-2', name: 'ホワイトボード', status: 'available', location: 'east' },
  ],
  suggestRoomAlternatives: () => [
    {
      roomId: 'room-1',
      roomName: '会議室A',
      reason: '十分な収容人数',
      equipmentMatched: ['机'],
      capacitySuitability: 'perfect',
      usageWarning: undefined,
      currentlyOccupied: false,
    },
    {
      roomId: 'room-2',
      roomName: '会議室B',
      reason: '必要設備あり',
      equipmentMatched: ['projector'],
      capacitySuitability: 'adequate',
      usageWarning: undefined,
      currentlyOccupied: false,
    },
  ],
  suggestEquipmentAlternatives: () => [
    {
      equipmentId: 'eq-1',
      equipmentName: 'プロジェクター',
      reason: '利用可能',
      locationNote: '本館',
      skillRequirementsMet: true,
      availabilityWarning: undefined,
      currentlyInUse: 0,
      availableUnits: 1,
    },
    {
      equipmentId: 'eq-2',
      equipmentName: 'ホワイトボード',
      reason: '代替利用可能',
      locationNote: '東館',
      skillRequirementsMet: true,
      availabilityWarning: undefined,
      currentlyInUse: 0,
      availableUnits: 1,
    },
  ],
}));

const mockBaseSchedule: BaseSchedule = {
  id: 'schedule-1',
  etag: 'test-etag',
  title: 'テスト予定',
  start: '2024-01-15T09:00:00.000Z',
  end: '2024-01-15T10:00:00.000Z',
  allDay: false,
  status: '下書き',
  category: 'User',
};

const mockConflict: ScheduleConflict = {
  idA: 'schedule-1',
  idB: 'schedule-2',
  kind: 'vehicle-double-booking',
  message: 'Vehicle booking conflict detected',
};

describe('ScheduleConflictGuideDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnApplySuggestion = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ダイアログが正常に表示される', () => {
    render(
      <ScheduleConflictGuideDialog
        open={true}
        onClose={mockOnClose}
        schedule={mockBaseSchedule}
        conflicts={[mockConflict]}
        allSchedules={[]}
        onApplySuggestion={mockOnApplySuggestion}
      />,
    );

    expect(screen.getByTestId('schedule-conflict-guide-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('schedule-conflict-guide-title')).toBeInTheDocument();
    expect(screen.getByText('⚠️ スケジュールの重複について')).toBeInTheDocument();
  });

  it('閉じるボタンでダイアログが閉じられる', () => {
    render(
      <ScheduleConflictGuideDialog
        open={true}
        onClose={mockOnClose}
        schedule={mockBaseSchedule}
        conflicts={[mockConflict]}
        allSchedules={[]}
        onApplySuggestion={mockOnApplySuggestion}
      />,
    );

    fireEvent.click(screen.getByTestId('schedule-conflict-guide-close'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('時間シフト提案が表示され実行される', async () => {
    render(
      <ScheduleConflictGuideDialog
        open={true}
        onClose={mockOnClose}
        schedule={mockBaseSchedule}
        conflicts={[mockConflict]}
        allSchedules={[]}
        onApplySuggestion={mockOnApplySuggestion}
      />,
    );

    const timeShiftButton = screen.getByText('30分後にずらす');
    expect(timeShiftButton).toBeInTheDocument();

    fireEvent.click(timeShiftButton);

    await waitFor(() => {
      expect(mockOnApplySuggestion).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'time-shift',
          offsetMinutes: 30,
        }),
      );
    });
  });

  it('職員代替提案が表示され選択される', async () => {
    render(
      <ScheduleConflictGuideDialog
        open={true}
        onClose={mockOnClose}
        schedule={mockBaseSchedule}
        conflicts={[mockConflict]}
        allSchedules={[]}
        onApplySuggestion={mockOnApplySuggestion}
      />,
    );

    expect(screen.getByTestId('schedule-conflict-guide-staff-alternatives')).toBeInTheDocument();
    expect(screen.getByText('田中太郎')).toBeInTheDocument();

    const staffButton = screen.getByTestId('schedule-conflict-guide-apply-staff-staff-1');
    fireEvent.click(staffButton);

    await waitFor(() => {
      expect(mockOnApplySuggestion).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'staff-reassign',
          newStaffId: 'staff-1',
          newStaffName: '田中太郎',
        }),
      );
    });
  });

  it('open=falseの時は表示されない', () => {
    render(
      <ScheduleConflictGuideDialog
        open={false}
        onClose={mockOnClose}
        schedule={mockBaseSchedule}
        conflicts={[mockConflict]}
        allSchedules={[]}
        onApplySuggestion={mockOnApplySuggestion}
      />,
    );

    expect(screen.queryByTestId('schedule-conflict-guide-dialog')).not.toBeInTheDocument();
  });
});

describe('toGuideItem', () => {
  it('vehicle-double-booking コンフリクトのガイドアイテムが正しく生成される', () => {
    const conflict: ScheduleConflict = {
      idA: 'schedule-1',
      idB: 'schedule-2',
      kind: 'vehicle-double-booking',
      message: 'Vehicle booking conflict',
    };

    const guide: GuideItem = toGuideItem(conflict);

    expect(guide.kind).toBe('vehicle-double-booking');
    expect(guide.title).toContain('車両');
    expect(guide.suggestions).toHaveLength(3);
    expect(guide.suggestions[0]).toContain('時間帯');
  });

  it('equipment-conflict コンフリクトのガイドアイテムが正しく生成される', () => {
    const conflict: ScheduleConflict = {
      idA: 'schedule-1',
      idB: 'schedule-2',
      kind: 'equipment-conflict',
      message: 'Equipment conflict detected',
    };

    const guide: GuideItem = toGuideItem(conflict);

    expect(guide.kind).toBe('equipment-conflict');
    expect(guide.title).toContain('設備');
    expect(guide.suggestions.length).toBeGreaterThan(0);
  });

  it('unknown コンフリクト種別でデフォルトガイドが返される', () => {
    const conflict: ScheduleConflict = {
      idA: 'schedule-1',
      idB: 'schedule-2',
      kind: 'unknown-type' as ConflictKind,
      message: 'Unknown conflict',
    };

    const guide: GuideItem = toGuideItem(conflict);

    expect(guide.kind).toBe('unknown-type');
    expect(guide.title).toBe('スケジュールの重複が検出されました');
    expect(guide.suggestions).toContain('重複している予定の内容を確認してください。');
  });
});

describe('kindLabel', () => {
  it('各コンフリクト種別の適切なラベルが返される', () => {
    expect(kindLabel('vehicle-double-booking')).toBe('車両重複');
    expect(kindLabel('room-double-booking')).toBe('部屋重複');
    expect(kindLabel('equipment-conflict')).toBe('設備重複');
    expect(kindLabel('org-resource-conflict')).toBe('組織リソース衝突');
    expect(kindLabel('transportation-overlap')).toBe('送迎重複');
    expect(kindLabel('user-life-care-vs-support')).toBe('利用者×生活介護/支援');
    expect(kindLabel('user-life-support-vs-support')).toBe('利用者×生活支援同士');
    expect(kindLabel('staff-life-support-vs-staff')).toBe('職員×生活支援');
  });

  it('unknown 種別ではデフォルトラベルが返される', () => {
    expect(kindLabel('unknown-type' as ConflictKind)).toBe('重複');
  });
});
