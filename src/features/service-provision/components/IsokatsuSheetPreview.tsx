/**
 * IsokatsuSheetPreview — いそかつ書式風の帳票プレビューコンポーネント
 *
 * 「生活介護サービス提供実績記録票」をHTML/CSSで再現。
 * 印刷にも対応（@media print）。
 */
import type { ServiceProvisionRecord } from '@/features/service-provision/domain/types';
import { Box, Typography } from '@mui/material';
import React from 'react';

// ─── 型 ────────────────────────────────────────────────

export interface IsokatsuSheetPreviewProps {
  /** 年月 YYYY-MM */
  yearMonth: string;
  /** 利用者名 */
  userName: string;
  /** 受給者証番号（10桁） */
  recipientCertNumber?: string;
  /** 障害支援区分 */
  supportGrade?: number;
  /** 契約支給量（日数） */
  contractDays?: number;
  /** 事業所番号 */
  facilityNumber?: string;
  /** 事業所名 */
  facilityName?: string;
  /** 日次レコード */
  records: ServiceProvisionRecord[];
}

// ─── ヘルパー ────────────────────────────────────────────

const WEEKDAY = ['日', '月', '火', '水', '木', '金', '土'];

function getWareki(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const reiwa = y - 2018;
  return `令和${reiwa}年${m}月分`;
}

function getDaysInMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function getWeekday(yearMonth: string, day: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  return WEEKDAY[new Date(y, m - 1, day).getDay()];
}

function formatTime(hhmm: number | null | undefined): string {
  if (hhmm == null) return '';
  const h = Math.floor(hhmm / 100);
  const m = hhmm % 100;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function isWeekend(yearMonth: string, day: number): boolean {
  const [y, m] = yearMonth.split('-').map(Number);
  const dow = new Date(y, m - 1, day).getDay();
  return dow === 0 || dow === 6;
}

// ─── スタイル定数 ────────────────────────────────────────

const cellBorder = '1px solid #333';
const headerBg = '#e8f0fe';
const weekendBg = '#f5f5f5';

const cellSx = {
  border: cellBorder,
  padding: '2px 4px',
  fontSize: '11px',
  textAlign: 'center' as const,
  lineHeight: '1.3',
  whiteSpace: 'nowrap' as const,
};

const headerSx = {
  ...cellSx,
  backgroundColor: headerBg,
  fontWeight: 700,
  fontSize: '10px',
};

// ─── コンポーネント ──────────────────────────────────────

const IsokatsuSheetPreview: React.FC<IsokatsuSheetPreviewProps> = ({
  yearMonth,
  userName,
  recipientCertNumber = '',
  // supportGrade is available in props but not rendered in the sheet preview
  contractDays = 23,
  facilityNumber = '1410700510',
  facilityName = '磯子区障害者地域活動ホーム',
  records,
}) => {
  const maxDay = getDaysInMonth(yearMonth);
  const certDigits = (recipientCertNumber || '').padStart(10, '0').split('');
  const facDigits = facilityNumber.padStart(10, '0').split('');

  // Records by day
  const recordByDay = new Map<number, ServiceProvisionRecord>();
  for (const r of records) {
    const day = parseInt(r.recordDateISO.slice(8, 10), 10);
    recordByDay.set(day, r);
  }

  // 集計
  let totalPickup = 0;
  let totalDropoff = 0;
  let totalMeal = 0;
  let totalBath = 0;
  let totalDays = 0;

  for (const r of records) {
    if (r.status === '提供') totalDays++;
    if (r.hasTransportPickup) totalPickup++;
    if (r.hasTransportDropoff) totalDropoff++;
    if (r.hasMeal) totalMeal++;
    if (r.hasBath) totalBath++;
  }

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 1100,
        mx: 'auto',
        fontFamily: '"MS Gothic", "ＭＳ ゴシック", monospace',
        fontSize: '11px',
        '@media print': {
          maxWidth: 'none',
          '& *': { fontSize: '9px !important' },
        },
      }}
    >
      {/* ── タイトル行 ──────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
        <Typography sx={{ fontSize: '11px', fontFamily: 'inherit' }}>
          {getWareki(yearMonth)}
        </Typography>
        <Typography sx={{ fontSize: '14px', fontWeight: 700, fontFamily: 'inherit', letterSpacing: 2 }}>
          生活介護サービス提供実績記録票
        </Typography>
      </Box>

      {/* ── ヘッダ情報 ─────────────────────────── */}
      <Box
        component="table"
        sx={{
          width: '100%',
          borderCollapse: 'collapse',
          mb: 0.5,
          '& td': { border: cellBorder, padding: '2px 6px', fontSize: '11px' },
        }}
      >
        <tbody>
          <tr>
            <td rowSpan={2} style={{ width: 90, ...headerSx }}>受給者証<br />番{'　　'}号</td>
            {certDigits.map((d, i) => (
              <td key={`cert-${i}`} style={{ width: 24, textAlign: 'center' }}>{d}</td>
            ))}
            <td rowSpan={2} style={{ width: 110, ...headerSx }}>支給決定障害者氏名</td>
            <td rowSpan={2} style={{ fontWeight: 700, fontSize: '13px', textAlign: 'center' }}>{userName}</td>
            <td rowSpan={2} style={{ width: 70, ...headerSx }}>事業所番号</td>
            {facDigits.map((d, i) => (
              <td key={`fac-${i}`} style={{ width: 24, textAlign: 'center' }}>{d}</td>
            ))}
          </tr>
          <tr>
            {/* 2行目: 区分 */}
            {certDigits.map((_, i) => (
              <td key={`cert2-${i}`} style={{ height: 0, padding: 0, border: 'none' }} />
            ))}
            {facDigits.map((_, i) => (
              <td key={`fac2-${i}`} style={{ height: 0, padding: 0, border: 'none' }} />
            ))}
          </tr>
          <tr>
            <td style={headerSx}>契約支給量</td>
            <td colSpan={10} style={{ fontSize: '11px' }}>{contractDays}日</td>
            <td style={headerSx}>事業者及び<br />その事業所</td>
            <td colSpan={11} style={{ fontSize: '11px', fontWeight: 500 }}>{facilityName}</td>
          </tr>
        </tbody>
      </Box>

      {/* ── 日次データテーブル ─────────────────── */}
      <Box
        component="table"
        sx={{
          width: '100%',
          borderCollapse: 'collapse',
          '& td, & th': cellSx,
        }}
      >
        <thead>
          <tr>
            <th rowSpan={2} style={{ ...headerSx, width: 28 }}>日付</th>
            <th rowSpan={2} style={{ ...headerSx, width: 24 }}>曜日</th>
            <th colSpan={5} style={headerSx}>サービス提供実績</th>
            <th colSpan={2} style={headerSx}>送迎加算</th>
            <th rowSpan={2} style={{ ...headerSx, width: 40 }}>食事提供<br />加算</th>
            <th rowSpan={2} style={{ ...headerSx, width: 40 }}>入浴支援<br />加算</th>
            <th rowSpan={2} style={{ ...headerSx, width: 48 }}>利用者<br />確認欄</th>
            <th rowSpan={2} style={{ ...headerSx, minWidth: 80 }}>備考</th>
          </tr>
          <tr>
            <th style={{ ...headerSx, width: 52 }}>サービス提供<br />の状況</th>
            <th style={{ ...headerSx, width: 52 }}>開始時間</th>
            <th style={{ ...headerSx, width: 52 }}>終了時間</th>
            <th style={{ ...headerSx, width: 36 }}>算定<br />時間数</th>
            <th style={{ ...headerSx, width: 28 }}>往</th>
            <th style={{ ...headerSx, width: 28 }}>復</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
            if (day > maxDay) return null;
            const weekend = isWeekend(yearMonth, day);
            const record = recordByDay.get(day);
            const rowBg = weekend ? weekendBg : undefined;
            const weekdayStr = getWeekday(yearMonth, day);
            const weekdayColor = weekdayStr === '日' ? '#d32f2f' : weekdayStr === '土' ? '#1565c0' : undefined;

            return (
              <tr key={day} style={{ backgroundColor: rowBg }}>
                <td>{day}</td>
                <td style={{ color: weekdayColor, fontWeight: weekdayColor ? 700 : undefined }}>{weekdayStr}</td>
                <td>{record?.status || ''}</td>
                <td>{record?.status === '提供' ? formatTime(record?.startHHMM) : ''}</td>
                <td>{record?.status === '提供' ? formatTime(record?.endHHMM) : ''}</td>
                <td>{/* timeCode - calculated */}</td>
                <td>{record?.hasTransportPickup ? '1' : ''}</td>
                <td>{record?.hasTransportDropoff ? '1' : ''}</td>
                <td>{record?.hasMeal ? '1' : ''}</td>
                <td>{record?.hasBath ? '1' : ''}</td>
                <td>{/* userConfirm */}</td>
                <td style={{ textAlign: 'left', fontSize: '10px', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {record?.note || ''}
                </td>
              </tr>
            );
          })}
          {/* 合計行 */}
          <tr style={{ backgroundColor: headerBg, fontWeight: 700 }}>
            <td colSpan={2}>合{'　'}計</td>
            <td>{totalDays > 0 ? `${totalDays}日` : ''}</td>
            <td colSpan={2}></td>
            <td></td>
            <td>{totalPickup > 0 ? `${totalPickup}回` : ''}</td>
            <td>{totalDropoff > 0 ? `${totalDropoff}回` : ''}</td>
            <td>{totalMeal > 0 ? `${totalMeal}回` : ''}</td>
            <td>{totalBath > 0 ? `${totalBath}回` : ''}</td>
            <td></td>
            <td></td>
          </tr>
        </tbody>
      </Box>

      {/* ── フッタ ──────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5, fontSize: '10px', color: '#666' }}>
        <span>1枚中 1枚</span>
      </Box>
    </Box>
  );
};

export default IsokatsuSheetPreview;
