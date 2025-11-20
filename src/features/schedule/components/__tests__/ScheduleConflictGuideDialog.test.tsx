import React from 'react';
import { cleanup, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  ScheduleConflictGuideDialog,
  toGuideItem,
  kindLabel,
} from '../ScheduleConflictGuideDialog';
import type { BaseSchedule } from '../../types';
import type { ScheduleConflict, ConflictKind } from '../../conflictChecker';
import { suggestStaffAlternatives } from '@/features/schedule/staffAlternativeEngine';
import { suggestVehicleAlternatives } from '@/features/schedule/vehicleAlternativeEngine';
import {
  suggestRoomAlternatives,
  suggestEquipmentAlternatives,
} from '@/features/schedule/roomAlternativeEngine';

// --- モック設定 -------------------------------------------------------------

vi.mock('@/features/schedule/staffAlternativeEngine', () => ({
  generateDemoStaffProfiles: vi.fn(() => [
    {
      id: 'staff-profile-1',
      name: 'ダミー職員',
      availability: 'available',
      experience: 'senior',
    },
  ]),
  // ScheduleConflictGuideDialog 内で参照される StaffAlternative の形に合わせる
  suggestStaffAlternatives: vi.fn(() => [
    {
      staffId: 'staff-1',
      staffName: '田中太郎',
      reason: 'テスト用代替職員',
      skillsMatched: ['生活支援'],
      workloadWarning: '',
      currentlyScheduled: false,
    },
  ]),
}));

vi.mock('@/features/schedule/vehicleAlternativeEngine', () => ({
  generateDemoVehicleProfiles: vi.fn(() => [
    { id: 'vehicle-1', name: '車両A', status: 'available', type: 'standard' },
  ]),
  suggestVehicleAlternatives: vi.fn(() => [
    {
      vehicleId: 'vehicle-1',
      vehicleName: '車両A',
      reason: 'テスト用代替車両',
      featuresMatched: ['車椅子対応'],
      capacityMatch: 'perfect',
      availabilityWarning: '',
      currentlyBooked: false,
    },
  ]),
}));

vi.mock('@/features/schedule/roomAlternativeEngine', () => ({
  generateDemoRoomProfiles: vi.fn(() => [
    { id: 'room-1', name: '会議室A', capacity: 10, equipment: ['机', '椅子'] },
  ]),
  generateDemoEquipmentProfiles: vi.fn(() => [
    { id: 'eq-1', name: 'プロジェクター', status: 'available', location: 'main' },
  ]),
  suggestRoomAlternatives: vi.fn(() => [
    {
      roomId: 'room-1',
      roomName: '会議室A',
      reason: 'テスト用代替部屋',
      equipmentMatched: ['机', '椅子'],
      capacitySuitability: 'perfect',
      usageWarning: '',
      currentlyOccupied: false,
    },
  ]),
  suggestEquipmentAlternatives: vi.fn(() => [
    {
      equipmentId: 'eq-1',
      equipmentName: 'プロジェクター',
      reason: 'テスト用代替設備',
      locationNote: '本館',
      skillRequirementsMet: true,
      availabilityWarning: '',
      currentlyInUse: 0,
      availableUnits: 1,
    },
  ]),
}));

// --- テスト用ダミーデータ ---------------------------------------------------

const baseSchedule: BaseSchedule = {
  id: 'schedule-1',
  etag: 'test-etag',
  // canApplyTimeShift の isLifeSupport 判定に引っかかるように「生活支援」を含める
  title: '生活支援テスト予定',
  start: '2024-01-15T09:00:00.000Z',
  end: '2024-01-15T10:00:00.000Z',
  allDay: false,
  status: '下書き',
  category: 'User',
};

const vehicleConflict: ScheduleConflict = {
  idA: 'schedule-1',
  idB: 'schedule-2',
  kind: 'vehicle-double-booking',
  message: 'Vehicle booking conflict detected',
};

const lifeSupportConflict: ScheduleConflict = {
  idA: 'schedule-1',
  idB: 'schedule-3',
  kind: 'user-life-support-vs-support',
  message: '生活支援同士の重複',
};

const staffConflict: ScheduleConflict = {
  idA: 'schedule-1',
  idB: 'schedule-4',
  kind: 'staff-life-support-vs-staff',
  message: '職員予定と生活支援の重複',
};

// --- ScheduleConflictGuideDialog 本体のテスト -------------------------------

describe('ScheduleConflictGuideDialog', () => {
  const onClose = vi.fn();
  const onApplySuggestion = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('open=true でダイアログが表示され、タイトルが表示される', () => {
    render(
      <ScheduleConflictGuideDialog
        open={true}
        onClose={onClose}
        schedule={baseSchedule}
        conflicts={[vehicleConflict]}
        allSchedules={[]}
        onApplySuggestion={onApplySuggestion}
      />,
    );

    expect(
      screen.getByTestId('schedule-conflict-guide-dialog'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('schedule-conflict-guide-title'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('⚠️ スケジュールの重複について'),
    ).toBeInTheDocument();
  });

  it('閉じるボタンで onClose が呼ばれる', () => {
    render(
      <ScheduleConflictGuideDialog
        open={true}
        onClose={onClose}
        schedule={baseSchedule}
        conflicts={[vehicleConflict]}
        allSchedules={[]}
        onApplySuggestion={onApplySuggestion}
      />,
    );

    fireEvent.click(
      screen.getByTestId('schedule-conflict-guide-close'),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('生活支援同士の重複時に時間シフト候補が表示され、「30分遅らせる」を押すと time-shift アクションが発火する', async () => {
    render(
      <ScheduleConflictGuideDialog
        open={true}
        onClose={onClose}
        schedule={baseSchedule}
        conflicts={[lifeSupportConflict]}
        allSchedules={[]}
        onApplySuggestion={onApplySuggestion}
      />,
    );

    // 時間調整候補コンテナが表示される
    const container = screen.getByTestId(
      'schedule-conflict-guide-suggestion-buttons',
    );
    expect(container).toBeInTheDocument();

    const button = screen.getByTestId(
      'schedule-conflict-guide-apply-30min-later',
    );
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('30分後にずらす');

    fireEvent.click(button);

    await waitFor(() => {
      expect(onApplySuggestion).toHaveBeenCalledTimes(1);
      expect(onApplySuggestion).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduleId: String(baseSchedule.id),
          actionType: 'time-shift',
          offsetMinutes: 30,
          label: '30分後にずらす',
          originalSchedule: baseSchedule,
          newStart: expect.any(String),
          newEnd: expect.any(String),
        }),
      );
    });
  });

  it('職員コンフリクトと allSchedules がある場合、職員代替案セクションが表示され、クリックで staff-reassign が呼ばれる', async () => {
    render(
      <ScheduleConflictGuideDialog
        open={true}
        onClose={onClose}
        schedule={baseSchedule}
        conflicts={[staffConflict]}
        allSchedules={[baseSchedule]}
        onApplySuggestion={onApplySuggestion}
      />,
    );

    const section = await screen.findByTestId(
      'schedule-conflict-guide-staff-alternatives',
    );
    expect(section).toBeInTheDocument();

    const staffCard = await screen.findByTestId(
      'schedule-conflict-guide-staff-alternative-0',
    );
    const applyButton = within(staffCard).getByRole('button', {
      name: 'この職員に変更',
    });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(onApplySuggestion).toHaveBeenCalledTimes(1);
      expect(onApplySuggestion).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduleId: String(baseSchedule.id),
          actionType: 'staff-reassign',
          newStaffId: expect.any(String),
          newStaffName: expect.any(String),
          originalSchedule: baseSchedule,
        }),
      );
    });
  });

  it('車両コンフリクトと allSchedules がある場合、車両代替案セクションが表示され、クリックで vehicle-reassign が呼ばれる', async () => {
    const scheduleVehicle: BaseSchedule = {
      ...baseSchedule,
      id: 'schedule-vehicle-1',
      title: '送迎テスト予定',
    };

    const vehicleDoubleBooking: ScheduleConflict = {
      idA: scheduleVehicle.id,
      idB: 'schedule-veh-2',
      kind: 'vehicle-double-booking',
      message: 'Vehicle double booking',
    };

    render(
      <ScheduleConflictGuideDialog
        open={true}
        onClose={onClose}
        schedule={scheduleVehicle}
        conflicts={[vehicleDoubleBooking]}
        allSchedules={[
          {
            ...scheduleVehicle,
            id: 'schedule-alpha',
          },
        ]}
        onApplySuggestion={onApplySuggestion}
      />,
    );

    const section = screen.getByTestId(
      'schedule-conflict-guide-vehicle-alternatives',
    );
    expect(section).toBeInTheDocument();

    const applyButton = within(section).getAllByRole('button', {
      name: 'この車両に変更',
    })[0];
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(onApplySuggestion).toHaveBeenCalledTimes(1);
      expect(onApplySuggestion).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduleId: String(scheduleVehicle.id),
          actionType: 'vehicle-reassign',
          newVehicleId: expect.any(String),
          newVehicleName: expect.any(String),
          originalSchedule: scheduleVehicle,
        }),
      );
    });
  });

  it('部屋コンフリクトと allSchedules がある場合、部屋代替案セクションが表示され、クリックで room-reassign が呼ばれる', async () => {
    const scheduleRoom: BaseSchedule = {
      ...baseSchedule,
      id: 'schedule-room-1',
      category: 'Org',
      title: '会議室利用テスト',
    };

    const roomDoubleBooking: ScheduleConflict = {
      idA: scheduleRoom.id,
      idB: 'schedule-room-2',
      kind: 'room-double-booking',
      message: 'Room double booking',
    };

    render(
      <ScheduleConflictGuideDialog
        open={true}
        onClose={onClose}
        schedule={scheduleRoom}
        conflicts={[roomDoubleBooking]}
        allSchedules={[
          {
            ...scheduleRoom,
            id: 'schedule-beta',
          },
        ]}
        onApplySuggestion={onApplySuggestion}
      />,
    );

    const section = screen.getByTestId(
      'schedule-conflict-guide-room-alternatives',
    );
    expect(section).toBeInTheDocument();

    const applyButton = within(section).getAllByRole('button', {
      name: 'この部屋に変更',
    })[0];
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(onApplySuggestion).toHaveBeenCalledTimes(1);
      expect(onApplySuggestion).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduleId: String(scheduleRoom.id),
          actionType: 'room-reassign',
          newRoomId: expect.any(String),
          newRoomName: expect.any(String),
          originalSchedule: scheduleRoom,
        }),
      );
    });
  });

  it('設備コンフリクトと allSchedules がある場合、設備代替案セクションが表示され、クリックで equipment-reassign が呼ばれる', async () => {
    const scheduleEquipment: BaseSchedule = {
      ...baseSchedule,
      id: 'schedule-eq-1',
      title: '機能訓練テスト予定',
    };

    const equipmentConflict: ScheduleConflict = {
      idA: scheduleEquipment.id,
      idB: 'schedule-eq-2',
      kind: 'equipment-conflict',
      message: 'Equipment conflict',
    };

    render(
      <ScheduleConflictGuideDialog
        open={true}
        onClose={onClose}
        schedule={scheduleEquipment}
        conflicts={[equipmentConflict]}
        allSchedules={[
          {
            ...scheduleEquipment,
            id: 'schedule-gamma',
          },
        ]}
        onApplySuggestion={onApplySuggestion}
      />,
    );

    const section = screen.getByTestId(
      'schedule-conflict-guide-equipment-alternatives',
    );
    expect(section).toBeInTheDocument();

    const applyButton = within(section).getAllByRole('button', {
      name: 'この設備に変更',
    })[0];
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(onApplySuggestion).toHaveBeenCalledTimes(1);
      expect(onApplySuggestion).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduleId: String(scheduleEquipment.id),
          actionType: 'equipment-reassign',
          newEquipmentId: expect.any(String),
          newEquipmentName: expect.any(String),
          originalSchedule: scheduleEquipment,
        }),
      );
    });
  });

  describe('suggestion engine invocation', () => {
    it('職員コンフリクト時に suggestStaffAlternatives が1回だけ呼ばれる', () => {
      render(
        <ScheduleConflictGuideDialog
          open={true}
          onClose={onClose}
          schedule={baseSchedule}
          conflicts={[staffConflict]}
          allSchedules={[baseSchedule]}
          onApplySuggestion={onApplySuggestion}
        />,
      );

      expect(suggestStaffAlternatives).toHaveBeenCalledTimes(1);
    });

    it('車両コンフリクト時に suggestVehicleAlternatives が1回だけ呼ばれる', () => {
      const scheduleVehicle: BaseSchedule = {
        ...baseSchedule,
        id: 'schedule-vehicle-for-call',
        title: '送迎テスト予定',
      };

      const vehicleDoubleBooking: ScheduleConflict = {
        idA: scheduleVehicle.id,
        idB: 'schedule-veh-call-2',
        kind: 'vehicle-double-booking',
        message: 'Vehicle double booking',
      };

      render(
        <ScheduleConflictGuideDialog
          open={true}
          onClose={onClose}
          schedule={scheduleVehicle}
          conflicts={[vehicleDoubleBooking]}
          allSchedules={[scheduleVehicle]}
          onApplySuggestion={onApplySuggestion}
        />,
      );

      expect(suggestVehicleAlternatives).toHaveBeenCalledTimes(1);
    });

    it('部屋コンフリクト時に suggestRoomAlternatives が1回だけ呼ばれる', () => {
      const scheduleRoom: BaseSchedule = {
        ...baseSchedule,
        id: 'schedule-room-for-call',
        category: 'Org',
        title: '会議室利用テスト',
      };

      const roomDoubleBooking: ScheduleConflict = {
        idA: scheduleRoom.id,
        idB: 'schedule-room-call-2',
        kind: 'room-double-booking',
        message: 'Room double booking',
      };

      render(
        <ScheduleConflictGuideDialog
          open={true}
          onClose={onClose}
          schedule={scheduleRoom}
          conflicts={[roomDoubleBooking]}
          allSchedules={[scheduleRoom]}
          onApplySuggestion={onApplySuggestion}
        />,
      );

      expect(suggestRoomAlternatives).toHaveBeenCalledTimes(1);
    });

    it('設備コンフリクト時に suggestEquipmentAlternatives が1回だけ呼ばれる', () => {
      const scheduleEquipment: BaseSchedule = {
        ...baseSchedule,
        id: 'schedule-equipment-for-call',
        title: '機能訓練テスト予定',
      };

      const equipmentConflict: ScheduleConflict = {
        idA: scheduleEquipment.id,
        idB: 'schedule-equipment-call-2',
        kind: 'equipment-conflict',
        message: 'Equipment conflict',
      };

      render(
        <ScheduleConflictGuideDialog
          open={true}
          onClose={onClose}
          schedule={scheduleEquipment}
          conflicts={[equipmentConflict]}
          allSchedules={[scheduleEquipment]}
          onApplySuggestion={onApplySuggestion}
        />,
      );

      expect(suggestEquipmentAlternatives).toHaveBeenCalledTimes(1);
    });
  });

  describe('ScheduleConflictGuideDialog - suggestion engine gating', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('open=false のときは車両/部屋/設備エンジンが抑制される（職員は事前計算）', () => {
      const schedule: BaseSchedule = {
        ...baseSchedule,
        title: '送迎と機能訓練を含むテスト予定',
        category: 'User',
      };

      const conflicts: ScheduleConflict[] = [
        {
          idA: schedule.id,
          idB: 'other-1',
          kind: 'staff-life-support-vs-staff',
          message: 'staff conflict',
        },
        {
          idA: schedule.id,
          idB: 'other-2',
          kind: 'vehicle-double-booking',
          message: 'vehicle conflict',
        },
        {
          idA: schedule.id,
          idB: 'other-3',
          kind: 'room-double-booking',
          message: 'room conflict',
        },
        {
          idA: schedule.id,
          idB: 'other-4',
          kind: 'equipment-conflict',
          message: 'equipment conflict',
        },
      ];

      render(
        <ScheduleConflictGuideDialog
          open={false}
          onClose={onClose}
          schedule={schedule}
          conflicts={conflicts}
          allSchedules={[schedule]}
          onApplySuggestion={onApplySuggestion}
        />,
      );

      expect(suggestStaffAlternatives).toHaveBeenCalledTimes(1);
      expect(suggestVehicleAlternatives).not.toHaveBeenCalled();
      expect(suggestRoomAlternatives).not.toHaveBeenCalled();
      expect(suggestEquipmentAlternatives).not.toHaveBeenCalled();
    });

    it('allSchedules が空のときは車両/部屋/設備エンジンが呼ばれない', () => {
      const schedule: BaseSchedule = {
        ...baseSchedule,
        title: '送迎と機能訓練を含むテスト予定',
        category: 'User',
      };

      const conflicts: ScheduleConflict[] = [
        {
          idA: schedule.id,
          idB: 'other-1',
          kind: 'staff-life-support-vs-staff',
          message: 'staff conflict',
        },
        {
          idA: schedule.id,
          idB: 'other-2',
          kind: 'vehicle-double-booking',
          message: 'vehicle conflict',
        },
        {
          idA: schedule.id,
          idB: 'other-3',
          kind: 'room-double-booking',
          message: 'room conflict',
        },
        {
          idA: schedule.id,
          idB: 'other-4',
          kind: 'equipment-conflict',
          message: 'equipment conflict',
        },
      ];

      render(
        <ScheduleConflictGuideDialog
          open={true}
          onClose={onClose}
          schedule={schedule}
          conflicts={conflicts}
          allSchedules={[]}
          onApplySuggestion={onApplySuggestion}
        />,
      );

      expect(suggestStaffAlternatives).toHaveBeenCalledTimes(1);
      expect(suggestVehicleAlternatives).not.toHaveBeenCalled();
      expect(suggestRoomAlternatives).not.toHaveBeenCalled();
      expect(suggestEquipmentAlternatives).not.toHaveBeenCalled();
    });

    it('該当コンフリクトが無いときは vehicle/room/equipment エンジンが呼ばれない', () => {
      const schedule: BaseSchedule = {
        ...baseSchedule,
        title: '送迎と機能訓練を含むテスト予定',
        category: 'User',
      };

      const conflicts: ScheduleConflict[] = [
        {
          idA: schedule.id,
          idB: 'other-1',
          kind: 'staff-life-support-vs-staff',
          message: 'staff conflict',
        },
        {
          idA: schedule.id,
          idB: 'other-2',
          kind: 'user-life-support-vs-support',
          message: 'life support conflict',
        },
      ];

      render(
        <ScheduleConflictGuideDialog
          open={true}
          onClose={onClose}
          schedule={schedule}
          conflicts={conflicts}
          allSchedules={[schedule]}
          onApplySuggestion={onApplySuggestion}
        />,
      );

      expect(suggestVehicleAlternatives).not.toHaveBeenCalled();
      expect(suggestRoomAlternatives).not.toHaveBeenCalled();
      expect(suggestEquipmentAlternatives).not.toHaveBeenCalled();
    });
  });

  it('open=false のときはダイアログが描画されない', () => {
    render(
      <ScheduleConflictGuideDialog
        open={false}
        onClose={onClose}
        schedule={baseSchedule}
        conflicts={[vehicleConflict]}
        allSchedules={[]}
        onApplySuggestion={onApplySuggestion}
      />,
    );

    expect(
      screen.queryByTestId('schedule-conflict-guide-dialog'),
    ).not.toBeInTheDocument();
  });
});

// --- toGuideItem / kindLabel のユニットテスト ------------------------------

describe('toGuideItem', () => {
  it('vehicle-double-booking コンフリクトのガイドアイテムが正しく生成される', () => {
    const conflict: ScheduleConflict = {
      idA: 'schedule-1',
      idB: 'schedule-2',
      kind: 'vehicle-double-booking',
      message: 'Vehicle booking conflict',
    };

    const guide = toGuideItem(conflict);

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

    const guide = toGuideItem(conflict);

    expect(guide.kind).toBe('equipment-conflict');
    expect(guide.title).toContain('設備');
    expect(guide.suggestions.length).toBeGreaterThan(0);
  });

  it('user-life-support-vs-support コンフリクトのガイドアイテムが正しく生成される', () => {
    const conflict: ScheduleConflict = {
      idA: 'schedule-1',
      idB: 'schedule-2',
      kind: 'user-life-support-vs-support',
      message: 'Life support conflict',
    };

    const guide = toGuideItem(conflict);

    expect(guide.kind).toBe('user-life-support-vs-support');
    expect(guide.title).toContain('生活支援');
    expect(guide.suggestions).toEqual(
      expect.arrayContaining([
        expect.stringContaining('重複している生活支援'),
      ]),
    );
  });

  it('unknown コンフリクト種別でデフォルトガイドが返される', () => {
    const conflict: ScheduleConflict = {
      idA: 'schedule-1',
      idB: 'schedule-2',
      kind: 'unknown-type' as ConflictKind,
      message: 'Unknown conflict',
    };

    const guide = toGuideItem(conflict);

    expect(guide.kind).toBe('unknown-type');
    expect(guide.title).toBe('スケジュールの重複が検出されました');
    expect(guide.suggestions).toContain(
      '重複している予定の内容を確認してください。',
    );
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
