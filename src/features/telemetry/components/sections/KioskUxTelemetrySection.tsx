import { Box, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import type { KioskUxKpis } from '@/features/today/telemetry/computeKioskUxKpis';
import type { KioskQuickLinkId } from '@/features/today/model/getKioskQuickLinks';

const TARGET_LABELS: Record<KioskQuickLinkId, string> = {
  schedule: 'スケジュール',
  handoff: '申し送り',
  minutes: '議事録記録',
  room: 'お部屋管理',
  briefing: '朝夕会進行',
};

export function KioskUxTelemetrySection({ kpis }: { kpis: KioskUxKpis | null }) {
  if (!kpis) return null;

  // FAB利用率の算出
  const fabRateRaw = kpis.totalNavigateCount > 0 
    ? (kpis.openFabMenuCount / kpis.totalNavigateCount) * 100 
    : 0;
  const fabRate = Math.round(fabRateRaw * 10) / 10;
  const quickRecordAbandonRateRaw = kpis.quickRecordStartCount > 0
    ? (kpis.quickRecordAbandonCount / kpis.quickRecordStartCount) * 100
    : 0;
  const quickRecordAbandonRate = Math.round(quickRecordAbandonRateRaw * 10) / 10;
  
  // 閾値（15%）
  const isFabAlert = fabRate > 15 && kpis.totalNavigateCount >= 5;

  // 最頻利用ターゲットの自動抽出（解決策のシステム提案用）
  const topTargetEntry = Object.entries(kpis.navigateFromTodayBreakdown)
    .sort((a, b) => b[1] - a[1])[0];
  const topTarget = topTargetEntry ? topTargetEntry[0] : '特定の機能';
  const topTargetLabel =
    topTarget in TARGET_LABELS
      ? TARGET_LABELS[topTarget as KioskQuickLinkId]
      : topTarget;

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: '#1e293b' }}>
        📱 キオスクUX 導線観測 (1-Tap Dashboard)
      </Typography>
      <Typography variant="body2" sx={{ mb: 2, color: '#64748b' }}>
        現場から主要機能へ「1タップで迷わず遷移し、確実に帰還できているか」をモニタリングします。
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        {/* 1. Navigate from Today */}
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, borderColor: '#e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5, color: '#2563eb', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            🚀 1タップ遷移 (Today → 各機能)
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: '#64748b', fontWeight: 500 }}>到達先 (Target)</TableCell>
                <TableCell align="right" sx={{ color: '#64748b', fontWeight: 500 }}>回数</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.keys(kpis.navigateFromTodayBreakdown).length === 0 ? (
                <TableRow><TableCell colSpan={2} sx={{ color: '#94a3b8', borderBottom: 'none', py: 2 }}>データなし</TableCell></TableRow>
              ) : (
                Object.entries(kpis.navigateFromTodayBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([target, count]) => (
                  <TableRow key={target} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                    <TableCell sx={{ fontWeight: 500 }}>
                      {target in TARGET_LABELS
                        ? `${TARGET_LABELS[target as KioskQuickLinkId]} (${target})`
                        : target}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#1e293b' }}>{count}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Paper>

        {/* 2 & 3. Return & FAB */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, borderColor: '#e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5, color: '#7c3aed', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              📈 キオスク運用KPI
            </Typography>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell sx={{ color: '#64748b', fontWeight: 500 }}>キオスクセッション数</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: '#1e293b' }}>{kpis.kioskSessionCount}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ color: '#64748b', fontWeight: 500 }}>復帰後更新回数</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: '#1e293b' }}>{kpis.visibleRefreshCount}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ color: '#64748b', fontWeight: 500 }}>復帰後更新中央値</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: '#1e293b' }}>
                    {kpis.visibleRefreshMedianMs == null ? '—' : `${kpis.visibleRefreshMedianMs}ms`}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ color: '#64748b', fontWeight: 500 }}>QuickRecord 開始回数</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: '#1e293b' }}>{kpis.quickRecordStartCount}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ color: '#64748b', fontWeight: 500 }}>QuickRecord 保存回数</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: '#1e293b' }}>{kpis.quickRecordSaveCount}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ color: '#64748b', fontWeight: 500 }}>QuickRecord 保存中央値</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: '#1e293b' }}>
                    {kpis.quickRecordSaveMedianMs == null ? '—' : `${Math.round(kpis.quickRecordSaveMedianMs / 1000)}s`}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ color: '#64748b', fontWeight: 500 }}>QuickRecord 離脱回数</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: '#1e293b' }}>{kpis.quickRecordAbandonCount}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ color: '#64748b', fontWeight: 500 }}>QuickRecord 離脱率</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: '#1e293b' }}>
                    {kpis.quickRecordStartCount === 0 ? '—' : `${quickRecordAbandonRate}%`}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, borderColor: '#e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5, color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              ↩️ 帰還導線の利用 (各機能 → Today)
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: '#64748b', fontWeight: 500 }}>帰還元 (Source)</TableCell>
                  <TableCell align="right" sx={{ color: '#64748b', fontWeight: 500 }}>回数</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.keys(kpis.returnToTodayBreakdown).length === 0 ? (
                  <TableRow><TableCell colSpan={2} sx={{ color: '#94a3b8', borderBottom: 'none', py: 2 }}>データなし</TableCell></TableRow>
                ) : (
                  Object.entries(kpis.returnToTodayBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([source, count]) => (
                    <TableRow key={source} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                      <TableCell sx={{ fontWeight: 500 }}>{source}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#1e293b' }}>{count}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Paper>

          <Paper variant="outlined" sx={{ 
            p: 2, borderRadius: 3, borderColor: '#e2e8f0', 
            borderLeft: '4px solid', 
            borderLeftColor: isFabAlert ? '#ef4444' : (kpis.openFabMenuCount > 0 ? '#3b82f6' : '#10b981'),
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2" sx={{ color: '#475569', fontWeight: 600 }}>
                🆘 FAB（フォールバック）利用率
              </Typography>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="h4" sx={{ fontWeight: 800, color: isFabAlert ? '#dc2626' : '#1e293b' }}>
                  {fabRate} <Typography component="span" variant="body2" sx={{ color: '#94a3b8', fontWeight: 600 }}>%</Typography>
                </Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                  ({kpis.openFabMenuCount} / {kpis.totalNavigateCount} 回)
                </Typography>
              </Box>
            </Box>
            
            {isFabAlert ? (
              <Box sx={{ mt: 1.5, p: 1, bgcolor: '#fef2f2', borderRadius: 1.5 }}>
                <Typography variant="caption" sx={{ color: '#991b1b', fontWeight: 600, display: 'block' }}>
                  ⚠️ アラート: 閾値(15%)を超過しています！
                </Typography>
                <Typography variant="caption" sx={{ color: '#991b1b', mt: 0.5, display: 'block' }}>
                  最短導線が見つからず迷っている職員が多発しています。
                  <br />
                  💡 <strong>システムからの提案:</strong> 現在最も利用されている <strong>「{topTargetLabel}」</strong> のボタンをより大きくするか、クイックリンクの先頭へ配置変更することを検討してください。
                </Typography>
              </Box>
            ) : (
              <Typography variant="caption" sx={{ mt: 1, display: 'block', color: '#94a3b8' }}>
                ※ この割合が「15%」を超えた場合は、必要なクイックリンクが欠けているためUXの見直しが必要です。
              </Typography>
            )}
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
