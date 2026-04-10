/**
 * EditableComplianceSection — ISP 同意・交付コンプライアンス UI
 *
 * A-2: ISP 同意・交付 UI
 *
 * 生活介護 ISP の監査コンプライアンスに必要な以下の情報を入力・表示する:
 *   - 説明実施日 / 実施者
 *   - 同意取得日 / 同意者 / 代理人
 *   - 交付日 / 交付先 / 交付方法
 *   - 標準的な支援提供時間
 *   - 未入力項目の警告
 *
 * プレゼンテーショナルコンポーネント — 状態は useComplianceForm から受け取る。
 */
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { IspConsentDetail, IspDeliveryDetail } from '@/domain/isp/schema';

// ────────────────────────────────────────────
// Props
// ────────────────────────────────────────────

export type EditableComplianceSectionProps = {
  /** 同意詳細 */
  consent: IspConsentDetail;
  /** 交付詳細 */
  delivery: IspDeliveryDetail;
  /** 標準的な支援提供時間（時間単位） */
  standardServiceHours: number | null;
  /** 管理者権限フラグ */
  isAdmin: boolean;
  /** 未入力フィールド一覧 */
  missingFields: string[];

  /** 同意詳細の更新 */
  onConsentChange: (updates: Partial<IspConsentDetail>) => void;
  /** 交付詳細の更新 */
  onDeliveryChange: (updates: Partial<IspDeliveryDetail>) => void;
  /** 標準的提供時間の更新 */
  onServiceHoursChange: (hours: number | null) => void;
};

// ────────────────────────────────────────────
// Subcomponents
// ────────────────────────────────────────────

/** 日付入力 (type="date") ラッパー */
const DateField: React.FC<{
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled: boolean;
  'data-testid'?: string;
}> = ({ label, value, onChange, disabled, ...rest }) => (
  <TextField
    type="date"
    size="small"
    label={label}
    value={value ?? ''}
    onChange={(e) => onChange(e.target.value || null)}
    disabled={disabled}
    slotProps={{ inputLabel: { shrink: true } }}
    sx={{ minWidth: 180 }}
    {...rest}
  />
);

// ────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────

const EditableComplianceSection: React.FC<EditableComplianceSectionProps> = ({
  consent,
  delivery,
  standardServiceHours,
  isAdmin,
  missingFields,
  onConsentChange,
  onDeliveryChange,
  onServiceHoursChange,
}) => {
  const readOnly = !isAdmin;

  return (
    <Stack spacing={3}>
      {/* ── Header ── */}
      <Stack direction="row" spacing={1} alignItems="center">
        <AssignmentTurnedInIcon color="primary" />
        <Typography variant="h6" component="h2">
          コンプライアンス（同意・交付・提供時間）
        </Typography>
      </Stack>

      <Typography variant="body2" color="text.secondary">
        生活介護 ISP の監査要件に基づき、説明・同意・交付の記録を管理します。
        未入力項目がある場合は警告が表示されます。
      </Typography>

      {/* ── 未入力警告 ── */}
      {missingFields.length > 0 && (
        <Alert
          severity="warning"
          icon={<WarningAmberRoundedIcon />}
          data-testid="compliance-missing-alert"
        >
          <Typography variant="subtitle2" gutterBottom>
            未入力項目: {missingFields.length}件
          </Typography>
          <Typography variant="body2">
            {missingFields.join('、')}
          </Typography>
        </Alert>
      )}

      {/* ════════════════════════════════════════ */}
      {/*  Section 1: 同意記録                     */}
      {/* ════════════════════════════════════════ */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Typography variant="subtitle1" fontWeight="bold" color="primary">
            📋 説明・同意記録
          </Typography>

          {/* Row 1: 説明 */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <DateField
              label="説明実施日"
              value={consent.explainedAt}
              onChange={(v) => onConsentChange({ explainedAt: v })}
              disabled={readOnly}
              data-testid="compliance-explained-at"
            />
            <TextField
              size="small"
              label="説明実施者"
              value={consent.explainedBy}
              onChange={(e) => onConsentChange({ explainedBy: e.target.value })}
              disabled={readOnly}
              placeholder="例: 山田 花子（サービス管理責任者）"
              sx={{ flex: 1 }}
              data-testid="compliance-explained-by"
            />
          </Stack>

          <Divider />

          {/* Row 2: 同意 */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <DateField
              label="同意取得日"
              value={consent.consentedAt}
              onChange={(v) => onConsentChange({ consentedAt: v })}
              disabled={readOnly}
              data-testid="compliance-consented-at"
            />
            <TextField
              size="small"
              label="同意者名"
              value={consent.consentedBy}
              onChange={(e) => onConsentChange({ consentedBy: e.target.value })}
              disabled={readOnly}
              placeholder="例: 鈴木 太郎（本人）"
              sx={{ flex: 1 }}
              data-testid="compliance-consented-by"
            />
          </Stack>

          {/* Row 3: 代理人 */}
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                size="small"
                label="代理人名（家族等）"
                value={consent.proxyName}
                onChange={(e) => onConsentChange({ proxyName: e.target.value })}
                disabled={readOnly}
                placeholder="例: 鈴木 一郎"
                sx={{ flex: 1 }}
                data-testid="compliance-proxy-name"
              />
              <TextField
                size="small"
                label="代理人続柄"
                value={consent.proxyRelation}
                onChange={(e) => onConsentChange({ proxyRelation: e.target.value })}
                disabled={readOnly}
                placeholder="例: 父"
                sx={{ minWidth: 120 }}
                data-testid="compliance-proxy-relation"
              />
            </Stack>
            {(consent.proxyName || consent.proxyRelation) && (
              <TextField
                size="small"
                label="代理同意の理由（本人同意が困難な理由等）"
                value={consent.proxyReason ?? ''}
                onChange={(e) => onConsentChange({ proxyReason: e.target.value })}
                disabled={readOnly}
                placeholder="例: 本人による署名が困難なため、父が代筆。"
                data-testid="compliance-proxy-reason"
              />
            )}
          </Stack>

          {/* Row 4: 同意方法 */}
          <TextField
             select
             size="small"
             label="同意取得方法"
             value={consent.consentMethod ?? ''}
             onChange={(e) =>
               onConsentChange({
                 consentMethod: (e.target.value || undefined) as IspConsentDetail['consentMethod'],
               })
             }
             disabled={readOnly}
             slotProps={{ select: { native: true } }}
             data-testid="compliance-consent-method"
          >
            <option value="">未選択</option>
            <option value="signature">署名</option>
            <option value="seal">記名押印</option>
            <option value="electronic">電子署名</option>
            <option value="other">その他</option>
          </TextField>

          {/* Row 5: 備考 */}
          <TextField
            size="small"
            label="同意に関する備考"
            value={consent.notes}
            onChange={(e) => onConsentChange({ notes: e.target.value })}
            disabled={readOnly}
            multiline
            minRows={2}
            placeholder="例: 本人が自署。意思決定支援ガイドラインに沿い、写真カードで説明実施。"
            data-testid="compliance-consent-notes"
          />
        </Stack>
      </Paper>

      {/* ════════════════════════════════════════ */}
      {/*  Section 2: 交付記録                     */}
      {/* ════════════════════════════════════════ */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Typography variant="subtitle1" fontWeight="bold" color="primary">
            📄 交付記録
          </Typography>

          {/* Row 1: 交付日 */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <DateField
              label="交付日"
              value={delivery.deliveredAt}
              onChange={(v) => onDeliveryChange({ deliveredAt: v })}
              disabled={readOnly}
              data-testid="compliance-delivered-at"
            />
            <TextField
              size="small"
              label="交付方法"
              value={delivery.deliveryMethod}
              onChange={(e) => onDeliveryChange({ deliveryMethod: e.target.value })}
              disabled={readOnly}
              placeholder="例: 手渡し / 郵送 / 電子交付"
              sx={{ flex: 1 }}
              data-testid="compliance-delivery-method"
            />
          </Stack>

          {/* Row 2: 交付先チェックボックス */}
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <FormControlLabel
              control={
                <Checkbox
                  checked={delivery.deliveredToUser}
                  onChange={(e) => onDeliveryChange({ deliveredToUser: e.target.checked })}
                  disabled={readOnly}
                  data-testid="compliance-delivered-to-user"
                />
              }
              label="本人へ交付済み"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={delivery.deliveredToConsultationSupport}
                  onChange={(e) => onDeliveryChange({ deliveredToConsultationSupport: e.target.checked })}
                  disabled={readOnly}
                  data-testid="compliance-delivered-to-consultation"
                />
              }
              label="相談支援専門員へ交付済み"
            />
          </Stack>

          {/* Row 3: 備考 */}
          <TextField
            size="small"
            label="交付に関する備考"
            value={delivery.notes}
            onChange={(e) => onDeliveryChange({ notes: e.target.value })}
            disabled={readOnly}
            multiline
            minRows={2}
            placeholder="例: 本人・家族に対面で手渡し、受領印取得。相談支援専門員にはFAX送付済み。"
            data-testid="compliance-delivery-notes"
          />
        </Stack>
      </Paper>

      {/* ════════════════════════════════════════ */}
      {/*  Section 3: 標準的な支援提供時間          */}
      {/* ════════════════════════════════════════ */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Typography variant="subtitle1" fontWeight="bold" color="primary">
            ⏱ 標準的な支援提供時間
          </Typography>
          <Typography variant="body2" color="text.secondary">
            生活介護では標準的な支援提供時間の記載が義務付けられています。
            6時間以上の提供が報酬区分の基準となります。
          </Typography>
          <Box sx={{ maxWidth: 300 }}>
            <TextField
              type="number"
              size="small"
              label="標準的な支援提供時間（時間）"
              value={standardServiceHours ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                onServiceHoursChange(val === '' ? null : Number(val));
              }}
              disabled={readOnly}
              slotProps={{
                htmlInput: { min: 0, max: 24, step: 0.5 },
              }}
              placeholder="例: 6.5"
              helperText={
                standardServiceHours != null && standardServiceHours < 6
                  ? '⚠ 6時間未満です。報酬区分にご注意ください。'
                  : standardServiceHours != null && standardServiceHours > 8
                    ? 'ℹ 8時間超の提供時間です。'
                    : '生活介護の一般的な提供時間: 6〜8時間'
              }
              data-testid="compliance-service-hours"
            />
          </Box>
        </Stack>
      </Paper>
    </Stack>
  );
};

export default React.memo(EditableComplianceSection);
