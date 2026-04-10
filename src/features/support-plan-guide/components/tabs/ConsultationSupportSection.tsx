import React from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import type { IspConsultationSupport } from '@/domain/isp/schema';

export type ConsultationSupportSectionProps = {
  consultation: IspConsultationSupport;
  isAdmin: boolean;
  onChange: (updates: Partial<IspConsultationSupport>) => void;
};

const ConsultationSupportSection: React.FC<ConsultationSupportSectionProps> = ({
  consultation,
  isAdmin,
  onChange,
}) => {
  const readOnly = !isAdmin;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="subtitle1" fontWeight="bold" color="primary">
          🏢 相談支援事業所との連携
        </Typography>
        <Typography variant="body2" color="text.secondary">
          サービス等利用計画との整合性、および指定相談支援事業所との情報共有状況を記録します。
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            size="small"
            label="相談支援事業所名"
            value={consultation.agencyName}
            onChange={(e) => onChange({ agencyName: e.target.value })}
            disabled={readOnly}
            placeholder="例: あおぞら相談支援センター"
            sx={{ flex: 1 }}
            data-testid="compliance-consultation-agency"
          />
          <TextField
            size="small"
            label="相談支援専門員名"
            value={consultation.officerName}
            onChange={(e) => onChange({ officerName: e.target.value })}
            disabled={readOnly}
            placeholder="例: 佐藤 健二"
            sx={{ flex: 1 }}
            data-testid="compliance-consultation-officer"
          />
        </Stack>

        <TextField
          type="date"
          size="small"
          label="サービス等利用計画の受領日"
          value={consultation.serviceUsePlanReceivedAt ?? ''}
          onChange={(e) => onChange({ serviceUsePlanReceivedAt: e.target.value || null })}
          disabled={readOnly}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ maxWidth: 240 }}
          data-testid="compliance-consultation-received-at"
        />

        <TextField
          size="small"
          label="利用計画と ISP の差分・不整合（特記事項）"
          value={consultation.gapNotes}
          onChange={(e) => onChange({ gapNotes: e.target.value })}
          disabled={readOnly}
          multiline
          minRows={2}
          placeholder="例: 利用計画の目標に基づき、当事業所では生活スキルの向上に焦点を当てた計画を作成。"
          data-testid="compliance-consultation-gap-notes"
        />
      </Stack>
    </Paper>
  );
};

export default React.memo(ConsultationSupportSection);
