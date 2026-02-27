/**
 * ISP共通: 5領域定義
 * 2024年度報酬改定で求められる5領域カバレッジの定義
 */

export interface DomainDef {
  id: string;
  label: string;
  color: string;
  bg: string;
}

export const DOMAINS: DomainDef[] = [
  { id: 'health',    label: '健康・生活',                color: '#ef4444', bg: '#fef2f2' },
  { id: 'motor',     label: '運動・感覚',                color: '#f59e0b', bg: '#fffbeb' },
  { id: 'cognitive', label: '認知・行動',                color: '#3b82f6', bg: '#eff6ff' },
  { id: 'language',  label: '言語・コミュニケーション',  color: '#8b5cf6', bg: '#f5f3ff' },
  { id: 'social',    label: '人間関係・社会性',          color: '#10b981', bg: '#ecfdf5' },
];
