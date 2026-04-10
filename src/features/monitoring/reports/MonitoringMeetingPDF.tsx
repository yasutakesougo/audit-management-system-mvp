import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { pdfStyles } from '@/lib/reports/fontRegistry';
import { 
  MonitoringMeetingRecord, 
  MEETING_TYPE_LABELS, 
  PLAN_CHANGE_LABELS 
} from '@/domain/isp/monitoringMeeting';
import { formatDateYmd, formatDateTimeYmdHm } from '@/lib/dateFormat';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    ...pdfStyles.container,
    fontSize: 10,
    lineHeight: 1.5,
  },
  header: {
    marginBottom: 20,
    borderBottom: '2px solid #333',
    paddingBottom: 10,
    position: 'relative',
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 10,
  },
  finalizedStamp: {
    position: 'absolute',
    top: 0,
    right: 0,
    border: '2px solid #c62828',
    padding: 5,
    borderRadius: 5,
    color: '#c62828',
    transform: 'rotate(15deg)',
    fontSize: 12,
    fontWeight: 700,
  },
  metaTable: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eee',
  },
  metaCell: {
    width: '50%',
    padding: 5,
    borderWidth: 0.5,
    borderColor: '#eee',
    flexDirection: 'row',
  },
  label: {
    width: '30%',
    color: '#666',
    fontSize: 8,
  },
  value: {
    width: '70%',
    fontWeight: 700,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    backgroundColor: '#f5f5f5',
    padding: 5,
    marginBottom: 8,
    borderLeft: '4px solid #1976d2',
  },
  contentBox: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    minHeight: 50,
  },
  attendeeRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    padding: 5,
    alignItems: 'center',
  },
  attendeeHeader: {
    backgroundColor: '#fafafa',
    fontWeight: 700,
    fontSize: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#999',
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 5,
  },
  badge: {
    fontSize: 8,
    padding: 2,
    borderRadius: 3,
    marginLeft: 5,
  },
  badgeSuccess: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
  },
  badgeWarning: {
    backgroundColor: '#fff3e0',
    color: '#ef6c00',
  }
});

interface MonitoringMeetingPDFProps {
  record: MonitoringMeetingRecord;
  userName: string;
}

export const MonitoringMeetingPDF: React.FC<MonitoringMeetingPDFProps> = ({ record, userName }) => {
  const isFinalized = record.status === 'finalized';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>モニタリング会議記録</Text>
          <Text style={{ textAlign: 'center', fontSize: 10, color: '#666' }}>
            （強度行動障害支援体制加算に係る証跡資料）
          </Text>
          
          {isFinalized && (
            <View style={styles.finalizedStamp}>
              <Text>確定済み</Text>
              <Text style={{ fontSize: 6 }}>{formatDateYmd(record.finalizedAt || '')}</Text>
            </View>
          )}
        </View>

        {/* 1. 基本情報 */}
        <View style={styles.metaTable}>
          <View style={styles.metaCell}>
            <Text style={styles.label}>利用者氏名</Text>
            <Text style={styles.value}>{userName}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.label}>開催日時</Text>
            <Text style={styles.value}>{formatDateYmd(record.meetingDate)}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.label}>開催場所</Text>
            <Text style={styles.value}>{record.venue}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.label}>対象計画シート</Text>
            <Text style={styles.value}>{record.planningSheetTitle || '(未指定)'}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.label}>会議種別</Text>
            <Text style={styles.value}>{MEETING_TYPE_LABELS[record.meetingType]}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.label}>前回会議ID</Text>
            <Text style={styles.value}>{record.previousMeetingId || '(新規/未指定)'}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.label}>記録者</Text>
            <Text style={styles.value}>{record.recordedBy}</Text>
          </View>
        </View>

        {/* 2. 参加者 & 資格要件 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>参加者と資格要件（監査重要項目）</Text>
          <View style={[styles.attendeeRow, styles.attendeeHeader]}>
            <Text style={{ width: '40%' }}>氏名</Text>
            <Text style={{ width: '30%' }}>職種/役割</Text>
            <Text style={{ width: '30%' }}>資格要件(研修修了)</Text>
          </View>
          {record.attendees.map((a, i) => (
            <View key={i} style={styles.attendeeRow}>
              <Text style={{ width: '40%' }}>{a.name}</Text>
              <Text style={{ width: '30%' }}>{a.role}</Text>
              <Text style={{ width: '30%', fontSize: 8 }}>
                {a.hasPracticalTraining ? '実践研修修了' : a.hasBasicTraining ? '基礎研修修了' : '-'}
              </Text>
            </View>
          ))}
          <View style={{ marginTop: 5, padding: 5, backgroundColor: '#f9f9f9', flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 9 }}>研修修了者の参加状況：</Text>
            {record.hasBasicTrainedMember ? (
              <Text style={[styles.badge, styles.badgeSuccess]}>基礎研修修了者 以上 参加済み（要件充足）</Text>
            ) : (
              <Text style={[styles.badge, styles.badgeWarning]}>要件未充足（基礎研修修了者の参加が推奨されます）</Text>
            )}
          </View>
        </View>

        {/* 3. 実施状況・変化のポイント */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>支援の実施状況と状態の変化</Text>
          <View style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 8, color: '#666' }}>●支援目標に対する実施状況</Text>
            <View style={styles.contentBox}><Text>{record.implementationSummary}</Text></View>
          </View>
          <View>
            <Text style={{ fontSize: 8, color: '#666' }}>●行動面の変化（強度行動障害支援エピソード）</Text>
            <View style={styles.contentBox}><Text>{record.behaviorChangeSummary}</Text></View>
          </View>
        </View>

        {/* 4. 検討内容 (核心的証跡) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>会議での具体的検討内容（PDCAの記録）</Text>
          <View style={[styles.contentBox, { minHeight: 150 }]}>
            <Text>{record.discussionSummary}</Text>
          </View>
        </View>

        {/* 5. 結論 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>結論と今後の予定</Text>
          <View style={styles.metaTable}>
            <View style={[styles.metaCell, { width: '100%' }]}>
              <Text style={styles.label}>支援計画の更新判定</Text>
              <Text style={styles.value}>{PLAN_CHANGE_LABELS[record.planChangeDecision]}</Text>
            </View>
            <View style={[styles.metaCell, { width: '100%' }]}>
              <Text style={styles.label}>特記事項 / 決定事項</Text>
              <Text style={styles.value}>
                {record.requiresPlanSheetUpdate ? '・支援計画シートの修正を行う\n' : ''}
                {record.requiresIspUpdate ? '・個別支援計画書の修正を行う\n' : ''}
                {record.decisions.join('\n')}
              </Text>
            </View>
            <View style={[styles.metaCell, { width: '100%' }]}>
              <Text style={styles.label}>次回モニタリング予定</Text>
              <Text style={styles.value}>{record.nextMonitoringDate ? formatDateYmd(record.nextMonitoringDate) : '未定'}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>
            本書類はシステマティックに管理・確定された電子的証跡の出力物です。
          </Text>
          <Text>
            出力日時: {formatDateTimeYmdHm(new Date().toISOString())} / 管理ID: {record.id || 'Draft'} / status: {record.status}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default MonitoringMeetingPDF;
