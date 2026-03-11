/**
 * inferTodayScene — 現在時刻から運営場面をヒューリスティクスで推定
 *
 * これは「大まかな推定」であり、運営を制御するものではない。
 * 場面の切り替えは実際にはスタッフの判断で行われる。
 *
 * 時間境界値:
 *   ~09:30  morning-briefing
 *   ~10:20  arrival-intake
 *   ~10:30  before-am-activity
 *   ~11:45  am-activity
 *   ~13:00  lunch-transition
 *   ~13:45  before-pm-activity
 *   ~15:20  pm-activity
 *   ~15:40  post-activity
 *   ~16:00  before-departure
 *   16:00~  day-closing
 */
import type { TodayScene } from './todayScene';

export function inferTodayScene(now: Date): TodayScene {
  const hour = now.getHours();
  const minute = now.getMinutes();
  const time = hour * 60 + minute;

  if (time < 570) return 'morning-briefing';       // before 9:30
  if (time < 620) return 'arrival-intake';          // 9:30 ~ 10:20
  if (time < 630) return 'before-am-activity';      // 10:20 ~ 10:30
  if (time < 705) return 'am-activity';             // 10:30 ~ 11:45
  if (time < 780) return 'lunch-transition';        // 11:45 ~ 13:00
  if (time < 825) return 'before-pm-activity';      // 13:00 ~ 13:45
  if (time < 920) return 'pm-activity';             // 13:45 ~ 15:20
  if (time < 940) return 'post-activity';           // 15:20 ~ 15:40
  if (time < 960) return 'before-departure';        // 15:40 ~ 16:00

  return 'day-closing';                             // 16:00~
}
