/**
 * RiskTab — コンプライアンス・減算対策タブ
 *
 * SectionKey: 'risk'
 * プレゼンテーショナルコンポーネント（状態・副作用なし）。
 */
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

import { findSection } from '../../utils/helpers';
import FieldCard from './FieldCard';
import type { SectionTabProps } from './tabProps';

const RiskTab: React.FC<SectionTabProps> = (props) => {
  const section = findSection('risk');
  if (!section) return null;

  return (
    <Stack spacing={2}>
      {section.description ? (
        <Typography variant="subtitle1" component="span" sx={{ color: 'text.secondary' }}>
          {section.description}
        </Typography>
      ) : null}
      <Stack spacing={2}>
        {section.fields.map((field) => (
          <FieldCard key={field.key} field={field} {...props} />
        ))}
      </Stack>
    </Stack>
  );
};

export default React.memo(RiskTab);
