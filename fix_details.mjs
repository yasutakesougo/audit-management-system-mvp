import fs from 'fs';

function replaceInFile(filePath, searchRegex, replacement) {
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    const replaced = code.replace(searchRegex, replacement);
    if (code !== replaced) {
      fs.writeFileSync(filePath, replaced, 'utf8');
      console.log(`Fixed ${filePath}`);
    }
  } catch(e){}
}

const p1 = 'src/features/schedules/components/dialogs/ScheduleDialogManager.tsx';
replaceInFile(p1, /from '\.\.\/data'/g, "from '../../data'");
replaceInFile(p1, /from '\.\.\/domain\/scheduleFormState'/g, "from '../../domain/scheduleFormState'");
replaceInFile(p1, /from '\.\.\/hooks\/view-models\/useSchedulesPageState'/g, "from '../../hooks/view-models/useSchedulesPageState'");
replaceInFile(p1, /from '\.\.\/domain\/scheduleAutofillRules'/g, "from '../../domain/validation/scheduleAutofillRules'");
replaceInFile(p1, /from '\.\.\/domain\/scheduleQuickTemplates'/g, "from '../../domain/builders/scheduleQuickTemplates'");
replaceInFile(p1, /from '\.\.\/routes\/ScheduleCreateDialog'/g, "from '../../routes/ScheduleCreateDialog'");
replaceInFile(p1, /from '\.\.\/routes\/ScheduleViewDialog'/g, "from '../../routes/ScheduleViewDialog'");

const p2 = 'src/features/schedules/components/dialogs/UserStatusQuickDialog.tsx';
replaceInFile(p2, /from '\.\.\/domain\/userStatus'/g, "from '../../domain/mappers/userStatus'");
replaceInFile(p2, /from '\.\.\/hooks\/useUserStatusActions'/g, "from '../../hooks/useUserStatusActions'");
replaceInFile(p2, /\(type\) =>/g, "(type: any) =>");

const p3 = 'src/features/schedules/components/MobileAgendaView.tsx';
replaceInFile(p3, /from '\.\.\/hooks\/legacy\/useSchedulesToday'/g, "from '../hooks/useSchedulesToday'");
replaceInFile(p3, /schedule, index/g, "schedule: any, index: any");

const p4 = 'src/features/schedules/components/pages/ScheduleViewContainer.tsx';
replaceInFile(p4, /from '\.\.\/data'/g, "from '../../data'");
replaceInFile(p4, /from '\.\.\/domain\/types'/g, "from '../../domain/types'");
replaceInFile(p4, /from '\.\.\/routes\/DayView'/g, "from '../../routes/DayView'");
replaceInFile(p4, /from '\.\.\/routes\/MonthPage'/g, "from '../../routes/MonthPage'");
replaceInFile(p4, /from '\.\.\/routes\/WeekView'/g, "from '../../routes/WeekView'");

const p5 = 'src/features/schedules/components/sections/ScheduleFilterBar.tsx';
replaceInFile(p5, /from '\.\.\/domain\/categoryLabels'/g, "from '../../domain/mappers/categoryLabels'");
replaceInFile(p5, /from '\.\.\/domain\/types'/g, "from '../../domain/types'");
replaceInFile(p5, /from '\.\.\/components\/sections\/SchedulesFilterResponsive'/g, "from './SchedulesFilterResponsive'");

const p6 = 'src/features/schedules/components/sections/SchedulesSpLane.tsx';
replaceInFile(p6, /from '\.\.\/\.\.\/dashboard\/types\/hub'/g, "from '../../../dashboard/types/hub'");

const p7 = 'src/features/schedules/components/timeline/TimelineItem.tsx';
replaceInFile(p7, /from '\.\.\/constants'/g, "from '../../constants'");
replaceInFile(p7, /from '\.\.\/data'/g, "from '../../data'");
replaceInFile(p7, /from '\.\.\/statusMetadata'/g, "from '../../statusMetadata'");

const p8 = 'src/features/schedules/hooks/legacy/useSchedules.ts';
replaceInFile(p8, /from '\.\.\/data\/spSchema'/g, "from '../../data/spSchema'");
replaceInFile(p8, /from '\.\.\/domain'/g, "from '../../domain'");
replaceInFile(p8, /from '\.\.\/domain\/inlineScheduleDraft'/g, "from '../../domain/builders/inlineScheduleDraft'");
replaceInFile(p8, /from '\.\.\/errors'/g, "from '../../errors'");
replaceInFile(p8, /from '\.\.\/repositoryFactory'/g, "from '../../repositoryFactory'");

const p9 = 'src/features/schedules/hooks/legacy/useSchedulesCrud.ts';
replaceInFile(p9, /from '\.\.\/errors'/g, "from '../../errors'");
replaceInFile(p9, /from '\.\/useWeekPageRouteState'/g, "from '../view-models/useWeekPageRouteState'");

const p10 = 'src/features/schedules/hooks/orchestrators/useScheduleCreateForm.ts';
replaceInFile(p10, /from '\.\.\/data'/g, "from '../../data'");
replaceInFile(p10, /from '\.\.\/domain\/scheduleFormState'/g, "from '../../domain/scheduleFormState'");
replaceInFile(p10, /from '\.\.\/utils\/scheduleAnnouncements'/g, "from '../../utils/scheduleAnnouncements'");
replaceInFile(p10, /from '\.\/useOrgOptions'/g, "from '../useOrgOptions'");
replaceInFile(p10, /from '\.\/useStaffOptions'/g, "from '../useStaffOptions'");
replaceInFile(p10, /\(option\)/g, "(option: any)");
replaceInFile(p10, /\(prev\)/g, "(prev: any)");
replaceInFile(p10, /prev =>/g, "(prev: any) =>");

const p11 = 'src/features/schedules/hooks/orchestrators/useWeekPageOrchestrator.ts';
replaceInFile(p11, /from '\.\.\/legacy\/useSchedulesNavigation'/g, "from '../useSchedulesNavigation'");
replaceInFile(p11, /from '\.\.\/domain\/scheduleNextGap'/g, "from '../../domain/validation/scheduleNextGap'");

replaceInFile('src/features/schedules/hooks/useScheduleOps.ts', /from '\.\.\/legacy\/useSchedules'/g, "from './legacy/useSchedules'");
replaceInFile('src/features/schedules/hooks/useScheduleOpsData.ts', /from '\.\.\/legacy\/useSchedules'/g, "from './legacy/useSchedules'");
replaceInFile('src/features/schedules/hooks/useSchedulesNavigation.ts', /from '\.\.\/legacy\/useSchedules'/g, "from './legacy/useSchedules'");
replaceInFile('src/features/schedules/hooks/useSchedulesNavigation.ts', /from '\.\.\/view-models\/useSchedulesPageState'/g, "from './view-models/useSchedulesPageState'");
replaceInFile('src/features/schedules/hooks/useUserStatusActions.ts', /from '\.\.\/legacy\/useSchedules'/g, "from './legacy/useSchedules'");
replaceInFile('src/features/schedules/hooks/useUserStatusActions.ts', /userId\?: string \| undefined;\s+start\?: string \| undefined;\s+serviceType\?: string \| null \| undefined/g, "id: string; userId?: string | undefined; start?: string | undefined; serviceType?: string | null | undefined; userName?: string");

replaceInFile('src/features/schedules/hooks/view-models/useSchedulesPageState.ts', /from '\.\.\/errors'/g, "from '../../errors'");
