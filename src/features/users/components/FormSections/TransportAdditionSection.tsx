/**
 * TransportAdditionSection
 *
 * 送迎・通所情報 + 支援区分・ステータス + 請求・加算情報セクション。
 * - 曜日 × 往路/復路 の送迎手段マトリクス
 * - 強度行動障害フラグ・IsActive フラグ
 * - 送迎加算区分・食事提供加算・自己負担支払方法
 */
import TransportIcon from '@mui/icons-material/DirectionsBus';
import {
    Box,
    Checkbox,
    FormControlLabel,
    MenuItem,
    TextField,
    Typography,
} from '@mui/material';
import type { ChangeEvent } from 'react';
import {
    COPAY_METHOD_OPTIONS,
    MEAL_ADDITION_OPTIONS,
    TRANSPORT_ADDITION_OPTIONS,
    TRANSPORT_COURSE_OPTIONS,
    TRANSPORT_METHOD_OPTIONS,
    WEEKDAYS,
} from '../../useUserForm';
import type { FormSectionProps } from './types';

type Props = FormSectionProps & {
  handleSupportTargetToggle: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function TransportAdditionSection({
  values,
  errors,
  setField,
  setScheduleDay,
  handleSupportTargetToggle,
}: Props) {
  return (
    <>
      {/* 送迎・通所情報 — 曜日×往復グリッド */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h6"
          sx={{ mb: 2, color: 'primary.main', display: 'flex', alignItems: 'center' }}
        >
          <TransportIcon sx={{ mr: 1 }} />
          送迎・通所情報
        </Typography>

        <TextField
          fullWidth
          label="送迎固定コース"
          select
          size="small"
          value={values.TransportCourse}
          onChange={(event) => setField('TransportCourse', event.target.value)}
          helperText="未設定可。設定すると配車表のコース補完で優先されます。"
          sx={{ mb: 2 }}
        >
          {TRANSPORT_COURSE_OPTIONS.map((opt) => (
            <MenuItem key={opt.value || 'unset'} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>

        <Box
          component="table"
          sx={{
            width: '100%',
            borderCollapse: 'collapse',
            '& th, & td': {
              py: 0.75,
              px: 1,
              borderBottom: '1px solid',
              borderColor: 'divider',
              fontSize: '0.875rem',
            },
            '& th': {
              fontWeight: 600,
              textAlign: 'center',
              backgroundColor: 'action.hover',
              whiteSpace: 'nowrap',
            },
          }}
        >
          <thead>
            <tr>
              <Box component="th" sx={{ width: 48, textAlign: 'center' }}>曜日</Box>
              <Box component="th">通所（往路）</Box>
              <Box component="th">帰所（復路）</Box>
            </tr>
          </thead>
          <tbody>
            {WEEKDAYS.map((day) => {
              const entry = values.TransportSchedule[day.value] ?? { to: '', from: '' };
              const hasEntry = !!(entry.to || entry.from);
              return (
                <tr key={day.value}>
                  <Box
                    component="td"
                    sx={{
                      fontWeight: 600,
                      textAlign: 'center',
                      color: hasEntry ? 'primary.main' : 'text.secondary',
                    }}
                  >
                    {day.label}
                  </Box>
                  <td>
                    <TextField
                      fullWidth
                      select
                      size="small"
                      variant="standard"
                      value={entry.to}
                      onChange={(e) => setScheduleDay(day.value, 'to', e.target.value)}
                      sx={{ minWidth: 120 }}
                    >
                      {TRANSPORT_METHOD_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </td>
                  <td>
                    <TextField
                      fullWidth
                      select
                      size="small"
                      variant="standard"
                      value={entry.from}
                      onChange={(e) => setScheduleDay(day.value, 'from', e.target.value)}
                      sx={{ minWidth: 120 }}
                    >
                      {TRANSPORT_METHOD_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          ※ 曜日の送迎手段を設定すると、その日が通所予定日として自動登録されます
        </Typography>
      </Box>

      {/* 支援区分・ステータス + 請求・加算情報 */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
          支援区分・ステータス
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
            基本ステータス
          </Typography>

          <FormControlLabel
            control={
              <Checkbox
                checked={values.IsHighIntensitySupportTarget}
                onChange={handleSupportTargetToggle}
              />
            }
            label="強度行動障害支援対象者"
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={values.IsActive}
                onChange={(event) => setField('IsActive', event.target.checked)}
              />
            }
            label="利用中フラグ（システム内部用）"
          />
        </Box>

        <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
            請求・加算情報
          </Typography>

          <TextField
            fullWidth
            label="送迎加算区分"
            select
            size="small"
            value={values.TransportAdditionType}
            onChange={(event) => setField('TransportAdditionType', event.target.value)}
            error={Boolean(errors.transportAddition)}
            helperText={errors.transportAddition || "送迎加算の請求区分（往復／片道／なし）"}
          >
            {TRANSPORT_ADDITION_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            fullWidth
            label="食事提供体制加算"
            select
            size="small"
            value={values.MealAddition}
            onChange={(event) => setField('MealAddition', event.target.value)}
          >
            {MEAL_ADDITION_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            fullWidth
            label="利用者負担金支払方法"
            select
            size="small"
            value={values.CopayPaymentMethod}
            onChange={(event) => setField('CopayPaymentMethod', event.target.value)}
          >
            {COPAY_METHOD_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Box>
    </>
  );
}
