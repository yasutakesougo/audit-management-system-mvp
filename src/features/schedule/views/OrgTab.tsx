import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  ORG_FILTER_OPTIONS,
  type OrgFilterKey,
  getOrgFilterLabel,
  normalizeOrgFilter,
} from '../orgFilters';

const OrgTab: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialOrg = useMemo<OrgFilterKey>(() => normalizeOrgFilter(searchParams.get('org')), [searchParams]);
  const [selectedOrg, setSelectedOrg] = useState<OrgFilterKey>(initialOrg);

  useEffect(() => {
    setSelectedOrg(initialOrg);
  }, [initialOrg]);
  const currentLabel = getOrgFilterLabel(selectedOrg);

  const handleOrgChange: React.ChangeEventHandler<HTMLSelectElement> = (event) => {
    const next = normalizeOrgFilter(event.target.value);
    setSelectedOrg(next);
    const nextParams = new URLSearchParams(searchParams);
    if (next === 'all') {
      nextParams.delete('org');
    } else {
      nextParams.set('org', next);
    }
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <section
      role="tabpanel"
      aria-label="事業所別スケジュール"
      data-testid="schedule-org-tab"
      data-schedule-tab="org"
      className="min-h-[200px] rounded border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-700"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Org View / 事業所別ビュー</p>
          <h2 className="text-base font-semibold text-slate-900">事業所別スケジュール（準備中）</h2>
        </div>

        <div className="inline-flex flex-col items-end gap-1 text-xs text-slate-500">
          <span className="rounded-full bg-slate-100 px-2 py-0.5">v0.1 プレースホルダー</span>
          <span>※ UIの土台のみ / データ連携は今後実装</span>
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="schedule-org-select" className="mb-1 block text-xs font-medium text-slate-700">
          表示する事業所
        </label>
        <select
          id="schedule-org-select"
          data-testid="schedule-org-select"
          className="w-full max-w-xs rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
          value={selectedOrg}
          onChange={handleOrgChange}
        >
          {ORG_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div
        className="space-y-2 rounded border border-slate-200 bg-slate-50/70 p-3 text-xs leading-relaxed text-slate-700"
        data-testid="schedule-org-summary"
      >
        <p>
          現在は「{currentLabel}」の予定をまとめて表示するビューを準備中です。
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>事業所ごとのスタッフ配置状況・利用枠をひと目で確認</li>
          <li>送迎・生活介護・短期入所など、サービス種別ごとの混雑を可視化</li>
          <li>将来的には「空き状況の共有」や「事業所間の調整ログ」とも連携予定</li>
        </ul>
        <p className="mt-1 text-[11px] text-slate-500">
          ※ このタブは画面設計・E2Eテスト用の土台です。SharePoint との実データ連携は、後続の実装フェーズで追加していきます。
        </p>
      </div>
    </section>
  );
};

export default OrgTab;
