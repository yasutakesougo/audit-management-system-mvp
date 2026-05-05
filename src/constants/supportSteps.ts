/**
 * Default support step templates
 *
 * Standard 17-item support procedure templates used across the support module.
 * Extracted from SupportRecordPage.tsx for reuse.
 */

import type { SupportStep } from '@/types/support';

export const defaultSupportSteps: Omit<SupportStep, 'id'>[] = [
  { stepNumber: 1, category: '朝の準備', title: '通所・朝の準備', description: '手洗い、消毒、荷物をロッカーへ入れる', targetBehavior: '自発的に手洗いをする', supportMethod: '通所時の様子を確認し、必要に応じて声かけ・見守りを行う', duration: 30, importance: '必須' },
  { stepNumber: 2, category: '朝の準備', title: '体操', description: '体操に参加する', targetBehavior: '体操に参加する', supportMethod: '本人の様子を見ながら参加を促す', duration: 10, importance: '必須' },
  { stepNumber: 3, category: '朝の準備', title: 'スケジュール確認', description: '一日の予定を確認する', targetBehavior: '一日の予定を確認する', supportMethod: '本人と一緒に予定を確認し、見通しが持てるよう支援する', duration: 5, importance: '必須' },
  { stepNumber: 4, category: '休憩', title: 'お茶休憩', description: '手洗い後、お茶を飲む', targetBehavior: '休憩を取る', supportMethod: 'お茶の準備、片付け、必要に応じた声かけを行う', duration: 5, importance: '必須' },
  { stepNumber: 5, category: 'AM活動', title: 'AM日中活動', description: '午前の日中活動に参加する', targetBehavior: '午前の日中活動に参加する', supportMethod: '必要に応じて声かけ、見守り、同行支援を行う', duration: 100, importance: '必須' },
  { stepNumber: 6, category: '昼食準備', title: '昼食準備', description: '手洗い、消毒、昼食準備を行う', targetBehavior: '食事の準備をする', supportMethod: '手洗い・消毒・配膳等を見守り、必要に応じて支援する', duration: 10, importance: '必須' },
  { stepNumber: 7, category: '昼食', title: '昼食', description: '昼食を食べる', targetBehavior: '昼食を食べる', supportMethod: '食事の様子を見守り、必要に応じて声かけ・介助を行う', duration: 30, importance: '必須' },
  { stepNumber: 8, category: '休憩', title: '昼休み', description: '休憩時間を過ごす', targetBehavior: '休憩時間を過ごす', supportMethod: '休憩中の様子を見守り、必要に応じて声かけを行う', duration: 65, importance: '必須' },
  { stepNumber: 9, category: 'PM活動', title: 'スケジュール確認', description: '午後の予定を確認する', targetBehavior: '午後の予定を確認する', supportMethod: '本人と一緒に午後の予定を確認する', duration: 0, importance: '必須' },
  { stepNumber: 10, category: 'PM活動', title: 'PM日中活動', description: '午後の日中活動に参加する', targetBehavior: '午後の日中活動に参加する', supportMethod: '必要に応じて声かけ、見守り、同行支援を行う', duration: 45, importance: '必須' },
  { stepNumber: 11, category: '休憩', title: 'お茶休憩', description: '手洗い後、お茶を飲む', targetBehavior: '休憩を取る', supportMethod: 'お茶の準備、片付け、必要に応じた声かけを行う', duration: 15, importance: '必須' },
  { stepNumber: 12, category: 'PM活動', title: 'PM日中活動', description: '午後の日中活動に参加する', targetBehavior: '午後の日中活動に参加する', supportMethod: '必要に応じて声かけ、見守り、同行支援を行う', duration: 35, importance: '必須' },
  { stepNumber: 13, category: '休憩', title: 'のんびりタイム', description: '落ち着いて過ごす', targetBehavior: 'のんびり過ごす', supportMethod: '本人のペースを尊重しながら見守る', duration: 20, importance: '必須' },
  { stepNumber: 14, category: '終了準備', title: '帰りの準備', description: '持ち物確認、帰宅準備を行う', targetBehavior: '帰る準備をする', supportMethod: '持ち物確認や身支度を見守り、必要に応じて支援する', duration: 20, importance: '必須' },
  { stepNumber: 15, category: '終了準備', title: '退所', description: '退所する', targetBehavior: '挨拶をして帰る', supportMethod: '退所時の様子を確認し、見送りを行う', duration: 0, importance: '必須' },
  { stepNumber: 16, category: 'AM活動', title: '外活動準備', description: '外活動に向けた準備を行う', targetBehavior: '外活動の準備をする', supportMethod: 'トイレ、帽子、持ち物など外活動に必要な準備を支援する', duration: 5, importance: '任意' },
  { stepNumber: 17, category: 'AM活動', title: '外活動', description: '外活動に参加する', targetBehavior: '外活動に参加する', supportMethod: '外活動中の安全確認、同行支援、見守りを行う', duration: 95, importance: '任意' },
];
