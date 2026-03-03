import { PageHeader, type PageHeaderProps } from '@/components/PageHeader';
import React from 'react';

// ---------------------------------------------------------------------------
// IBDPageHeader — 強度行動障害支援グループ共通ヘッダー
//
// 全アプリ共通 PageHeader の thin-wrapper。
// IBD 固有の拡張が必要になった場合にここで吸収する。
// ---------------------------------------------------------------------------

export type IBDPageHeaderProps = PageHeaderProps;

export const IBDPageHeader: React.FC<IBDPageHeaderProps> = (props) => (
  <PageHeader {...props} />
);

export default IBDPageHeader;
