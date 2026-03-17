/**
 * MonitoringFieldSection — モニタリングフィールド入力セクション
 *
 * FieldCard を使い monitoringPlan / reviewTiming / lastMonitoringDate の
 * 3 フィールドを描画する presentational コンポーネント。
 */
import Stack from '@mui/material/Stack';
import React from 'react';

import type { SectionConfig } from '../../types';
import FieldCard from './FieldCard';
import type { SectionTabProps } from './tabProps';

export type MonitoringFieldSectionProps = {
  section: SectionConfig;
} & Pick<SectionTabProps, 'form' | 'isAdmin' | 'onFieldChange' | 'onAppendPhrase' | 'guardAdmin'>;

const MonitoringFieldSection: React.FC<MonitoringFieldSectionProps> = ({
  section,
  ...fieldProps
}) => (
  <Stack spacing={2}>
    {section.fields.map((field) => (
      <FieldCard key={field.key} field={field} {...fieldProps} />
    ))}
  </Stack>
);

export default React.memo(MonitoringFieldSection);
