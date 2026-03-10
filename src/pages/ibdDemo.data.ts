/**
 * IBD Demo Page — Demo Data
 *
 * Contains demo scene definitions and constants for the IBD demo page.
 * Extracted from IBDDemoPage.tsx for better maintainability.
 *
 * @module pages/ibdDemo.data
 */

import type { SupportScene } from '@/features/ibd/core/ibdTypes';

export const DEMO_USER_ID = 42;

export const DEMO_SCENES: SupportScene[] = [
  {
    id: 'scene-arrival',
    sceneType: 'arrival',
    label: '朝の来所',
    iconKey: 'DirectionsWalk',
    positiveConditions: [
      '馴染みのスタッフが出迎える',
      '視覚的スケジュールが提示されている',
      '静かな環境（BGMなし）',
    ],
    procedures: [
      { order: 1, personAction: '玄関で立ち止まる', supporterAction: '名前を呼んで笑顔で出迎え、荷物置き場を指差す', stage: 'proactive' },
      { order: 2, personAction: '荷物を置いてスケジュールを確認', supporterAction: '写真カードで本日の流れを提示', stage: 'proactive' },
      { order: 3, personAction: '不安な表情を見せる', supporterAction: '好きな活動カードを見せて選択肢を提示', stage: 'earlyResponse' },
    ],
  },
  {
    id: 'scene-meal',
    sceneType: 'meal',
    label: '食事',
    iconKey: 'Restaurant',
    positiveConditions: [
      '決まった席に着席',
      '周囲の音が少ない',
      '好みのメニューが事前にわかっている',
    ],
    procedures: [
      { order: 1, personAction: '席に着いて待つ', supporterAction: 'メニュー写真カードを提示し、食べる順番を視覚化', stage: 'proactive' },
      { order: 2, personAction: '食べ物を投げようとする', supporterAction: '静かに「おしまいカード」を提示し、クールダウンスペースへ誘導', stage: 'crisisResponse' },
    ],
  },
  {
    id: 'scene-activity',
    sceneType: 'activity',
    label: '活動',
    iconKey: 'SportsEsports',
    positiveConditions: [
      '活動の見通しが持てている',
      '適切な難易度の課題',
      'タイマーで終了時刻が明確',
    ],
    procedures: [
      { order: 1, personAction: '活動に取り組む', supporterAction: 'タイマーを設定し残り時間を視覚化', stage: 'proactive' },
      { order: 2, personAction: '課題を拒否する', supporterAction: '選択肢（別の活動）を2つ提示', stage: 'earlyResponse' },
    ],
  },
  {
    id: 'scene-panic',
    sceneType: 'panic',
    label: 'パニック時',
    iconKey: 'Warning',
    positiveConditions: [
      'クールダウンスペースが確保されている',
      '応援スタッフの連絡体制が整っている',
    ],
    procedures: [
      { order: 1, personAction: '大声を出す・物を叩く', supporterAction: '安全距離を確保（2m以上）、周囲の利用者を避難', stage: 'crisisResponse' },
      { order: 2, personAction: '徐々に落ち着く', supporterAction: '静かに水を差し出す、好きなアイテムをそばに置く', stage: 'postCrisis' },
    ],
  },
  {
    id: 'scene-departure',
    sceneType: 'departure',
    label: '帰宅準備',
    iconKey: 'Home',
    positiveConditions: [
      '帰りの流れが視覚化されている',
      '送迎車両の到着時刻が伝わっている',
    ],
    procedures: [
      { order: 1, personAction: '荷物をまとめる', supporterAction: 'チェックリストカードで忘れ物確認を促す', stage: 'proactive' },
    ],
  },
];
