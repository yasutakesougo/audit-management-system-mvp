// ---------------------------------------------------------------------------
// AuditEvidenceReportPDF — 実地指導用エビデンスレポート PDF テンプレート
// @react-pdf/renderer を使用した A4 帳票
// ---------------------------------------------------------------------------
import { pdfStyles } from '@/lib/reports/fontRegistry';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import React from 'react';

import type { AuditEvidenceReportData } from '../ibdReportTypes';
import { PDCA_RECOMMENDATION_LABELS } from '../ibdTypes';

// ---------------------------------------------------------------------------
// スタイル
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    padding: 30,
    ...pdfStyles.container,
    fontSize: 9,
  },
  // ヘッダー
  header: {
    marginBottom: 15,
    borderBottom: '2px solid #333',
    paddingBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    textAlign: 'center',
    color: '#666',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    fontSize: 8,
  },
  // セクション
  section: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 6,
    backgroundColor: '#f0f4f8',
    padding: 4,
    paddingLeft: 8,
    borderLeft: '3px solid #5B8C5A',
  },
  // テーブル
  table: {
    display: 'flex',
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableColHeader: {
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    backgroundColor: '#e8ecf0',
    padding: 4,
    fontSize: 7,
    textAlign: 'center',
    fontWeight: 700,
  },
  tableCol: {
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 4,
    fontSize: 7,
    textAlign: 'center',
  },
  // サマリカード
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  summaryCard: {
    width: '30%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
    textAlign: 'center',
  },
  summaryLabel: {
    fontSize: 7,
    color: '#666',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 700,
  },
  summaryUnit: {
    fontSize: 7,
    color: '#999',
  },
  // フッター
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#999',
    borderTop: '1px solid #ddd',
    paddingTop: 4,
  },
  // 判定バッジ
  badgeOk: {
    color: '#2e7d32',
    fontWeight: 700,
  },
  badgeNg: {
    color: '#c62828',
    fontWeight: 700,
  },
});

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateTime(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${formatDate(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// PDF Component
// ---------------------------------------------------------------------------

export interface AuditEvidenceReportPDFProps {
  data: AuditEvidenceReportData;
}

export const AuditEvidenceReportPDF: React.FC<AuditEvidenceReportPDFProps> = ({ data }) => {
  const { spsHistory, supervisionLogs, complianceSummary } = data;

  return (
    <Document>
      {/* ===== ページ1: SPS確定履歴 + 遵守サマリ ===== */}
      <Page size="A4" style={styles.page}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <Text style={styles.title}>
            強度行動障害支援 監査エビデンスレポート
          </Text>
          <Text style={styles.subtitle}>
            実地指導用 — 算定要件遵守状況報告書
          </Text>

          <View style={styles.metaRow}>
            <View>
              <Text>利用者氏名: {data.userName}</Text>
              <Text>利用者ID: {data.userId}</Text>
            </View>
            <View>
              <Text>対象期間: {formatDate(data.reportPeriod.from)} ～ {formatDate(data.reportPeriod.to)}</Text>
              <Text>出力日時: {formatDateTime(data.generatedAt)}</Text>
              <Text>作成責任者: {data.generatedBy}</Text>
            </View>
          </View>
        </View>

        {/* 遵守状況サマリ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            遵守状況サマリ
          </Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>SPS見直し充足率</Text>
              <Text style={[
                styles.summaryValue,
                complianceSummary.spsComplianceRate >= 100 ? styles.badgeOk : styles.badgeNg,
              ]}>
                {complianceSummary.spsComplianceRate}%
              </Text>
              <Text style={styles.summaryUnit}>
                {complianceSummary.spsReviewOnTimeCount}/{complianceSummary.spsReviewCycleCount} 回期限内
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>観察実施比率</Text>
              <Text style={[
                styles.summaryValue,
                complianceSummary.meetsObservationRequirement ? styles.badgeOk : styles.badgeNg,
              ]}>
                {complianceSummary.observationRatio}%
              </Text>
              <Text style={styles.summaryUnit}>
                {complianceSummary.totalObservationCount}回/{complianceSummary.totalSupportCount}回支援
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>手順書平均遵守度</Text>
              <Text style={styles.summaryValue}>
                {complianceSummary.averageAdherence ?? '-'}/5
              </Text>
              <Text style={styles.summaryUnit}>
                好条件発見: {complianceSummary.totalDiscoveredConditions}件
              </Text>
            </View>
          </View>
        </View>

        {/* SPS確定履歴 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            支援計画シート（SPS）確定履歴
          </Text>

          <View style={styles.table}>
            {/* Header Row */}
            <View style={styles.tableRow}>
              <View style={[styles.tableColHeader, { width: '15%' }]}><Text>SPS ID</Text></View>
              <View style={[styles.tableColHeader, { width: '10%' }]}><Text>Ver.</Text></View>
              <View style={[styles.tableColHeader, { width: '15%' }]}><Text>作成日</Text></View>
              <View style={[styles.tableColHeader, { width: '15%' }]}><Text>確定日</Text></View>
              <View style={[styles.tableColHeader, { width: '15%' }]}><Text>確定者</Text></View>
              <View style={[styles.tableColHeader, { width: '15%' }]}><Text>次回期限</Text></View>
              <View style={[styles.tableColHeader, { width: '15%' }]}><Text>判定</Text></View>
            </View>

            {/* Data Rows */}
            {spsHistory.length > 0 ? (
              spsHistory.map((row) => (
                <View key={row.spsId} style={styles.tableRow}>
                  <View style={[styles.tableCol, { width: '15%' }]}><Text>{row.spsId}</Text></View>
                  <View style={[styles.tableCol, { width: '10%' }]}><Text>{row.version}</Text></View>
                  <View style={[styles.tableCol, { width: '15%' }]}><Text>{formatDate(row.createdAt)}</Text></View>
                  <View style={[styles.tableCol, { width: '15%' }]}><Text>{row.confirmedAt ? formatDate(row.confirmedAt) : '未確定'}</Text></View>
                  <View style={[styles.tableCol, { width: '15%' }]}><Text>{row.confirmedBy ?? '-'}</Text></View>
                  <View style={[styles.tableCol, { width: '15%' }]}><Text>{formatDate(row.nextReviewDueDate)}</Text></View>
                  <View style={[styles.tableCol, { width: '15%' }]}>
                    <Text style={row.isWithinCycle ? styles.badgeOk : styles.badgeNg}>
                      {row.isWithinCycle ? '○ 期限内' : '× 超過'}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.tableRow}>
                <View style={[styles.tableCol, { width: '100%' }]}>
                  <Text>SPS確定履歴なし</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* PDCA内訳 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PDCA推奨アクション内訳</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
            {(Object.entries(complianceSummary.pdcaBreakdown) as [string, number][]).map(
              ([key, count]) => (
                <View key={key} style={{ flexDirection: 'row', gap: 4 }}>
                  <Text style={{ fontWeight: 700 }}>
                    {PDCA_RECOMMENDATION_LABELS[key as keyof typeof PDCA_RECOMMENDATION_LABELS]}:
                  </Text>
                  <Text>{count}件</Text>
                </View>
              )
            )}
          </View>
        </View>

        {/* フッター */}
        <View style={styles.footer} fixed>
          <Text>強度行動障害支援加算 — 実地指導用エビデンスレポート</Text>
          <Text>出力: {formatDateTime(data.generatedAt)} / {data.generatedBy}</Text>
        </View>
      </Page>

      {/* ===== ページ2: 観察・確認ログ ===== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>
            指導・観察確認ログ
          </Text>
          <Text style={styles.subtitle}>
            {data.userName} — {formatDate(data.reportPeriod.from)} ～ {formatDate(data.reportPeriod.to)}
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.table}>
            {/* Header Row */}
            <View style={styles.tableRow}>
              <View style={[styles.tableColHeader, { width: '12%' }]}><Text>観察日</Text></View>
              <View style={[styles.tableColHeader, { width: '12%' }]}><Text>観察者</Text></View>
              <View style={[styles.tableColHeader, { width: '8%' }]}><Text>遵守度</Text></View>
              <View style={[styles.tableColHeader, { width: '18%' }]}><Text>PDCA推奨</Text></View>
              <View style={[styles.tableColHeader, { width: '8%' }]}><Text>好条件</Text></View>
              <View style={[styles.tableColHeader, { width: '8%' }]}><Text>更新提案</Text></View>
              <View style={[styles.tableColHeader, { width: '34%' }]}><Text>メモ</Text></View>
            </View>

            {/* Data Rows */}
            {supervisionLogs.length > 0 ? (
              supervisionLogs.map((log) => (
                <View key={log.logId} style={styles.tableRow}>
                  <View style={[styles.tableCol, { width: '12%' }]}>
                    <Text>{formatDate(log.observedAt)}</Text>
                  </View>
                  <View style={[styles.tableCol, { width: '12%' }]}>
                    <Text>{log.supervisorName}</Text>
                  </View>
                  <View style={[styles.tableCol, { width: '8%' }]}>
                    <Text>{log.adherenceToManual ?? '-'}/5</Text>
                  </View>
                  <View style={[styles.tableCol, { width: '18%' }]}>
                    <Text>
                      {log.pdcaRecommendation
                        ? PDCA_RECOMMENDATION_LABELS[log.pdcaRecommendation]
                        : '-'}
                    </Text>
                  </View>
                  <View style={[styles.tableCol, { width: '8%' }]}>
                    <Text>{log.discoveredConditionsCount}件</Text>
                  </View>
                  <View style={[styles.tableCol, { width: '8%' }]}>
                    <Text>{log.suggestedUpdatesCount}件</Text>
                  </View>
                  <View style={[styles.tableCol, { width: '34%', textAlign: 'left' }]}>
                    <Text>{log.notesSummary}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.tableRow}>
                <View style={[styles.tableCol, { width: '100%' }]}>
                  <Text>観察ログなし</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* フッター */}
        <View style={styles.footer} fixed>
          <Text>強度行動障害支援加算 — 指導・観察確認ログ</Text>
          <Text>出力: {formatDateTime(data.generatedAt)} / {data.generatedBy}</Text>
        </View>
      </Page>
    </Document>
  );
};

export default AuditEvidenceReportPDF;
