/**
 * ComplianceTab — コンプライアンスタブ
 *
 * A-2: ISP 同意・交付 UI
 *
 * SectionKey: 'compliance'
 * EditableComplianceSection のラッパ。
 * useComplianceForm フックからデータ・ハンドラを受け取る。
 */
import React from 'react';

import type { UseComplianceFormReturn } from '../../hooks/useComplianceForm';
import EditableComplianceSection from './EditableComplianceSection';

export type ComplianceTabProps = {
  isAdmin: boolean;
  complianceForm: UseComplianceFormReturn;
};

const ComplianceTab: React.FC<ComplianceTabProps> = ({ isAdmin, complianceForm }) => {
  const { compliance, updateConsent, updateDelivery, updateServiceHours, missingFields } = complianceForm;

  return (
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
  );
};

export default React.memo(ComplianceTab);
