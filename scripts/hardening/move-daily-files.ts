import { Project } from 'ts-morph';
import * as path from 'path';

const project = new Project({
  tsConfigFilePath: 'tsconfig.json'
});

const dailyRootAbs = path.join(process.cwd(), 'src/features/daily').replace(/\\/g, '/');

// Get all files that belong to features/daily
const allFiles = project.getSourceFiles().filter(f => {
  const fp = f.getFilePath().replace(/\\/g, '/'); // ensure standard slashes
  return fp.startsWith(dailyRootAbs + '/') && !fp.endsWith('index.ts');
});

let moveCount = 0;

console.log(`Analyzing ${allFiles.length} files in daily...`);

for (const file of allFiles) {
  const oldPathAbs = file.getFilePath().replace(/\\/g, '/');
  const relPath = oldPathAbs.replace(dailyRootAbs + '/', '');
  const basename = path.basename(relPath);
  const parts = relPath.split('/');
  
  let newRelPath = relPath;

  // 1. Root files
  if (relPath === 'schema.ts') newRelPath = 'domain/schema.ts';
  if (relPath === 'repositoryFactory.ts') newRelPath = 'repositories/repositoryFactory.ts';

  // 2. Extracted pure folders
  if (relPath.startsWith('adapters/')) newRelPath = 'repositories/' + relPath;
  if (relPath.startsWith('infra/')) newRelPath = 'repositories/sharepoint/' + relPath.replace('infra/', '');
  if (relPath.startsWith('forms/')) newRelPath = 'components/' + relPath;
  if (relPath.startsWith('table/')) newRelPath = 'components/' + relPath;
  if (relPath.startsWith('lists/')) newRelPath = 'components/' + relPath;
  if (relPath.startsWith('stores/')) newRelPath = 'hooks/legacy-stores/' + relPath.replace('stores/', '');

  // 3. Components grouping (only flat items in components/)
  if (parts.length === 2 && parts[0] === 'components') {
    if (basename.endsWith('Page.tsx')) {
       newRelPath = `components/pages/${basename}`;
    } else if (basename.endsWith('Dialog.tsx') || basename.endsWith('Modal.tsx')) {
       newRelPath = `components/dialogs/${basename}`;
    } else if (basename.endsWith('Form.tsx')) {
       newRelPath = `components/forms/${basename}`;
    } else if (basename.includes('Banner') || basename.includes('Panel') || basename.includes('Bar') || basename.includes('Header') || basename.includes('Table') || basename.includes('Picker') || basename.includes('Hero')) {
       newRelPath = `components/sections/${basename}`;
    } else if (basename.includes('Chips') || basename.includes('Badges')) {
       newRelPath = `components/sections/${basename}`;
    } else if (basename === 'RecordActionQueue.tsx' || basename === 'QuickTagArea.tsx' || basename === 'MonitoringCountdown.tsx'){
       newRelPath = `components/sections/${basename}`;
    } else if (basename === 'TbsSnackbarFeedback.tsx') {
       newRelPath = `components/dialogs/${basename}`;
    } else {
       newRelPath = `components/legacy/${basename}`;
    }
  }

  // 4. Hooks grouping (only flat hooks/)
  if (parts.length === 2 && parts[0] === 'hooks') {
    if (basename.includes('Persistence')) {
       newRelPath = `hooks/mutations/${basename}`;
    } else if (basename.includes('Form')) {
       newRelPath = `hooks/view-models/${basename}`;
    } else if (basename.includes('Page') || basename.includes('Routing') || basename === 'useTableDailyRecordSelection.ts' || basename === 'useTableDailyRecordRowHandlers.ts' || basename === 'useTableDailyRecordFiltering.ts') {
       newRelPath = `hooks/orchestrators/${basename}`;
    } else {
       newRelPath = `hooks/legacy/${basename}`;
    }
  }

  // 5. Domain grouping (only flat domain/)
  if (parts.length === 2 && parts[0] === 'domain') {
    if (basename.includes('Mapper')) {
       newRelPath = `domain/mappers/${basename}`;
    } else if (basename === 'toBipOptions.ts' || basename === 'rowInitialization.ts' || basename === 'getScheduleKey.ts') {
       newRelPath = `domain/builders/${basename}`;
    } else if (basename === 'dailyRecordLogic.ts' || basename === 'deriveDefaultStrategies.ts' || basename === 'dailyRecordLogicLib.ts' || basename === 'nextIncompleteRecord.ts') {
       newRelPath = `domain/validation/${basename}`;
    } else if (basename.includes('Bridge')) {
       newRelPath = `domain/bridges/${basename}`;
    } else if (basename.includes('behavior')) {
       newRelPath = `domain/behavior/${basename}`;
    } else {
       newRelPath = `domain/legacy/${basename}`;
    }
  }

  if (newRelPath !== relPath) {
    const newAbsPath = path.join(dailyRootAbs, newRelPath).replace(/\\/g, '/');
    const newDirAbsPath = path.dirname(newAbsPath);
    console.log(`Move: ${relPath} -> ${newRelPath}`);
    // This correctly schedules the move in the internal VFS of ts-morph
    file.moveToDirectory(newDirAbsPath);
    moveCount++;
  }
}

if (moveCount > 0) {
  console.log(`Planning complete. Moving ${moveCount} files and updating imports automatically via TS compiler API...`);
  // Automatically fixes all affected import statements
  project.saveSync();
  console.log('✅ Move operations saved and imports updated successfully!');
} else {
  console.log('No files to move.');
}
