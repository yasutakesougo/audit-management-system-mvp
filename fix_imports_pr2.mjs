import fs from 'fs';
import path from 'path';

const targetDir = path.join(process.cwd(), 'src');

const componentMappings = {
  'ScheduleDialogManager': 'dialogs/ScheduleDialogManager',
  'UserStatusQuickDialog': 'dialogs/UserStatusQuickDialog',
  'CreateScheduleDialog': 'dialogs/CreateScheduleDialog',
  'SchedulesHeader': 'sections/SchedulesHeader',
  'ScheduleFilterBar': 'sections/ScheduleFilterBar',
  'SchedulesFilterResponsive': 'sections/SchedulesFilterResponsive',
  'SchedulesSpLane': 'sections/SchedulesSpLane',
  'TimelineItem': 'timeline/TimelineItem',
  'ScheduleViewContainer': 'pages/ScheduleViewContainer'
};

const hookMappings = {
  'useSchedules': 'legacy/useSchedules',
  'useSchedulesCrud': 'legacy/useSchedulesCrud',
  'useScheduleCreateForm': 'orchestrators/useScheduleCreateForm',
  'useWeekPageOrchestrator': 'orchestrators/useWeekPageOrchestrator',
  'useSchedulesPageState': 'view-models/useSchedulesPageState',
  'useWeekPageRouteState': 'view-models/useWeekPageRouteState',
  'useWeekPageUiState': 'view-models/useWeekPageUiState'
};

function walkSync(currentDirPath, callback) {
  if (!fs.existsSync(currentDirPath)) return;
  fs.readdirSync(currentDirPath).forEach(name => {
    const filePath = path.join(currentDirPath, name);
    const stat = fs.statSync(filePath);
    if (stat.isFile() && (filePath.endsWith('.ts') || filePath.endsWith('.tsx'))) {
      callback(filePath);
    } else if (stat.isDirectory() && name !== 'node_modules') {
      walkSync(filePath, callback);
    }
  });
}

const importRegex = /from\s+['"](.*?)['"]/g;

walkSync(targetDir, filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  let newContent = content.replace(importRegex, (match, importPath) => {
    let newImportPath = importPath;

    for (const [oldName, newName] of Object.entries(hookMappings)) {
      if (importPath.endsWith(`hooks/${oldName}`) || importPath.includes(`/${oldName}`) && !importPath.includes(`/${newName}`)) {
         if (filePath.replace(/\\/g, '/').includes('/features/schedules/components') && importPath.startsWith('../hooks/')) {
            newImportPath = importPath.replace(`../hooks/${oldName}`, `../hooks/${newName}`);
         } else if (filePath.replace(/\\/g, '/').includes('/features/schedules/hooks') && importPath.startsWith('./')) {
            newImportPath = importPath.replace(`./${oldName}`, `../${newName}`);
         } else {
            newImportPath = newImportPath.replace(new RegExp(`hooks/${oldName}$`), `hooks/${newName}`);
         }
      }
    }

    for (const [oldName, newName] of Object.entries(componentMappings)) {
      if (importPath.endsWith(`components/${oldName}`) || importPath.includes(`/${oldName}`) && !importPath.includes(`/${newName}`)) {
         if (filePath.replace(/\\/g, '/').includes('/features/schedules/components') && importPath.startsWith('./')) {
            newImportPath = importPath.replace(`./${oldName}`, `../components/${newName}`);
         } else if (filePath.replace(/\\/g, '/').includes('/features/schedules/pages') && importPath.startsWith('../components/')) {
            newImportPath = importPath.replace(`../components/${oldName}`, `../components/${newName}`);
         } else {
            newImportPath = newImportPath.replace(new RegExp(`components/${oldName}$`), `components/${newName}`);
         }
      }
    }

    if (newImportPath !== importPath) {
      changed = true;
      return `from '${newImportPath}'`;
    }
    return match;
  });
  
  for (const [oldName, newName] of Object.entries(componentMappings)) {
    const rx2 = new RegExp(`components/${oldName}(['"])`, 'g');
    if (rx2.test(newContent)) {
       newContent = newContent.replace(rx2, `components/${newName}$1`);
       changed = true;
    }
  }
  for (const [oldName, newName] of Object.entries(hookMappings)) {
    const rx2 = new RegExp(`hooks/${oldName}(['"])`, 'g');
    if (rx2.test(newContent)) {
       newContent = newContent.replace(rx2, `hooks/${newName}$1`);
       changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated ${filePath}`);
  }
});
