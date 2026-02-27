import { pdfStyles } from '@/lib/reports/fontRegistry';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import React from 'react';

// Create styles
const styles = StyleSheet.create({
  page: {
    padding: 30,
    ...pdfStyles.container,
  },
  header: {
    marginBottom: 20,
    textAlign: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 5,
  },
  subTitle: {
    fontSize: 12,
    marginBottom: 20,
  },
  metaInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    fontSize: 10,
  },
  table: {
    display: 'flex',
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  tableRow: {
    margin: 'auto',
    flexDirection: 'row',
  },
  tableColHeader: {
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    backgroundColor: '#f0f0f0',
    padding: 5,
    fontSize: 8,
    textAlign: 'center',
    fontWeight: 700,
  },
  tableCol: {
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 5,
    fontSize: 8,
    textAlign: 'center',
  },
  footer: {
    marginTop: 20,
    fontSize: 10,
  },
});

export interface AchievementRecordRow {
  date: string;
  dayOfWeek: string;
  status: string; // "通所", "欠席", etc.
  serviceType: string; // "通常", "重度"
  startTime?: string | null;
  endTime?: string | null;
  duration?: number | null;
  notes?: string;
}

export interface AchievementRecordProps {
  month: string; // YYYY-MM
  userName: string;
  userCertNumber: string;
  rows: AchievementRecordRow[];
}

/**
 * Service Provision Achievement Record (実績記録票) PDF Template
 */
export const AchievementRecordPDF: React.FC<AchievementRecordProps> = ({
  month,
  userName,
  userCertNumber,
  rows,
}) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>就労継続支援Ｂ型サービス提供実績記録票</Text>
        <Text style={styles.subTitle}>{month}分</Text>
      </View>

      <View style={styles.metaInfo}>
        <View>
          <Text>受給者証番号: {userCertNumber}</Text>
          <Text>利用者氏名: {userName} 様</Text>
        </View>
        <View>
          <Text>事業所名: 磯子区障害者地域活動ホーム</Text>
          <Text>事業所番号: 141XXXXXXX</Text>
        </View>
      </View>

      <View style={styles.table}>
        {/* Header */}
        <View style={styles.tableRow}>
          <View style={[styles.tableColHeader, { width: '10%' }]}><Text>日付</Text></View>
          <View style={[styles.tableColHeader, { width: '10%' }]}><Text>曜日</Text></View>
          <View style={[styles.tableColHeader, { width: '15%' }]}><Text>サービス内容</Text></View>
          <View style={[styles.tableColHeader, { width: '15%' }]}><Text>開始時間</Text></View>
          <View style={[styles.tableColHeader, { width: '15%' }]}><Text>終了時間</Text></View>
          <View style={[styles.tableColHeader, { width: '35%' }]}><Text>備考</Text></View>
        </View>

        {/* Data Rows */}
        {rows.map((row, idx) => (
          <View key={idx} style={styles.tableRow}>
            <View style={[styles.tableCol, { width: '10%' }]}><Text>{row.date}</Text></View>
            <View style={[styles.tableCol, { width: '10%' }]}><Text>{row.dayOfWeek}</Text></View>
            <View style={[styles.tableCol, { width: '15%' }]}><Text>{row.status}</Text></View>
            <View style={[styles.tableCol, { width: '15%' }]}><Text>{row.startTime || '-'}</Text></View>
            <View style={[styles.tableCol, { width: '15%' }]}><Text>{row.endTime || '-'}</Text></View>
            <View style={[styles.tableCol, { width: '35%' }]}><Text>{row.notes || ''}</Text></View>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Text>計: {rows.filter(r => r.status === '通所').length} 日</Text>
      </View>
    </Page>
  </Document>
);
