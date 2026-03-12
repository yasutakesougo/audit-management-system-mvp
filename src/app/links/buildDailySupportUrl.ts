/**
 * buildDailySupportUrl — /daily/support への遷移 URL を構築する
 *
 * 支援計画シートから Daily Support ページへの導線で使用。
 * planningSheetId を渡すことで、resolveProcedureSteps が
 * planning_sheet 由来の手順を優先読み込みする。
 */
export function buildDailySupportUrl(
  userId: string,
  planningSheetId?: string,
): string {
  const params = new URLSearchParams({ userId });

  if (planningSheetId) {
    params.set('planningSheetId', planningSheetId);
  }

  return `/daily/support?${params.toString()}`;
}
