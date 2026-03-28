/**
 * ContractSection
 *
 * 契約・サービス情報 + 支給決定情報を表示するセクション。
 * - 事業所との契約情報（契約日・開始日・終了日・利用ステータス）
 * - 支給決定情報（市町村・期間・障害支援区分・支給量）
 */
import MedicalIcon from '@mui/icons-material/LocalHospital';
import { Box, TextField, Typography } from '@mui/material';
import {
    DISABILITY_SUPPORT_LEVEL_OPTIONS,
    USAGE_STATUS_OPTIONS,
} from '../../useUserForm';
import type { FormSectionProps } from './types';

type Props = FormSectionProps;

export function ContractSection({ formIdPrefix, values, errors, setField }: Props) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography
        variant="h6"
        sx={{ mb: 2, color: 'primary.main', display: 'flex', alignItems: 'center' }}
      >
        <MedicalIcon sx={{ mr: 1 }} />
        契約・サービス情報
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* 事業所との契約情報 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
            事業所との契約情報
          </Typography>

          <TextField
            id={`${formIdPrefix}-contract-date`}
            name="ContractDate"
            fullWidth
            label="契約日"
            type="date"
            value={values.ContractDate}
            onChange={(event) => setField('ContractDate', event.target.value)}
            variant="outlined"
            size="small"
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            id={`${formIdPrefix}-service-start-date`}
            name="ServiceStartDate"
            fullWidth
            label="サービス開始日"
            type="date"
            value={values.ServiceStartDate}
            onChange={(event) => setField('ServiceStartDate', event.target.value)}
            variant="outlined"
            size="small"
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            id={`${formIdPrefix}-service-end-date`}
            name="ServiceEndDate"
            fullWidth
            label="サービス終了日"
            type="date"
            value={values.ServiceEndDate}
            onChange={(event) => setField('ServiceEndDate', event.target.value)}
            error={Boolean(errors.dates)}
            helperText={errors.dates}
            variant="outlined"
            size="small"
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            id={`${formIdPrefix}-usage-status`}
            name="UsageStatus"
            fullWidth
            label="利用ステータス"
            select
            size="small"
            value={values.UsageStatus}
            onChange={(event) => setField('UsageStatus', event.target.value)}
            helperText="請求対象者の抽出や稼働率集計に使用します"
            SelectProps={{ native: true }}
          >
            {USAGE_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </TextField>
        </Box>

        {/* 支給決定情報 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
            支給決定情報（受給者証）
          </Typography>

          <TextField
            id={`${formIdPrefix}-grant-municipality`}
            name="GrantMunicipality"
            fullWidth
            label="支給決定市町村"
            value={values.GrantMunicipality}
            onChange={(event) => setField('GrantMunicipality', event.target.value)}
            placeholder="例：横浜市磯子区"
            variant="outlined"
            size="small"
          />

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              id={`${formIdPrefix}-grant-period-start`}
              name="GrantPeriodStart"
              fullWidth
              label="支給決定期間（開始）"
              type="date"
              value={values.GrantPeriodStart}
              onChange={(event) => setField('GrantPeriodStart', event.target.value)}
              variant="outlined"
              size="small"
              InputLabelProps={{ shrink: true }}
              error={Boolean(errors.grantPeriod)}
            />
            <TextField
              id={`${formIdPrefix}-grant-period-end`}
              name="GrantPeriodEnd"
              fullWidth
              label="支給決定期間（終了）"
              type="date"
              value={values.GrantPeriodEnd}
              onChange={(event) => setField('GrantPeriodEnd', event.target.value)}
              variant="outlined"
              size="small"
              InputLabelProps={{ shrink: true }}
              error={Boolean(errors.grantPeriod)}
              helperText={errors.grantPeriod}
            />
          </Box>

          <TextField
            id={`${formIdPrefix}-disability-support-level`}
            name="DisabilitySupportLevel"
            fullWidth
            label="障害支援区分"
            select
            size="small"
            value={values.DisabilitySupportLevel}
            onChange={(event) => setField('DisabilitySupportLevel', event.target.value)}
            helperText="生活介護の基本報酬単価の算定に使用します"
            SelectProps={{ native: true }}
          >
            {DISABILITY_SUPPORT_LEVEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </TextField>

          <TextField
            id={`${formIdPrefix}-granted-days-per-month`}
            name="GrantedDaysPerMonth"
            fullWidth
            label="契約支給量（日数／月）"
            value={values.GrantedDaysPerMonth}
            onChange={(event) => setField('GrantedDaysPerMonth', event.target.value)}
            placeholder="例：20"
            variant="outlined"
            size="small"
            helperText="1ヶ月あたりに利用が認められた日数（例：20日／月）"
          />
        </Box>
      </Box>
    </Box>
  );
}
