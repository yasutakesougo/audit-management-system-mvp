import { TESTIDS, tid } from '@/testids';
import {
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    List,
    ListItem,
    ListItemText,
    Stack,
    Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import React, { useMemo } from 'react';
import type { ConflictKind, ScheduleConflict } from '../conflictChecker';
import { generateDemoEquipmentProfiles, generateDemoRoomProfiles, suggestEquipmentAlternatives, suggestRoomAlternatives } from '../roomAlternativeEngine';
import { generateDemoStaffProfiles, suggestStaffAlternatives } from '../staffAlternativeEngine';
import type { BaseSchedule, EquipmentAlternative, RoomAlternative, Schedule, StaffAlternative, VehicleAlternative } from '../types';
import { generateDemoVehicleProfiles, suggestVehicleAlternatives } from '../vehicleAlternativeEngine';

// BaseSchedule を適切な Schedule に変換するヘルパー
// 注意：職員代替エンジン専用。車両/部屋/設備系は使用禁止
function convertToFullSchedule(baseSchedule: BaseSchedule): Schedule {
  switch (baseSchedule.category) {
    case 'User':
      return {
        ...baseSchedule,
        category: 'User' as const,
        serviceType: '一時ケア',
        personType: 'Internal',
        staffIds: ['default-staff'],
        personId: 'default-person',
        personName: undefined,
        externalPersonName: undefined,
        externalPersonOrg: undefined,
        externalPersonContact: undefined,
        staffNames: undefined,
      };
    case 'Staff':
      return {
        ...baseSchedule,
        category: 'Staff' as const,
        subType: '会議',
        staffIds: ['default-staff'],
        staffNames: undefined,
        dayPart: undefined,
      };
    case 'Org':
      return {
        ...baseSchedule,
        category: 'Org' as const,
        subType: '会議',
        audience: undefined,
        resourceId: undefined,
        externalOrgName: undefined,
      };
    default: {
      // TypeScript の exhaustive check により、新しいカテゴリ追加時にコンパイルエラーとなる
      // これにより、未対応のケースを実行時ではなくビルド時に検出できる
      const _exhaustiveCheck: never = baseSchedule.category;
      throw new Error(
        `convertToFullSchedule: unknown category "${_exhaustiveCheck}". ` +
        'Please add explicit handling for this category.'
      );
    }
  }
}

export type SuggestionAction = {
  scheduleId: string;
  newStart?: string; // 時間調整用：ISO 文字列
  newEnd?: string;   // 時間調整用
  newStaffId?: string; // 職員変更用：新しい担当職員ID
  newStaffName?: string; // 職員変更用：新しい担当職員名
  newVehicleId?: string; // 車両変更用：新しい車両ID
  newVehicleName?: string; // 車両変更用：新しい車両名
  newRoomId?: string; // 部屋変更用：新しい部屋ID
  newRoomName?: string; // 部屋変更用：新しい部屋名
  newEquipmentId?: string; // 設備変更用：新しい設備ID
  newEquipmentName?: string; // 設備変更用：新しい設備名
  actionType: 'time-shift' | 'time-shift-30min-later' | 'staff-reassign' | 'vehicle-reassign' | 'room-reassign' | 'equipment-reassign';
  originalSchedule: BaseSchedule;
  // ミニ時間提案エンジン用の追加情報
  offsetMinutes?: number;
  label?: string;
};

// ★ 時間シフト候補の型
type TimeShiftCandidate = {
  id: string;
  label: string;
  offsetMinutes: number;
};

// ★ ベースとなる候補リスト（±30 / +60）
const BASE_TIME_SHIFT_CANDIDATES: TimeShiftCandidate[] = [
  { id: 'shift-minus-30', label: '30分前にずらす', offsetMinutes: -30 },
  { id: 'shift-plus-30', label: '30分後にずらす', offsetMinutes: 30 },
  { id: 'shift-plus-60', label: '60分後にずらす', offsetMinutes: 60 },
];

type Props = {
  open: boolean;
  onClose: () => void;
  schedule: BaseSchedule | null;
  conflicts: ScheduleConflict[];
  allSchedules?: BaseSchedule[]; // 衝突チェック用の全スケジュール + 職員代替案エンジン用
  onApplySuggestion?: (action: SuggestionAction) => void;
};

export const ScheduleConflictGuideDialog: React.FC<Props> = ({
  open,
  onClose,
  schedule,
  conflicts,
  allSchedules = [],
  onApplySuggestion,
}) => {
  const title = schedule?.title ?? 'スケジュール';

  const guideItems = useMemo(
    () => conflicts.map(toGuideItem),
    [conflicts],
  );

  // 現時点では「何らかの重複があれば候補を表示」する程度に緩めておく
  const canApplyTimeShift = useMemo(() => {
    if (!schedule || !onApplySuggestion) return false;
    return conflicts.length > 0;
  }, [schedule, conflicts, onApplySuggestion]);

  // 職員代替案が表示可能かチェック
  const canShowStaffAlternatives = useMemo(() => {
    if (!schedule || !onApplySuggestion) return false;
    return schedule.category === 'User' || schedule.category === 'Staff';
  }, [schedule, onApplySuggestion]);

  // 車両代替案が表示可能かチェック（Stage 7）
  const canShowVehicleAlternatives = useMemo(() => {
    if (!open || !schedule || !onApplySuggestion || !allSchedules.length) return false;

    // 車両関連の衝突があるかチェック
    const hasVehicleConflict = conflicts.some(
      (c) => c.kind === 'vehicle-double-booking'
    );

    // 対象スケジュールが車両を使用するカテゴリかチェック
    const usesVehicle = schedule.category === 'User' && (
      schedule.title?.includes('送迎') ||
      schedule.title?.includes('外出') ||
      schedule.title?.includes('通院')
    );

    return hasVehicleConflict && usesVehicle;
  }, [open, schedule, conflicts, onApplySuggestion, allSchedules]);

  // 部屋代替案が表示可能かチェック（Stage 8）
  const canShowRoomAlternatives = useMemo(() => {
    if (!open || !schedule || !onApplySuggestion || !allSchedules.length) return false;

    // 部屋関連の衝突があるかチェック
    const hasRoomConflict = conflicts.some(
      (c) => c.kind === 'room-double-booking'
    );

    // 対象スケジュールが部屋を使用するカテゴリかチェック
    const usesRoom = schedule.category === 'User' || schedule.category === 'Org';

    return hasRoomConflict && usesRoom;
  }, [open, schedule, conflicts, onApplySuggestion, allSchedules]);

  // 設備代替案が表示可能かチェック（Stage 8）
  const canShowEquipmentAlternatives = useMemo(() => {
    if (!open || !schedule || !onApplySuggestion || !allSchedules.length) return false;

    // 設備関連の衝突があるかチェック
    const hasEquipmentConflict = conflicts.some(
      (c) => c.kind === 'equipment-conflict'
    );

    // 対象スケジュールが設備を使用するカテゴリかチェック
    const usesEquipment = schedule.category === 'User' && (
      schedule.title?.includes('機能訓練') ||
      schedule.title?.includes('リハビリ') ||
      schedule.title?.includes('介助')
    );

    return hasEquipmentConflict && usesEquipment;
  }, [open, schedule, conflicts, onApplySuggestion, allSchedules]);

  // ★ 職員代替案の生成
  const staffAlternatives = useMemo<StaffAlternative[]>(() => {
    if (!canShowStaffAlternatives || !schedule) return [];

    try {
      const staffProfiles = generateDemoStaffProfiles();
      const fullSchedule = convertToFullSchedule(schedule);

      const suggestions = suggestStaffAlternatives(
        {
          targetSchedule: fullSchedule,
          requiredSkills: ['生活支援'], // 生活支援スキルを必須とする
          excludeStaffIds: fullSchedule.category === 'Staff' ? fullSchedule.staffIds : [], // 現在の担当者は除外
          maxSuggestions: 3,
        },
        staffProfiles,
        allSchedules.map(convertToFullSchedule),
      );

      return suggestions;
    } catch (error) {
      console.warn('職員代替案の生成に失敗しました:', error);
      return [];
    }
  }, [canShowStaffAlternatives, schedule, allSchedules]);

  // ★ 車両代替案の生成（Stage 7）
  const vehicleAlternatives = useMemo<VehicleAlternative[]>(() => {
    if (!canShowVehicleAlternatives || !schedule) return [];

    try {
      const vehicleProfiles = generateDemoVehicleProfiles();

      const suggestions = suggestVehicleAlternatives(
        {
          targetSchedule: schedule, // BaseScheduleで十分
          requiredFeatures: ['車椅子対応'], // 車椅子対応を必須とする
          requiredCapacity: 4, // 最低4名定員
          excludeVehicleIds: [], // 現在の車両は除外（ID取得は後で実装）
          maxSuggestions: 3,
        },
        vehicleProfiles,
        allSchedules, // BaseScheduleで十分
      );

      return suggestions;
    } catch (error) {
      console.warn('車両代替案の生成に失敗しました:', error);
      return [];
    }
  }, [canShowVehicleAlternatives, schedule, allSchedules]);

  // ★ 部屋代替案の生成（Stage 8）
  const roomAlternatives = useMemo<RoomAlternative[]>(() => {
    if (!canShowRoomAlternatives || !schedule) return [];

    try {
      const roomProfiles = generateDemoRoomProfiles();

      const suggestions = suggestRoomAlternatives(
        {
          targetSchedule: schedule,
          requiredCapacity: 4, // 最低4名定員
          requiredEquipment: ['机', '椅子'], // 基本設備
          excludeRoomIds: [], // 現在の部屋は除外（ID取得は後で実装）
          maxSuggestions: 3,
        },
        roomProfiles,
        allSchedules,
      );

      return suggestions;
    } catch (error) {
      console.warn('部屋代替案の生成に失敗しました:', error);
      return [];
    }
  }, [canShowRoomAlternatives, schedule, allSchedules]);

  // ★ 設備代替案の生成（Stage 8）
  const equipmentAlternatives = useMemo<EquipmentAlternative[]>(() => {
    if (!canShowEquipmentAlternatives || !schedule) return [];

    try {
      const equipmentProfiles = generateDemoEquipmentProfiles();

      const suggestions = suggestEquipmentAlternatives(
        {
          targetSchedule: schedule,
          requiredEquipmentTypes: ['mobility', 'training'], // 移動・訓練機器
          requiredSkills: ['機能訓練指導員'], // 必要スキル
          requiredUnits: 1,
          excludeEquipmentIds: [], // 現在の設備は除外（ID取得は後で実装）
          maxSuggestions: 3,
        },
        equipmentProfiles,
        allSchedules,
      );

      return suggestions;
    } catch (error) {
      console.warn('設備代替案の生成に失敗しました:', error);
      return [];
    }
  }, [canShowEquipmentAlternatives, schedule, allSchedules]);

  // ★ 時間シフト候補の生成
  const timeShiftCandidates = useMemo<TimeShiftCandidate[]>(
    () => (canApplyTimeShift ? BASE_TIME_SHIFT_CANDIDATES : []),
    [canApplyTimeShift],
  );

  // ★ 職員変更ハンドラー
  const handleStaffReassign = (alternative: StaffAlternative) => {
    if (!schedule || !onApplySuggestion || !canShowStaffAlternatives) return;

    onApplySuggestion({
      scheduleId: String(schedule.id),
      newStaffId: alternative.staffId,
      newStaffName: alternative.staffName,
      actionType: 'staff-reassign',
      originalSchedule: schedule,
      label: `担当職員を ${alternative.staffName} に変更`,
    });
  };

  // ★ 車両変更ハンドラー（Stage 7）
  const handleVehicleReassign = (alternative: VehicleAlternative) => {
    if (!schedule || !onApplySuggestion || !canShowVehicleAlternatives) return;

    onApplySuggestion({
      scheduleId: String(schedule.id),
      newVehicleId: alternative.vehicleId,
      newVehicleName: alternative.vehicleName,
      actionType: 'vehicle-reassign',
      originalSchedule: schedule,
      label: `車両を ${alternative.vehicleName} に変更`,
    });
  };

  // ★ 部屋変更ハンドラー（Stage 8）
  const handleRoomReassign = (alternative: RoomAlternative) => {
    if (!schedule || !onApplySuggestion || !canShowRoomAlternatives) return;

    onApplySuggestion({
      scheduleId: String(schedule.id),
      newRoomId: alternative.roomId,
      newRoomName: alternative.roomName,
      actionType: 'room-reassign',
      originalSchedule: schedule,
      label: `部屋を ${alternative.roomName} に変更`,
    });
  };

  // ★ 設備変更ハンドラー（Stage 8）
  const handleEquipmentReassign = (alternative: EquipmentAlternative) => {
    if (!schedule || !onApplySuggestion || !canShowEquipmentAlternatives) return;

    onApplySuggestion({
      scheduleId: String(schedule.id),
      newEquipmentId: alternative.equipmentId,
      newEquipmentName: alternative.equipmentName,
      actionType: 'equipment-reassign',
      originalSchedule: schedule,
      label: `設備を ${alternative.equipmentName} に変更`,
    });
  };

  // ★ 時間調整ハンドラー（任意のoffsetMinutesを使用）
  const handleApplyTimeShift = (candidate: TimeShiftCandidate) => {
    if (!schedule || !onApplySuggestion || !canApplyTimeShift) return;

    // start/end が存在することを確認（安全ガード）
    if (!schedule.start || !schedule.end) {
      console.warn('schedule.start または schedule.end が未定義です。時間調整をスキップします。');
      return;
    }

    const start = dayjs(schedule.start);
    const end = dayjs(schedule.end);

    // dayjs が Invalid Date を返していないことも確認
    if (!start.isValid() || !end.isValid()) {
      console.warn('schedule.start または schedule.end が無効な日時です。時間調整をスキップします。');
      return;
    }

    const newStart = start.add(candidate.offsetMinutes, 'minute');
    const newEnd = end.add(candidate.offsetMinutes, 'minute');

    onApplySuggestion({
      scheduleId: String(schedule.id),
      newStart: newStart.toISOString(),
      newEnd: newEnd.toISOString(),
      actionType: 'time-shift', // 汎用 time-shift として扱う
      originalSchedule: schedule,
      offsetMinutes: candidate.offsetMinutes,
      label: candidate.label,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      {...tid(TESTIDS['schedule-conflict-guide-dialog'])}
    >
      <DialogTitle
        {...tid(TESTIDS['schedule-conflict-guide-title'])}
      >
        ⚠️ スケジュールの重複について
        <Typography
          variant="subtitle2"
          component="span"
          sx={{ mt: 0.5, display: 'block' }}
        >
          {title}
        </Typography>
      </DialogTitle>
      <DialogContent dividers {...tid(TESTIDS['schedule-conflict-guide-content'])}>
        {guideItems.length === 0 ? (
          <Typography variant="body2">
            現在、この予定に対する重複は検出されていません。
          </Typography>
        ) : (
          <List dense>
            {guideItems.map((g, idx) => (
              <ListItem
                key={idx}
                alignItems="flex-start"
                sx={{ alignItems: 'flex-start' }}
                data-testid={`schedule-conflict-guide-item-${idx}`}
              >
                <ListItemText
                  primaryTypographyProps={{ component: 'div' }}
                  secondaryTypographyProps={{ component: 'div' }}
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        label={kindLabel(g.kind)}
                        size="small"
                        color="warning"
                        variant="outlined"
                      />
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        {g.title}
                      </Typography>
                    </Stack>
                  }
                  secondary={
                    <Box sx={{ mt: 0.5 }}>
                      <Typography variant="body2" sx={{ mb: 0.5 }}>
                        {g.description}
                      </Typography>
                      {g.suggestions.length > 0 && (
                        <Box sx={{ ml: 1 }}>
                          <Typography
                            variant="body2"
                            color="primary"
                            sx={{ fontWeight: 'bold', mb: 0.5 }}
                          >
                            💡 おすすめの対応:
                          </Typography>
                          {g.suggestions.map((s, i) => (
                            <Typography
                              key={i}
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                display: 'list-item',
                                ml: 2,
                                mb: 0.25,
                                '&::marker': {
                                  color: 'primary.main',
                                }
                              }}
                            >
                              {s}
                            </Typography>
                          ))}
                        </Box>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}

        {/* ★ ミニ時間提案エンジン：複数候補ボタン */}
        {canApplyTimeShift && timeShiftCandidates.length > 0 && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'primary.50', borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
              💡 時間調整の候補（重複を避けるための案）
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              flexWrap="wrap"
              {...tid(TESTIDS['schedule-conflict-guide-suggestion-buttons'])}
            >
              {timeShiftCandidates.map((candidate) => (
                <Button
                  key={candidate.id}
                  size="small"
                  variant="outlined"
                  color="primary"
                  onClick={() => handleApplyTimeShift(candidate)}
                  // 代表ボタン（30分後ろ）には既存の testid を流用
                  {...(candidate.offsetMinutes === 30
                    ? tid(TESTIDS['schedule-conflict-guide-apply-30min-later'])
                    : candidate.offsetMinutes < 0
                    ? tid(TESTIDS['schedule-conflict-guide-apply-30min-earlier'])
                    : candidate.offsetMinutes === 60
                    ? tid(TESTIDS['schedule-conflict-guide-apply-60min-later'])
                    : {})}
                >
                  {candidate.label}
                </Button>
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              ※ 選択した候補について、他の予定との重複がないか事前確認してから調整を行います
            </Typography>
          </Box>
        )}

        {/* ★ 職員代替案エンジン：候補職員リスト */}
        {canShowStaffAlternatives && staffAlternatives.length > 0 && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'success.50', borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
              👥 担当職員の代替案（空いている職員）
            </Typography>
            <Stack
              direction="column"
              spacing={1}
              {...tid(TESTIDS['schedule-conflict-guide-staff-alternatives'])}
            >
              {staffAlternatives.map((alternative, index) => (
                <Box
                  key={alternative.staffId}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 1,
                    border: '1px solid',
                    borderColor: 'success.200',
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                  }}
                  data-testid={`schedule-conflict-guide-staff-alternative-${index}`}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {alternative.staffName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {alternative.reason}
                    </Typography>
                    {(alternative.skillsMatched?.length ?? 0) > 0 && (
                      <Box sx={{ mt: 0.5 }}>
                        {(alternative.skillsMatched ?? []).slice(0, 3).map((skill) => (
                          <Chip
                            key={skill}
                            label={skill}
                            size="small"
                            variant="outlined"
                            color="success"
                            sx={{ mr: 0.5, fontSize: '0.6rem', height: '16px' }}
                          />
                        ))}
                      </Box>
                    )}
                    {alternative.workloadWarning && (
                      <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
                        ⚠️ {alternative.workloadWarning}
                      </Typography>
                    )}
                  </Box>
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    onClick={() => handleStaffReassign(alternative)}
                    disabled={alternative.currentlyScheduled}
                    data-testid={`schedule-conflict-guide-apply-staff-${alternative.staffId}`}
                  >
                    この職員に変更
                  </Button>
                </Box>
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              ※ 職員変更により、他の予定との重複がないか事前確認してから変更を行います
            </Typography>
          </Box>
        )}

        {/* ★ 車両代替案エンジン：候補車両リスト（Stage 7） */}
        {canShowVehicleAlternatives && vehicleAlternatives.length > 0 && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'warning.50', borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
              🚗 車両の代替案（空いている車両）
            </Typography>
            <Stack
              direction="column"
              spacing={1}
              {...tid(TESTIDS['schedule-conflict-guide-vehicle-alternatives'])}
            >
              {vehicleAlternatives.map((alternative, index) => (
                <Box
                  key={alternative.vehicleId}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 1,
                    border: '1px solid',
                    borderColor: 'warning.200',
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                  }}
                  data-testid={`schedule-conflict-guide-vehicle-alternative-${index}`}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {alternative.vehicleName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {alternative.reason}
                    </Typography>
                    {alternative.featuresMatched.length > 0 && (
                      <Box sx={{ mt: 0.5 }}>
                        {alternative.featuresMatched.slice(0, 3).map((feature) => (
                          <Chip
                            key={feature}
                            label={feature}
                            size="small"
                            variant="outlined"
                            color="warning"
                            sx={{ mr: 0.5, fontSize: '0.6rem', height: '16px' }}
                          />
                        ))}
                      </Box>
                    )}
                    {alternative.capacityMatch && (
                      <Typography variant="caption" color="info.main" sx={{ display: 'block', mt: 0.5 }}>
                        🚗 定員: {alternative.capacityMatch === 'perfect' ? '最適' : alternative.capacityMatch === 'sufficient' ? '十分' : '不足'}
                      </Typography>
                    )}
                    {alternative.availabilityWarning && (
                      <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.5 }}>
                        ⚠️ {alternative.availabilityWarning}
                      </Typography>
                    )}
                  </Box>
                  <Button
                    size="small"
                    variant="contained"
                    color="warning"
                    onClick={() => handleVehicleReassign(alternative)}
                    disabled={alternative.currentlyBooked}
                    data-testid={`schedule-conflict-guide-apply-vehicle-${alternative.vehicleId}`}
                  >
                    この車両に変更
                  </Button>
                </Box>
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              ※ 車両変更により、他の予定との重複がないか事前確認してから変更を行います
            </Typography>
          </Box>
        )}

        {/* ★ 部屋代替案エンジン：候補部屋リスト（Stage 8） */}
        {canShowRoomAlternatives && roomAlternatives.length > 0 && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'secondary.50', borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
              🏠 部屋の代替案（空いている部屋）
            </Typography>
            <Stack
              direction="column"
              spacing={1}
              {...tid(TESTIDS['schedule-conflict-guide-room-alternatives'])}
            >
              {roomAlternatives.map((alternative, index) => (
                <Box
                  key={alternative.roomId}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 1,
                    border: '1px solid',
                    borderColor: 'secondary.200',
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                  }}
                  data-testid={`schedule-conflict-guide-room-alternative-${index}`}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {alternative.roomName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {alternative.reason}
                    </Typography>
                    {alternative.equipmentMatched.length > 0 && (
                      <Box sx={{ mt: 0.5 }}>
                        {alternative.equipmentMatched.slice(0, 3).map((equipment) => (
                          <Chip
                            key={equipment}
                            label={equipment}
                            size="small"
                            variant="outlined"
                            color="secondary"
                            sx={{ mr: 0.5, fontSize: '0.6rem', height: '16px' }}
                          />
                        ))}
                      </Box>
                    )}
                    {alternative.capacitySuitability && (
                      <Typography variant="caption" color="info.main" sx={{ display: 'block', mt: 0.5 }}>
                        🏠 収容: {alternative.capacitySuitability === 'perfect' ? '最適' : alternative.capacitySuitability === 'adequate' ? '十分' : alternative.capacitySuitability === 'limited' ? '限定的' : '不足'}
                      </Typography>
                    )}
                    {alternative.usageWarning && (
                      <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.5 }}>
                        ⚠️ {alternative.usageWarning}
                      </Typography>
                    )}
                  </Box>
                  <Button
                    size="small"
                    variant="contained"
                    color="secondary"
                    onClick={() => handleRoomReassign(alternative)}
                    disabled={alternative.currentlyOccupied}
                    data-testid={`schedule-conflict-guide-apply-room-${alternative.roomId}`}
                  >
                    この部屋に変更
                  </Button>
                </Box>
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              ※ 部屋変更により、他の予定との重複がないか事前確認してから変更を行います
            </Typography>
          </Box>
        )}

        {/* ★ 設備代替案エンジン：候補設備リスト（Stage 8） */}
        {canShowEquipmentAlternatives && equipmentAlternatives.length > 0 && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'info.50', borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
              🛠️ 設備の代替案（利用可能設備）
            </Typography>
            <Stack
              direction="column"
              spacing={1}
              {...tid(TESTIDS['schedule-conflict-guide-equipment-alternatives'])}
            >
              {equipmentAlternatives.map((alternative, index) => (
                <Box
                  key={alternative.equipmentId}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 1,
                    border: '1px solid',
                    borderColor: 'info.200',
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                  }}
                  data-testid={`schedule-conflict-guide-equipment-alternative-${index}`}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {alternative.equipmentName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {alternative.reason}
                    </Typography>
                    <Typography variant="caption" color="info.main" sx={{ display: 'block', mt: 0.5 }}>
                      📍 {alternative.locationNote}
                    </Typography>
                    {!alternative.skillRequirementsMet && (
                      <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
                        ⚠️ 操作には追加の資格・訓練が必要です
                      </Typography>
                    )}
                    {alternative.availabilityWarning && (
                      <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.5 }}>
                        ⚠️ {alternative.availabilityWarning}
                      </Typography>
                    )}
                  </Box>
                  <Button
                    size="small"
                    variant="contained"
                    color="info"
                    onClick={() => handleEquipmentReassign(alternative)}
                    disabled={alternative.currentlyInUse >= alternative.availableUnits}
                    data-testid={`schedule-conflict-guide-apply-equipment-${alternative.equipmentId}`}
                  >
                    この設備に変更
                  </Button>
                </Box>
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              ※ 設備変更により、他の予定との重複がないか事前確認してから変更を行います
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions {...tid(TESTIDS['schedule-conflict-guide-actions'])}>
        <Button
          onClick={onClose}
          variant="text"
          {...tid(TESTIDS['schedule-conflict-guide-close'])}
        >
          閉じる
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// --- ガイド生成ロジック ----------------------------------------------------
// エクスポートしてユニットテスト可能に

export type GuideItem = {
  kind: ConflictKind;
  title: string;
  description: string;
  suggestions: string[];
};

export function toGuideItem(conflict: ScheduleConflict): GuideItem {
  switch (conflict.kind) {
    case 'vehicle-double-booking':
      return {
        kind: conflict.kind,
        title: '車両の予約が重複しています',
        description:
          '同じ時間帯に同一の車両が複数の送迎・外出予定に割り当てられています。',
        suggestions: [
          'いずれかの送迎時間帯を前後にずらせないか検討してください。',
          '他の空いている車両への振り替えを検討してください。',
          'タクシー等の代替手段の利用可否を確認してください。',
        ],
      };
    case 'equipment-conflict':
      return {
        kind: conflict.kind,
        title: '設備の予約が重複しています',
        description:
          '同じ時間帯に同一の設備（機能訓練機器・共有機器など）が複数の予定に割り当てられています。',
        suggestions: [
          'どの予定で設備を優先的に使用するか検討してください。',
          '他の空いている設備・代替手段がないか確認してください。',
          '時間帯を前後にずらして設備利用を分散できないか検討してください。',
        ],
      };
    case 'room-double-booking':
      return {
        kind: conflict.kind,
        title: '部屋の予約が重複しています',
        description:
          '同じ時間帯に同一の部屋が複数の予定に割り当てられています。',
        suggestions: [
          '利用人数・内容に応じて、どの予定を別の部屋に移せるか検討してください。',
          '他に空いている部屋やスペースがないか確認してください。',
          'オンライン参加など、部屋を分散する工夫ができないか検討してください。',
        ],
      };
    case 'org-resource-conflict':
      return {
        kind: conflict.kind,
        title: '組織共通リソースの利用が重複しています',
        description:
          '会議室・共有機器・送迎枠など、組織単位で管理しているリソースの利用が重複しています。',
        suggestions: [
          'リソース管理表や予約ルールを再確認してください。',
          '優先度の低い予定のリスケジュールを検討してください。',
          '利用枠を明確にし、今後の重複を避けるルール整備を検討してください。',
        ],
      };
    case 'transportation-overlap':
      return {
        kind: conflict.kind,
        title: '送迎ルート・時間帯が重複しています',
        description:
          '送迎ルートや時間帯が重なっており、現実的に運行が難しい可能性があります。',
        suggestions: [
          '乗車人数・ルートを見直し、無理のない順番に組み替えてください。',
          '出発・到着時刻に余裕を持たせるよう調整してください。',
          '必要に応じて便数を分けることも検討してください。',
        ],
      };
    case 'user-life-care-vs-support':
      return {
        kind: conflict.kind,
        title: '生活介護と生活支援が同時間帯で重複しています',
        description:
          '同一利用者について、通所（生活介護）と一時ケア／ショートステイが同じ時間に登録されています。',
        suggestions: [
          'どちらを優先するか（通所 or 生活支援）を事業所方針に沿って決定してください。',
          '生活支援側の開始・終了時刻を前後にずらすことを検討してください。',
          '利用者・家族との契約内容（利用時間帯）と矛盾していないか確認してください。',
        ],
      };
    case 'user-life-support-vs-support':
      return {
        kind: conflict.kind,
        title: '生活支援（一時ケア／ショートステイ）が重複しています',
        description:
          '同一利用者について、複数の一時ケア／ショートステイが同時間帯に重なっています。',
        suggestions: [
          '重複している生活支援のうち、誤登録がないか確認してください。',
          '一時ケアとショートステイの役割分担が適切か（同時提供が必要か）を検討してください。',
          '送迎時間・利用枠に無理がないか確認してください。',
        ],
      };
    case 'staff-life-support-vs-staff':
      return {
        kind: conflict.kind,
        title: '担当職員の個人予定と生活支援担当が重複しています',
        description:
          '生活支援（一時ケア／ショートステイ）の担当職員が、同時間帯に別の職員予定（会議・研修など）を持っています。',
        suggestions: [
          '会議・研修などの予定と、一時ケア／ショートステイのどちらを優先するか検討してください。',
          '他の職員に生活支援の担当を振り替えることを検討してください。',
          'どうしても両方が必要な場合は、支援体制に無理がないか再確認してください。',
        ],
      };
    default:
      return {
        kind: conflict.kind,
        title: 'スケジュールの重複が検出されました',
        description:
          'この予定は他の予定と時間帯が重複しています。内容を確認し、必要に応じて調整してください。',
        suggestions: [
          '重複している予定の内容を確認してください。',
          '時間帯を前後にずらすことを検討してください。',
          '担当者の変更を検討してください。',
        ],
      };
  }
}

export function kindLabel(kind: ConflictKind): string {
  switch (kind) {
    case 'vehicle-double-booking':
      return '車両重複';
    case 'room-double-booking':
      return '部屋重複';
    case 'equipment-conflict':
      return '設備重複';
    case 'org-resource-conflict':
      return '組織リソース衝突';
    case 'transportation-overlap':
      return '送迎重複';
    case 'user-life-care-vs-support':
      return '利用者×生活介護/支援';
    case 'user-life-support-vs-support':
      return '利用者×生活支援同士';
    case 'staff-life-support-vs-staff':
      return '職員×生活支援';
    default:
      return '重複';
  }
}
