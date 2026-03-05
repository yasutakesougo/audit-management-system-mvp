/**
 * Default support step templates
 *
 * Standard 19-item support procedure templates used across the support module.
 * Extracted from SupportRecordPage.tsx for reuse.
 */

import type { SupportStep } from '@/types/support';

export const defaultSupportSteps: Omit<SupportStep, 'id'>[] = [
  { stepNumber: 1, category: '朝の準備', title: '朝の挨拶', description: '明るく挨拶をして一日を始める', targetBehavior: '自発的に挨拶する', supportMethod: '職員から先に挨拶し、応答を促す', duration: 5, importance: '必須' },
  { stepNumber: 2, category: '朝の準備', title: '持ち物確認', description: '必要な持ち物を確認する', targetBehavior: '自分で持ち物をチェックする', supportMethod: 'チェックリストを使って一緒に確認', duration: 10, importance: '必須' },
  { stepNumber: 3, category: '健康確認', title: '体調確認', description: '体調や気分を確認する', targetBehavior: '体調について答える', supportMethod: '具体的に質問し、様子を観察', duration: 5, importance: '必須' },
  { stepNumber: 4, category: '活動準備', title: '活動説明', description: '今日の活動予定を説明', targetBehavior: '活動内容を理解する', supportMethod: 'スケジュール表を見せながら説明', duration: 10, importance: '推奨' },
  { stepNumber: 5, category: 'AM活動', title: '作業開始', description: '午前の作業活動を開始', targetBehavior: '指示に従って作業を始める', supportMethod: '手順を示し、必要に応じて補助', duration: 90, importance: '必須' },
  { stepNumber: 6, category: 'AM活動', title: '休憩', description: '適切なタイミングで休憩', targetBehavior: '疲労を感じたら休憩を要求', supportMethod: '様子を見て休憩を促す', duration: 15, importance: '推奨' },
  { stepNumber: 7, category: '昼食準備', title: '手洗い', description: '食事前の手洗い', targetBehavior: '自発的に手洗いをする', supportMethod: '手洗い場に案内し、手順を示す', duration: 5, importance: '必須' },
  { stepNumber: 8, category: '昼食', title: '食事', description: '昼食を摂る', targetBehavior: 'マナーを守って食事する', supportMethod: '必要に応じて食事介助', duration: 45, importance: '必須' },
  { stepNumber: 9, category: '昼食', title: '片付け', description: '食後の片付け', targetBehavior: '自分の食器を片付ける', supportMethod: '片付ける場所を示し、一緒に行う', duration: 10, importance: '推奨' },
  { stepNumber: 10, category: '休憩', title: '昼休み', description: '昼食後の休憩時間', targetBehavior: '適切な休憩を取る', supportMethod: 'リラックスできる環境を提供', duration: 30, importance: '任意' },
  { stepNumber: 11, category: 'PM活動', title: '午後作業', description: '午後の活動開始', targetBehavior: '午後の作業に取り組む', supportMethod: '集中できるよう環境を整える', duration: 90, importance: '必須' },
  { stepNumber: 12, category: 'PM活動', title: 'レクリエーション', description: '楽しい活動時間', targetBehavior: '他者と協力して活動する', supportMethod: '参加しやすい雰囲気作り', duration: 30, importance: '推奨' },
  { stepNumber: 13, category: '終了準備', title: '作業終了', description: '作業を終了し片付け', targetBehavior: '使った道具を片付ける', supportMethod: '片付け方を指導', duration: 15, importance: '必須' },
  { stepNumber: 14, category: '終了準備', title: '清掃活動', description: '使用した場所の清掃', targetBehavior: '自分の作業場所を清掃', supportMethod: '清掃方法を示し、一緒に実施', duration: 15, importance: '推奨' },
  { stepNumber: 15, category: '振り返り', title: '一日の振り返り', description: '今日の活動を振り返る', targetBehavior: '感想や気づきを話す', supportMethod: '質問しながら振り返りを促す', duration: 10, importance: '推奨' },
  { stepNumber: 16, category: '振り返り', title: '明日の確認', description: '明日の予定確認', targetBehavior: '明日の活動を理解', supportMethod: 'スケジュール表で明日の予定説明', duration: 5, importance: '任意' },
  { stepNumber: 17, category: '終了準備', title: '帰りの準備', description: '帰宅準備を行う', targetBehavior: '忘れ物なく準備する', supportMethod: 'チェックリストで確認', duration: 10, importance: '必須' },
  { stepNumber: 18, category: 'その他', title: '連絡帳記入', description: '保護者への連絡事項記入', targetBehavior: '今日の様子を伝える', supportMethod: '本人と一緒に記入', duration: 10, importance: '推奨' },
  { stepNumber: 19, category: 'その他', title: '帰りの挨拶', description: 'お疲れ様の挨拶', targetBehavior: '感謝の気持ちを表現', supportMethod: '職員から挨拶し、応答を促す', duration: 5, importance: '必須' },
];
