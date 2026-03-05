/**
 * IsokatsuSheetPreview — いそかつ書式を忠実に再現した帳票プレビュー
 *
 * 「生活介護サービス提供実績記録票」の原本Excelを完全再現。
 * 全13列 + 初期加算/集中的支援加算フッタ + 斜線 + 枚数表記
 */
import type { ServiceProvisionRecord } from '@/features/service-provision/domain/types';
import { Box } from '@mui/material';
import React from 'react';

// ─── 型 ────────────────────────────────────────────────

export interface IsokatsuSheetPreviewProps {
  yearMonth: string;
  userName: string;
  recipientCertNumber?: string;
  supportGrade?: number;
  contractDays?: number;
  facilityNumber?: string;
  facilityName?: string;
  records: ServiceProvisionRecord[];
}

// ─── ヘルパー ────────────────────────────────────────────

const WEEKDAY = ['\u65E5', '\u6708', '\u706B', '\u6C34', '\u6728', '\u91D1', '\u571F'];

function getWareki(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const reiwa = y - 2018;
  return `\u4EE4\u548C${reiwa}\u5E74\u3000${m}\u6708\u5206`;
}

function getDaysInMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function getWeekday(yearMonth: string, day: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  return WEEKDAY[new Date(y, m - 1, day).getDay()];
}

function fmtTime(hhmm: number | null | undefined): string {
  if (hhmm == null) return '';
  const h = Math.floor(hhmm / 100);
  const m = hhmm % 100;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function isWeekendDay(yearMonth: string, day: number): boolean {
  const [y, m] = yearMonth.split('-').map(Number);
  const dow = new Date(y, m - 1, day).getDay();
  return dow === 0 || dow === 6;
}

// ─── スタイル ────────────────────────────────────────────

const B = '1px solid #222';
const BG_HEADER = '#d9e2f3';
const BG_WEEKEND = '#f2f2f2';

const thSx: React.CSSProperties = {
  border: B, padding: '1px 2px', fontSize: '8.5px', textAlign: 'center',
  fontWeight: 700, backgroundColor: BG_HEADER, lineHeight: '1.2',
  whiteSpace: 'nowrap', verticalAlign: 'middle',
};

const tdSx: React.CSSProperties = {
  border: B, padding: '1px 3px', fontSize: '10px', textAlign: 'center',
  lineHeight: '1.3', whiteSpace: 'nowrap', verticalAlign: 'middle',
  height: 18,
};

// 斜線セル用
const slashCellSx: React.CSSProperties = {
  ...tdSx,
  background: 'linear-gradient(to top right, transparent 49.5%, #999 49.5%, #999 50.5%, transparent 50.5%)',
};

// ─── コンポーネント ──────────────────────────────────────

const IsokatsuSheetPreview: React.FC<IsokatsuSheetPreviewProps> = ({
  yearMonth,
  userName,
  recipientCertNumber = '',
  // supportGrade available in props but not rendered directly
  contractDays = 23,
  facilityNumber = '1410700510',
  facilityName = '\u78EF\u5B50\u533A\u969C\u5BB3\u8005\u5730\u57DF\u6D3B\u52D5\u30DB\u30FC\u30E0',
  records,
}) => {
  const maxDay = getDaysInMonth(yearMonth);
  const certDigits = (recipientCertNumber || '').padStart(10, '0').split('');
  const facDigits = facilityNumber.padStart(10, '0').split('');

  const recordByDay = new Map<number, ServiceProvisionRecord>();
  for (const r of records) {
    const day = parseInt(r.recordDateISO.slice(8, 10), 10);
    recordByDay.set(day, r);
  }

  // 集計
  let tPickup = 0, tDropoff = 0, tMeal = 0, tBath = 0, tDays = 0;
  for (const r of records) {
    if (r.status === '\u63D0\u4F9B') tDays++;
    if (r.hasTransportPickup) tPickup++;
    if (r.hasTransportDropoff) tDropoff++;
    if (r.hasMeal) tMeal++;
    if (r.hasBath) tBath++;
  }

  // 全列数: 日付(1) + 曜日(1) + 状況(1) + 開始(1) + 終了(1) + 算定(1) + 往(1) + 復(1) + 訪問(1) + 食事(1) + 体験(1) + 入浴(1) + 喀痰(1) + 緊急(1) + 集中(1) + 確認(1) + 備考(1) = 17
  const TOTAL_COLS = 17;

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 1000,
        mx: 'auto',
        fontFamily: '"Yu Gothic", "Meiryo", sans-serif',
        fontSize: '10px',
        '@media print': {
          maxWidth: 'none',
          '& *': { fontSize: '8px !important' },
        },
      }}
    >
      {/* ── タイトル ──────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: '2px' }}>
        <span style={{ fontSize: '10px' }}>{getWareki(yearMonth)}</span>
        <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: 3 }}>
          {'\u751F\u6D3B\u4ECB\u8B77\u30B5\u30FC\u30D3\u30B9\u63D0\u4F9B\u5B9F\u7E3E\u8A18\u9332\u7968'}
        </span>
      </Box>

      {/* ── ヘッダ情報テーブル ─────────────────── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 2 }}>
        <tbody>
          {/* 受給者証番号 + 氏名 + 事業所番号 */}
          <tr>
            <td rowSpan={2} style={{ ...thSx, width: 70, fontSize: '8px' }}>
              {'\u53D7\u7D66\u8005\u8A3C'}<br />{'\u756A'}&nbsp;&nbsp;&nbsp;&nbsp;{'\u53F7'}
            </td>
            {certDigits.map((d, i) => (
              <td key={`c${i}`} style={{ ...tdSx, width: 18, fontSize: '10px', padding: '1px' }}>{d}</td>
            ))}
            <td rowSpan={2} style={{ ...thSx, width: 100, fontSize: '8px' }}>
              {'\u652F\u7D66\u6C7A\u5B9A\u969C\u5BB3\u8005\u6C0F\u540D'}
            </td>
            <td rowSpan={2} style={{ ...tdSx, fontWeight: 700, fontSize: '12px', minWidth: 80 }}>{userName}</td>
            <td rowSpan={2} style={{ ...thSx, width: 60, fontSize: '8px' }}>
              {'\u4E8B\u696D\u6240\u756A\u53F7'}
            </td>
            {facDigits.map((d, i) => (
              <td key={`f${i}`} style={{ ...tdSx, width: 18, fontSize: '10px', padding: '1px' }}>{d}</td>
            ))}
          </tr>
          <tr>
            <td colSpan={10} style={{ border: 'none', height: 0, padding: 0 }} />
            <td colSpan={10} style={{ border: 'none', height: 0, padding: 0 }} />
          </tr>
          {/* 契約支給量 + 事業所名 */}
          <tr>
            <td style={{ ...thSx, fontSize: '8px' }}>{'\u5951\u7D04\u652F\u7D66\u91CF'}</td>
            <td colSpan={10} style={tdSx}>{contractDays}</td>
            <td style={{ ...thSx, fontSize: '7.5px' }}>
              {'\u4E8B\u696D\u8005\u53CA\u3073'}<br />{'\u305D\u306E\u4E8B\u696D\u6240'}
            </td>
            <td colSpan={11} style={{ ...tdSx, fontSize: '9px', textAlign: 'left', paddingLeft: 4 }}>
              {facilityName}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── 日次データテーブル ─────────────────── */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          {/* ヘッダ1行目 */}
          <tr>
            <th rowSpan={2} style={{ ...thSx, width: 22 }}>{'\u65E5\u4ED8'}</th>
            <th rowSpan={2} style={{ ...thSx, width: 20 }}>{'\u66DC\u65E5'}</th>
            <th colSpan={4} style={thSx}>{'\u30B5\u30FC\u30D3\u30B9\u63D0\u4F9B\u5B9F\u7E3E'}</th>
            <th colSpan={2} style={thSx}>{'\u9001\u8FCE\u52A0\u7B97'}</th>
            <th rowSpan={2} style={{ ...thSx, width: 36, fontSize: '7px' }}>
              {'\u8A2A\u554F\u652F\u63F4'}<br />{'\u7279\u5225\u52A0\u7B97'}
            </th>
            <th rowSpan={2} style={{ ...thSx, width: 30, fontSize: '7px' }}>
              {'\u98DF\u4E8B\u63D0\u4F9B'}<br />{'\u52A0\u7B97'}
            </th>
            <th rowSpan={2} style={{ ...thSx, width: 36, fontSize: '7px' }}>
              {'\u4F53\u9A13\u5229\u7528'}<br />{'\u652F\u63F4\u52A0\u7B97'}
            </th>
            <th rowSpan={2} style={{ ...thSx, width: 30, fontSize: '7px' }}>
              {'\u5165\u6D74\u652F\u63F4'}<br />{'\u52A0\u7B97'}
            </th>
            <th rowSpan={2} style={{ ...thSx, width: 36, fontSize: '7px' }}>
              {'\u5580\u75F0\u5438\u5F15\u7B49'}<br />{'\u5B9F\u65BD\u52A0\u7B97'}
            </th>
            <th rowSpan={2} style={{ ...thSx, width: 36, fontSize: '7px' }}>
              {'\u7DCA\u6025\u6642'}<br />{'\u53D7\u5165\u52A0\u7B97'}
            </th>
            <th rowSpan={2} style={{ ...thSx, width: 36, fontSize: '7px' }}>
              {'\u96C6\u4E2D\u7684'}<br />{'\u652F\u63F4\u52A0\u7B97'}
            </th>
            <th rowSpan={2} style={{ ...thSx, width: 34, fontSize: '7px' }}>
              {'\u5229\u7528\u8005'}<br />{'\u78BA\u8A8D\u6B04'}
            </th>
            <th rowSpan={2} style={{ ...thSx, minWidth: 50, fontSize: '7.5px' }}>
              {'\u5099'}&nbsp;&nbsp;{'\u8003'}
            </th>
          </tr>
          {/* ヘッダ2行目 */}
          <tr>
            <th style={{ ...thSx, width: 44, fontSize: '7px' }}>
              {'\u30B5\u30FC\u30D3\u30B9\u63D0\u4F9B'}<br />{'\u306E\u72B6\u6CC1'}
            </th>
            <th style={{ ...thSx, width: 44, fontSize: '7.5px' }}>{'\u958B\u59CB\u6642\u9593'}</th>
            <th style={{ ...thSx, width: 44, fontSize: '7.5px' }}>{'\u7D42\u4E86\u6642\u9593'}</th>
            <th style={{ ...thSx, width: 28, fontSize: '7px' }}>
              {'\u7B97\u5B9A'}<br />{'\u6642\u9593\u6570'}
            </th>
            <th style={{ ...thSx, width: 20 }}>{'\u5F80'}</th>
            <th style={{ ...thSx, width: 20 }}>{'\u5FA9'}</th>
          </tr>
        </thead>
        <tbody>
          {/* 日次行 1〜31 */}
          {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
            const overMax = day > maxDay;
            const weekend = !overMax && isWeekendDay(yearMonth, day);
            const record = overMax ? undefined : recordByDay.get(day);
            const bg = weekend ? BG_WEEKEND : undefined;
            const wd = overMax ? '' : getWeekday(yearMonth, day);
            const wdColor = wd === '\u65E5' ? '#c00' : wd === '\u571F' ? '#00c' : undefined;

            if (overMax) {
              // 月の日数を超える行 → 斜線
              return (
                <tr key={day}>
                  <td style={slashCellSx}>{day}</td>
                  <td style={slashCellSx} />
                  <td style={slashCellSx} />
                  <td style={slashCellSx} />
                  <td style={slashCellSx} />
                  <td style={slashCellSx} />
                  <td style={slashCellSx} />
                  <td style={slashCellSx} />
                  <td style={slashCellSx} />
                  <td style={slashCellSx} />
                  <td style={slashCellSx} />
                  <td style={slashCellSx} />
                  <td style={slashCellSx} />
                  <td style={slashCellSx} />
                  <td style={slashCellSx} />
                  <td style={slashCellSx} />
                  <td style={slashCellSx} />
                </tr>
              );
            }

            return (
              <tr key={day} style={{ backgroundColor: bg }}>
                <td style={tdSx}>{day}</td>
                <td style={{ ...tdSx, color: wdColor, fontWeight: wdColor ? 700 : undefined }}>{wd}</td>
                <td style={{ ...tdSx, fontSize: '9px' }}>{record?.status || ''}</td>
                <td style={tdSx}>{record?.status === '\u63D0\u4F9B' ? fmtTime(record?.startHHMM) : ''}</td>
                <td style={tdSx}>{record?.status === '\u63D0\u4F9B' ? fmtTime(record?.endHHMM) : ''}</td>
                <td style={tdSx}>{/* 算定時間数 */}</td>
                <td style={tdSx}>{record?.hasTransportPickup ? '1' : ''}</td>
                <td style={tdSx}>{record?.hasTransportDropoff ? '1' : ''}</td>
                <td style={tdSx}>{/* 訪問支援特別 */}</td>
                <td style={tdSx}>{record?.hasMeal ? '1' : ''}</td>
                <td style={tdSx}>{/* 体験利用支援 */}</td>
                <td style={tdSx}>{record?.hasBath ? '1' : ''}</td>
                <td style={tdSx}>{/* 喀痰吸引等 */}</td>
                <td style={tdSx}>{/* 緊急時受入 */}</td>
                <td style={tdSx}>{/* 集中的支援 */}</td>
                <td style={tdSx}>{/* 利用者確認 */}</td>
                <td style={{ ...tdSx, textAlign: 'left', fontSize: '8px', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {record?.note || ''}
                </td>
              </tr>
            );
          })}

          {/* 合計行 */}
          <tr style={{ backgroundColor: BG_HEADER }}>
            <td colSpan={2} style={{ ...tdSx, fontWeight: 700 }}>{'\u5408'}&nbsp;&nbsp;{'\u8A08'}</td>
            <td style={tdSx}></td>
            <td style={tdSx}></td>
            <td style={tdSx}></td>
            <td style={{ ...tdSx, fontWeight: 700 }}>{tDays > 0 ? `${tDays}` : ''}</td>
            <td style={{ ...tdSx, fontSize: '8px' }}>{tPickup > 0 ? `${tPickup}\u56DE` : ''}</td>
            <td style={{ ...tdSx, fontSize: '8px' }}>{tDropoff > 0 ? `${tDropoff}\u56DE` : ''}</td>
            <td style={{ ...tdSx, fontSize: '8px' }}></td>
            <td style={{ ...tdSx, fontSize: '8px' }}>{tMeal > 0 ? `${tMeal}\u56DE` : ''}</td>
            <td style={{ ...tdSx, fontSize: '8px' }}></td>
            <td style={{ ...tdSx, fontSize: '8px' }}>{tBath > 0 ? `${tBath}\u56DE` : ''}</td>
            <td style={{ ...tdSx, fontSize: '8px' }}></td>
            <td style={{ ...tdSx, fontSize: '8px' }}></td>
            <td style={{ ...tdSx, fontSize: '8px' }}></td>
            <td style={tdSx}></td>
            <td style={tdSx}></td>
          </tr>
        </tbody>
      </table>

      {/* ── フッタ: 初期加算・集中的支援加算 ──── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}>
        <tbody>
          <tr>
            <td style={{ ...thSx, width: 70, fontSize: '8px' }}>{'\u521D\u671F\u52A0\u7B97'}</td>
            <td style={{ ...thSx, width: 60, fontSize: '8px' }}>{'\u5229\u7528\u958B\u59CB\u65E5'}</td>
            <td style={{ ...tdSx, width: 120, fontSize: '9px' }}>
              &nbsp;&nbsp;&nbsp;{'\u5E74'}&nbsp;&nbsp;&nbsp;{'\u6708'}&nbsp;&nbsp;&nbsp;{'\u65E5'}
            </td>
            <td style={{ ...thSx, width: 40, fontSize: '8px' }}>{'30\u65E5\u76EE'}</td>
            <td style={{ ...tdSx, width: 120, fontSize: '9px' }}>
              &nbsp;&nbsp;&nbsp;{'\u5E74'}&nbsp;&nbsp;&nbsp;{'\u6708'}&nbsp;&nbsp;&nbsp;{'\u65E5'}
            </td>
            <td style={{ ...thSx, width: 70, fontSize: '8px' }}>{'\u5F53\u6708\u7B97\u5B9A\u65E5\u6570'}</td>
            <td style={{ ...tdSx, width: 60, fontSize: '9px' }}>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{'\u65E5'}
            </td>
          </tr>
          <tr>
            <td style={{ ...thSx, fontSize: '7px' }}>{'\u96C6\u4E2D\u7684\u652F\u63F4\u52A0\u7B97'}</td>
            <td style={{ ...thSx, fontSize: '8px' }}>{'\u652F\u63F4\u958B\u59CB\u65E5'}</td>
            <td style={{ ...tdSx, fontSize: '9px' }}>
              &nbsp;&nbsp;&nbsp;{'\u5E74'}&nbsp;&nbsp;&nbsp;{'\u6708'}&nbsp;&nbsp;&nbsp;{'\u65E5'}
            </td>
            <td colSpan={4} style={{ border: 'none' }} />
          </tr>
        </tbody>
      </table>

      {/* ── 枚数 ──────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: '4px', fontSize: '9px', color: '#333' }}>
        <span>1 {'\u679A\u4E2D'}&nbsp;&nbsp;1 {'\u679A'}</span>
      </Box>
    </Box>
  );
};

export default IsokatsuSheetPreview;
