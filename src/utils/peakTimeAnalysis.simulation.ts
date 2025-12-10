/**
 * Safety HUD ピーク分析エンジン実データシミュレーション
 * 7日間のサンプルデータでコメント生成をテスト
 */

import {
    analyzeStability,
    generateIntegratedComment,
    getAllTimeSlotAnalysis,
    summarizePeakTimeSlots,
    type ConflictWithTime,
} from './peakTimeAnalysis';

// 📊 リアルな7日間のコンフリクトデータサンプル
const sampleWeekData: ConflictWithTime[][] = [
  // Day 1 (月曜日): 朝の引き継ぎ時間帯にコンフリクト
  [
    { start: '08:45', staffId: 'staff001', scheduleId: 'sch001' },
    { start: '11:30', staffId: 'staff002', scheduleId: 'sch002' },
  ],

  // Day 2 (火曜日): 昼食時間帯に集中
  [
    { start: '11:45', staffId: 'staff003', scheduleId: 'sch003' },
    { start: '12:15', staffId: 'staff004', scheduleId: 'sch004' },
    { start: '12:30', staffId: 'staff001', scheduleId: 'sch005' },
  ],

  // Day 3 (水曜日): 比較的静か
  [
    { start: '15:30', staffId: 'staff005', scheduleId: 'sch006' },
  ],

  // Day 4 (木曜日): 再び朝と昼にコンフリクト
  [
    { start: '09:00', staffId: 'staff002', scheduleId: 'sch007' },
    { start: '11:00', staffId: 'staff006', scheduleId: 'sch008' },
    { start: '14:45', staffId: 'staff007', scheduleId: 'sch009' },
  ],

  // Day 5 (金曜日): 週末前で少し忙しい
  [
    { start: '10:15', staffId: 'staff003', scheduleId: 'sch010' },
    { start: '13:00', staffId: 'staff001', scheduleId: 'sch011' },
  ],

  // Day 6 (土曜日): 休日スタッフ配置で静か
  [],

  // Day 7 (日曜日): 完全に静か
  [],
];

/**
 * 📈 週データのサマリー統計を計算
 */
function calculateWeekSummary(weekData: ConflictWithTime[][]) {
  const totalConflicts = weekData.reduce((sum, day) => sum + day.length, 0);
  const activeDays = weekData.filter(day => day.length > 0).length;
  const averageConflicts = totalConflicts / weekData.length;

  return {
    totalConflicts,
    activeDays,
    averageConflicts,
    totalDays: weekData.length,
  };
}

/**
 * 🎯 Safety HUD 分析レポートを生成
 */
export function generateSafetyHudReport(weekData: ConflictWithTime[][] = sampleWeekData) {
  const summary = calculateWeekSummary(weekData);

  // ピーク分析
  const peakAnalysis = summarizePeakTimeSlots(weekData);
  const allSlots = getAllTimeSlotAnalysis(weekData);

  // 安定度分析
  const stability = analyzeStability(
    peakAnalysis?.hitDays,
    summary.averageConflicts,
    summary.totalDays
  );

  // 統合コメント
  const integratedComment = generateIntegratedComment(peakAnalysis, stability);

  return {
    summary,
    peakAnalysis,
    allSlots,
    stability,
    integratedComment,
  };
}

/**
 * 🔍 コンソール用の見やすいレポート出力
 */
export function printSafetyHudReport(weekData: ConflictWithTime[][] = sampleWeekData) {
  console.log('\n🛡️  Safety HUD - 週次負荷分析レポート');
  console.log('═'.repeat(50));

  const report = generateSafetyHudReport(weekData);

  // 📊 基本統計
  console.log(`\n📊 基本統計:`);
  console.log(`   総コンフリクト数: ${report.summary.totalConflicts}件`);
  console.log(`   コンフリクトがあった日数: ${report.summary.activeDays}/${report.summary.totalDays}日`);
  console.log(`   1日平均コンフリクト: ${report.summary.averageConflicts.toFixed(2)}件`);

  // 🎯 ピーク分析
  console.log(`\n🎯 ピーク時間帯分析:`);
  if (report.peakAnalysis) {
    console.log(`   最高負荷スロット: ${report.peakAnalysis.slotLabel}`);
    console.log(`   発生日数: ${report.peakAnalysis.hitDays}/${report.peakAnalysis.totalDays}日 (${(report.peakAnalysis.ratio * 100).toFixed(1)}%)`);
    console.log(`   重要度: ${report.peakAnalysis.severity.toUpperCase()}`);
    console.log(`   ${report.peakAnalysis.emoji} ${report.peakAnalysis.comment}`);
  } else {
    console.log('   ✅ この週はコンフリクトが発生していません');
  }

  // 📈 全スロット詳細
  console.log(`\n📈 時間スロット別詳細:`);
  if (report.allSlots.length > 0) {
    report.allSlots.forEach((slot, index: number) => {
      const percentage = (slot.ratio * 100).toFixed(1);
      console.log(`   ${index + 1}. ${slot.slotLabel}: ${slot.hitDays}日 (${percentage}%) - ${slot.severity}`);
    });
  } else {
    console.log('   📊 データなし');
  }

  // 🌟 安定度評価
  console.log(`\n🌟 運営安定度:`);
  console.log(`   レベル: ${report.stability.level.toUpperCase()}`);
  console.log(`   状態: ${report.stability.isStable ? '安定' : '要改善'}`);

  // 💬 統合メッセージ
  console.log(`\n💬 管理者向け統合メッセージ:`);
  console.log(`   ${report.integratedComment}`);

  console.log('\n' + '═'.repeat(50));
}

/**
 * 📝 異なる負荷パターンのサンプルデータ生成
 */
export const scenarioSamples = {
  // 🎯 理想的なケース: 非常に安定
  excellent: [
    [{ start: '14:30' }], // 1件だけ
    [], [], [], [], [], [],
  ] as ConflictWithTime[][],

  // ⚠️ 問題のあるケース: 毎日11時に集中
  problematic: [
    [{ start: '11:00' }, { start: '11:15' }],
    [{ start: '11:30' }],
    [{ start: '11:45' }],
    [{ start: '11:20' }],
    [{ start: '11:10' }],
    [{ start: '11:50' }],
    [{ start: '11:25' }],
  ] as ConflictWithTime[][],

  // 📈 改善傾向: 散発的だが特定時間に集中はしていない
  improving: [
    [{ start: '09:00' }],
    [{ start: '13:00' }],
    [{ start: '15:30' }],
    [],
    [{ start: '08:45' }],
    [], [],
  ] as ConflictWithTime[][],
};

// 🧪 スタンドアローン実行時のデモ
if (require.main === module) {
  console.log('🧪 Safety HUD シナリオ別テスト');

  console.log('\n1️⃣  標準的な週のデータ:');
  printSafetyHudReport(sampleWeekData);

  console.log('\n\n2️⃣  理想的な週（安定運営）:');
  printSafetyHudReport(scenarioSamples.excellent);

  console.log('\n\n3️⃣  問題のある週（11時集中）:');
  printSafetyHudReport(scenarioSamples.problematic);

  console.log('\n\n4️⃣  改善傾向の週（散発的）:');
  printSafetyHudReport(scenarioSamples.improving);
}