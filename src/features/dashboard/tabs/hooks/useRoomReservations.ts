/**
 * useRoomReservations — 予約の状態管理とハンドラー
 *
 * RoomStatusTab から抽出 (#766)
 */
import { useMemo, useState } from 'react';
import type { Reservation } from '../roomStatusConstants';
import { getDateString } from '../roomStatusConstants';
import { safeFormatDate } from '@/lib/dateFormat';

export function useRoomReservations() {
  const today = new Date();
  const todayStr = getDateString(today);

  const [reservations, setReservations] = useState<Reservation[]>([
    { id: 1, date: todayStr, room: 'プレイルーム', slot: 'AM', group: '生活支援', detail: '09:30~' },
    { id: 2, date: todayStr, room: '和室（中）', slot: 'PM', group: '会議', detail: '14:00~' },
  ]);

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [activeTab, setActiveTab] = useState<'today' | 'month'>('today');
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());

  const [room, setRoom] = useState('プレイルーム');
  const [slot, setSlot] = useState<'AM' | 'PM'>('AM');
  const [group, setGroup] = useState('生活支援');
  const [detail, setDetail] = useState('');
  const [openClearDialog, setOpenClearDialog] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const filteredReservations = useMemo(
    () => reservations.filter(res => res.date === selectedDate),
    [reservations, selectedDate]
  );

  const isOccupied = (roomName: string, roomSlot: 'AM' | 'PM', date?: string) => {
    const checkDate = date || selectedDate;
    return reservations.some(res => res.date === checkDate && res.room === roomName && res.slot === roomSlot);
  };

  const handleAddReservation = (e: React.FormEvent) => {
    e.preventDefault();
    const idx = reservations.findIndex(
      res => res.date === selectedDate && res.room === room && res.slot === slot
    );

    const newRes: Reservation = {
      id: Date.now(),
      date: selectedDate,
      room,
      slot,
      group,
      detail: detail || '-',
    };

    if (idx > -1) {
      const updated = [...reservations];
      updated[idx] = newRes;
      setReservations(updated);
    } else {
      setReservations([...reservations, newRes]);
    }

    setDetail('');
    setSubmitSuccess(true);
    setTimeout(() => setSubmitSuccess(false), 1800);
  };

  const handleDeleteReservation = (id: number) => {
    setReservations(reservations.filter(res => res.id !== id));
  };

  const handleClearAll = () => {
    setReservations([]);
    setOpenClearDialog(false);
  };

  const handleChangeMonth = (delta: number) => {
    if (delta === 0) {
      setCurrentMonthDate(new Date());
    } else {
      const newDate = new Date(currentMonthDate);
      newDate.setMonth(newDate.getMonth() + delta);
      setCurrentMonthDate(newDate);
    }
  };

  const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
  const formatDateDisplay = (date: string): string =>
    safeFormatDate(date, (d) => `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_LABELS[d.getDay()]})`, date);

  const calendarDays = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    const days: Array<{ date: string; day: number } | null> = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    for (let day = 1; day <= lastDate; day++) {
      days.push({
        date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        day,
      });
    }
    return days;
  }, [currentMonthDate]);

  return {
    today,
    todayStr,
    reservations,
    selectedDate,
    setSelectedDate,
    activeTab,
    setActiveTab,
    currentMonthDate,
    room,
    setRoom,
    slot,
    setSlot,
    group,
    setGroup,
    detail,
    setDetail,
    openClearDialog,
    setOpenClearDialog,
    submitSuccess,
    filteredReservations,
    isOccupied,
    handleAddReservation,
    handleDeleteReservation,
    handleClearAll,
    handleChangeMonth,
    formatDateDisplay,
    calendarDays,
  };
}
