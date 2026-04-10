/**
 * ComplianceTab — コンプライアンスタブ
 *
 * A-2: ISP 同意・交付 UI
 * F-1: ISP サビ管承認 UI
 *
 * SectionKey: 'compliance'
 * EditableComplianceSection + ApprovalSection のラッパ。
 * useComplianceForm フックからデータ・ハンドラを受け取る。
 */
import React from 'react';
import Stack from '@mui/material/Stack';

import type { UseComplianceFormReturn } from '../../hooks/useComplianceForm';
import ApprovalSection from './ApprovalSection';
import ConsultationSupportSection from './ConsultationSupportSection';
import EditableComplianceSection from './EditableComplianceSection';
import MeetingDetailSection from './MeetingDetailSection';

export type ComplianceTabProps = {
  isAdmin: boolean;
  complianceForm: UseComplianceFormReturn;
  /** 承認者の UPN (email) — useAuth().account.username から取得 */
  approverUpn?: string;
};

const ComplianceTab: React.FC<ComplianceTabProps> = ({ isAdmin, complianceForm, approverUpn }) => {
  const {
    compliance,
    updateConsent,
    updateDelivery,
    updateMeeting,
    updateConsultation,
    updateServiceHours,
    missingFields,
    approvalState,
    performApproval,
  } = complianceForm;

  const handleApprove = React.useCallback(() => {
    if (approverUpn) {
      performApproval(approverUpn);
    }
  }, [approverUpn, performApproval]);

  return (
    <Stack spacing={3}>
      <EditableComplianceSection
        consent={compliance.consent}
        delivery={compliance.delivery}
        standardServiceHours={compliance.standardServiceHours}
        isAdmin={isAdmin}
        missingFields={missingFields}
        onConsentChange={updateConsent}
        onDeliveryChange={updateDelivery}
        onServiceHoursChange={updateServiceHours}
      />

      {/* A-2: サービス担当者会議記録 */}
      <MeetingDetailSection
        meeting={compliance.meeting}
        isAdmin={isAdmin}
        onChange={updateMeeting}
      />

      {/* A-2: 相談支援専門員との連携 */}
      <ConsultationSupportSection
        consultation={compliance.consultationSupport}
        isAdmin={isAdmin}
        onChange={updateConsultation}
      />

      {/* F-1: サビ管承認セクション */}
      <ApprovalSection
        approvalState={approvalState}
        isAdmin={isAdmin}
        onApprove={handleApprove}
        hasMissingFields={missingFields.length > 0}
      />
    </Stack>
  );
};

export default React.memo(ComplianceTab);
