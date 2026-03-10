/**
 * OverviewTab — 基本情報タブ
 *
 * SectionKey: 'overview'
 * プレゼンテーショナルコンポーネント（状態・副作用なし）。
 */
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

import { findSection } from '../../utils/helpers';
import FieldCard from './FieldCard';
import type { SectionTabProps } from './tabProps';
import UserLinkSection from './UserLinkSection';

const OverviewTab: React.FC<SectionTabProps> = (props) => {
  const section = findSection('overview');
  if (!section) return null;

  return (
    <Stack spacing={2}>
      {/* ── Step 1: 利用者マスタ紐付け ── */}
      {props.userOptions && props.onSelectUser && (
        <UserLinkSection
          linkedUserId={props.linkedUserId}
          linkedUserCode={props.linkedUserCode}
          linkedUserName={props.form.serviceUserName}
          userOptions={props.userOptions}
          isAdmin={props.isAdmin}
          onSelectUser={props.onSelectUser}
        />
      )}

      {/* ── Step 2: フィールド入力 ── */}
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

export default React.memo(OverviewTab);
