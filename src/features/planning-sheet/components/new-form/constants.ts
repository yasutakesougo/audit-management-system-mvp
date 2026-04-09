/**
 * NewPlanningSheetForm — 定数・プリセット・サンプルデータ
 */
import type { FormState } from './types';

export const SECTION_STEPS = [
  '基本情報',
  '対象行動',
  '氷山分析',
  'FBA',
  '予防的支援',
  '代替行動',
  '問題行動時対応',
  '危機対応',
  'モニタリング',
  'チーム共有',
] as const;

export const BEHAVIOR_FUNCTIONS = [
  { value: 'avoidance', label: '回避 / 逃避' },
  { value: 'attention', label: '注目獲得' },
  { value: 'sensory', label: '感覚刺激' },
  { value: 'demand', label: '要求 / 伝達' },
] as const;

export const TRAINING_LEVELS = [
  { value: '基礎研修', label: '基礎研修修了' },
  { value: '実践研修', label: '実践研修修了' },
  { value: '中核人材研修', label: '中核人材研修修了' },
  { value: 'なし', label: '研修未修了' },
] as const;

export const ICEBERG_FACTORS = [
  { key: 'icebergSurface', label: '問題行動（水面上）', icon: '🏔️', placeholder: '現在見えている、支援が必要な行動' },
  { key: 'triggers', label: 'きっかけ（トリガー）', icon: '⚡', placeholder: '行動を引き起こす直接的なきっかけ' },
  { key: 'environmentFactors', label: '環境的要因', icon: '🏠', placeholder: '物理的環境・人的環境・時間帯' },
  { key: 'emotions', label: '感情・心理的要因', icon: '💭', placeholder: '不安、混乱、怒り、恐怖など' },
  { key: 'cognition', label: '認知・特性的要因', icon: '🧠', placeholder: '言語理解力、障害特性、情報の捉え方' },
  { key: 'needs', label: '本人の願い（ニーズ）', icon: '💡', placeholder: '「本当はこうしたい」「こうなりたい」' },
] as const;

export const INITIAL_FORM: FormState = {
  title: '', supportLevel: '', behaviorScore: '', planPeriod: '',
  trainingLevel: 'なし', relatedOrganizations: '',
  targetBehavior: '', behaviorFrequency: '', behaviorSituation: '',
  behaviorDuration: '', behaviorIntensity: '', behaviorRisk: '', behaviorImpact: '',
  icebergSurface: '',
  triggers: '', environmentFactors: '', emotions: '',
 cognition: '', needs: '',
  behaviorFunctions: [], behaviorFunctionDetail: '',
  abcAntecedent: '', abcBehavior: '', abcConsequence: '',
  environmentalAdjustment: '', visualSupport: '', communicationSupport: '',
  safetySupport: '', preSupport: '',
  desiredBehavior: '', teachingMethod: '', practiceMethod: '', reinforcementMethod: '',
  initialResponse: '', responseEnvironment: '', safeguarding: '',
  staffResponse: '', recordMethod: '',
  dangerousBehavior: '', emergencyResponse: '', medicalCoordination: '',
  familyContact: '', safetyMethod: '', hasMedicalCoordination: false,
  evaluationIndicator: '', evaluationPeriod: '', evaluationMethod: '',
  improvementResult: '', nextSupport: '', monitoringCycleDays: 90,
  sharingMethod: '', training: '', personInCharge: '', confirmationDate: '', teamConsensusNote: '',
};

export const SAMPLE_FORM: FormState = {
  // §1
  title: '外出活動場面における行動支援計画',
  supportLevel: '区分5',
  behaviorScore: '18点',
  planPeriod: '2026年4月1日 〜 2026年9月30日',
  trainingLevel: '実践研修',
  relatedOrganizations: '相談支援センターみらい、訪問看護ステーションあおば',
  // §2
  targetBehavior: '外出活動前に予定が理解できないと大声で拒否し床に座り込む',
  behaviorFrequency: '週3〜4回（主に月曜・金曜の午前中に多い）',
  behaviorSituation: '外出活動の準備開始時（9:30頃）、活動内容の変更時',
  behaviorDuration: '5〜20分（声掛けなしで30分以上に及ぶこともある）',
  behaviorIntensity: '大声（70dB程度）、床への座り込み、周辺の物を払いのける',
  behaviorRisk: '本人：膝や肘の打撲リスク / 他者：払いのけ動作による接触リスク',
  behaviorImpact: '他利用者への心理的影響、活動スケジュールの遅延、職員の対応負荷増大',
  // §3
  icebergSurface: '外出活動前に予定が理解できないと大声で拒否し床に座り込む',
  triggers: '予定の急な変更、見通しが持てない状況、言語指示のみでの予定説明',
  environmentFactors: '騒がしい環境、複数の利用者が同時に準備する場面、初めての外出先',
  emotions: '不安、混乱、見通しが立たないことへの恐怖感',
  cognition: '言語理解は2語文程度。視覚情報の方が理解しやすい。時系列の概念が弱い',
  needs: '「何が起こるか知りたい」「安心できる情報が欲しい」「自分のペースで準備したい」',
  // §4
  behaviorFunctions: ['avoidance', 'demand'],
  behaviorFunctionDetail: '予定が分からないことによる不安の回避が主な機能。同時に「知りたい」「教えて」という要求・伝達の機能も含む。不安が高まると回避行動が優位になり、要求表出が困難になる悪循環が観察される。',
  abcAntecedent: '職員が「今日は〇〇に行きます」と口頭で伝える → 本人は視線を合わせず不安な表情',
  abcBehavior: '「いやだ！」と大声 → 床に座り込む → 周囲の物を払いのける',
  abcConsequence: '職員が対応に追われる → 外出が延期 or 中止 → 本人は静かになる（回避成功）',
  // §5
  environmentalAdjustment: '外出準備エリアを個別化（パーテーションで区切り、他利用者の動きが見えにくくする）。準備開始の5分前に個別に予告する。',
  visualSupport: '①外出先の写真カード ②活動の流れを3ステップで示すスケジュールボード ③「いつ帰るか」を時計の写真で提示',
  communicationSupport: '「いやだ」「あとで」「教えて」の3種のコミュニケーションカードを手元に配置。カードの使い方を毎朝1回練習する。',
  safetySupport: '馴染みの職員が外出時に同行する。初回の外出先は事前に写真・動画で紹介する。',
  preSupport: '前日の夕方に翌日のスケジュールを写真カードで確認する時間を設ける。当日朝の会で再度確認。',
  // §6
  desiredBehavior: '不安を感じたらコミュニケーションカード（「教えて」カード）を職員に見せる',
  teachingMethod: '落ち着いている場面でロールプレイ形式で練習。「こういう時はこのカードを出してね」と具体的に見本を示す。',
  practiceMethod: '毎朝の朝の会で1回、カード使用の練習。成功体験を毎日1回以上設定する。安定してきたら実場面での般化を目指す。',
  reinforcementMethod: 'カードを使えた場合は即時に「教えてくれてありがとう、〇〇に行くよ（写真）」と具体的に応答。好きな活動を5分追加する二次強化も併用。',
  // §7
  initialResponse: '大声が出たら穏やかに「写真見る？」と声掛け + 写真カードを手の届く位置に差し出す。叱責や制止はしない。',
  responseEnvironment: '座り込んだ場所の周辺にクッションを配置。他利用者は別室に誘導し、騒音・刺激を低減。',
  safeguarding: '払いのけ動作が見られたら1m以上の距離を保つ。硬い物品を事前に撤去。',
  staffResponse: '対応は原則1名。2名以上で囲まない。低い姿勢で横に位置し、正面からの接近は避ける。',
  recordMethod: '行動直後に「ABC簡易記録シート」に記入。頻度・持続時間・トリガーを定量記録。',
  // §8
  dangerousBehavior: '頭部を壁に打ち付ける行動が月1回程度発生（過去6ヶ月で3回）。',
  emergencyResponse: '①壁と頭の間にクッションを挿入 ②他利用者を退避 ③5分経過で主任に連絡 ④打撲確認後、医務室で観察（最低30分）',
  medicalCoordination: '月1回の精神科定期受診時にー行動記録サマリーを主治医に共有。投薬調整の相談　連絡先: △△クリニック 045-XXX-XXXX',
  familyContact: '危険行動発生時は当日中に家族に電話連絡。月次の支援報告書にも記載。緊急連絡先：母 090-XXXX-XXXX',
  safetyMethod: '壁面にクッション材を貼付。活動エリアの角にコーナーガードを設置。ヘルメットの使用は本人の拒否が強いため現時点では不使用。',
  hasMedicalCoordination: true,
  // §9
  evaluationIndicator: '①外出前の拒否行動（大声・座り込み）の頻度 ②カード使用回数 ③カード使用後のスムーズな移行率',
  evaluationPeriod: '毎月末に月次評価。3ヶ月ごとに総合評価（次回: 2026年6月30日）',
  evaluationMethod: 'ABC記録シートの集計（頻度・持続時間の推移グラフ化）。職員間カンファレンスでの質的評価。本人の表情・参加度の主観評価。',
  improvementResult: '',
  nextSupport: '',
  monitoringCycleDays: 90,
  // §10
  sharingMethod: '①朝礼での当日の留意点共有 ②週1回の支援会議で進捗報告 ③支援計画シートを休憩室に掲示（個人情報はコード化）',
  training: '新任職員向けOJT（ベテラン職員がモデリング）。月1回の事例検討会で本ケースを共有。',
  personInCharge: '主担当: 山田太郎（実践研修修了）/ 副担当: 佐藤花子（基礎研修修了）',
  confirmationDate: '2026年4月1日（計画開始時）',
  teamConsensusNote: '外出先での行動は改善傾向にあるが、初めての場所への不安は依然強い。写真事前提示の効果は高く、今後もビジュアルサポートを充実させる方針。',
};
