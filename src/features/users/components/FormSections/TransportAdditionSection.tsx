/**
 * TransportAdditionSection
 *
 * 送迎・通所情報 + 支援区分・ステータス + 請求・加算情報セクション。
 * - 送迎（往路 / 復路）・通所予定日の曜日チェックボックス
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
    WEEKDAYS,
} from '../../useUserForm';
import type { DayField, FormSectionProps } from './types';

type Props = FormSectionProps & {
  handleSupportTargetToggle: (event: ChangeEvent<HTMLInputElement>) => void;
};

type WeekdayGroupProps = {
  label: string;
  field: DayField;
  selectedDays: string[];
  toggleDay: (day: string, field: DayField) => void;
};

function WeekdayGroup({ label, field, selectedDays, toggleDay }: WeekdayGroupProps) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {WEEKDAYS.map((day) => {
          const checked = selectedDays.includes(day.value);
          return (
            <FormControlLabel
              key={day.value}
              control={
                <Checkbox
                  checked={checked}
                  onChange={() => toggleDay(day.value, field)}
                  size="small"
                />
              }
              label={day.label}
              sx={{
                border: '1px solid',
                borderColor: checked ? 'primary.main' : 'grey.300',
                backgroundColor: checked ? 'primary.light' : 'transparent',
                borderRadius: 1,
                px: 1,
                py: 0.5,
                m: 0,
                '& .MuiFormControlLabel-label': { fontSize: '0.875rem' },
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
}

export function TransportAdditionSection({
  values,
  errors,
  setField,
  toggleDay,
  handleSupportTargetToggle,
}: Props) {
  return (
    <>
      {/* 送迎・通所情報 */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h6"
          sx={{ mb: 2, color: 'primary.main', display: 'flex', alignItems: 'center' }}
        >
          <TransportIcon sx={{ mr: 1 }} />
          送迎・通所情報
        </Typography>

        <WeekdayGroup
          label="送迎（往路）"
          field="TransportToDays"
          selectedDays={values.TransportToDays}
          toggleDay={toggleDay}
        />
        <WeekdayGroup
          label="送迎（復路）"
          field="TransportFromDays"
          selectedDays={values.TransportFromDays}
          toggleDay={toggleDay}
        />
        <WeekdayGroup
          label="通所予定日"
          field="AttendanceDays"
          selectedDays={values.AttendanceDays}
          toggleDay={toggleDay}
        />
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
