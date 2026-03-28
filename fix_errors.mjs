import fs from 'fs';

function replaceInFile(filePath, searchRegex, replacement) {
  const code = fs.readFileSync(filePath, 'utf8');
  const replaced = code.replace(searchRegex, replacement);
  if (code !== replaced) {
    fs.writeFileSync(filePath, replaced, 'utf8');
    console.log(`Fixed ${filePath}`);
  }
}

// inlineScheduleDraft.ts
replaceInFile('src/features/schedules/domain/builders/inlineScheduleDraft.ts', /from '\.\/ScheduleRepository'/g, "from '../ScheduleRepository'");
replaceInFile('src/features/schedules/domain/builders/inlineScheduleDraft.ts', /from '\.\/types'/g, "from '../types'");

// scheduleQuickTemplates.ts
replaceInFile('src/features/schedules/domain/builders/scheduleQuickTemplates.ts', /from '\.\.\/data'/g, "from '../../data'");
replaceInFile('src/features/schedules/domain/builders/scheduleQuickTemplates.ts', /from '\.\/scheduleFormState'/g, "from '../scheduleFormState'");
replaceInFile('src/features/schedules/domain/builders/scheduleQuickTemplates.ts', /from '\.\/schema'/g, "from '../schema'");

// index.ts
replaceInFile('src/features/schedules/domain/index.ts', /from '\.\/inlineScheduleDraft'/g, "from './builders/inlineScheduleDraft'");
replaceInFile('src/features/schedules/domain/index.ts', /from '\.\/userStatus'/g, "from './mappers/userStatus'");
replaceInFile('src/features/schedules/domain/index.ts', /from '\.\/categoryLabels'/g, "from './mappers/categoryLabels'");
replaceInFile('src/features/schedules/domain/index.ts', /from '\.\/scheduleNextGap'/g, "from './validation/scheduleNextGap'");
replaceInFile('src/features/schedules/domain/index.ts', /from '\.\/scheduleAutofillRules'/g, "from './validation/scheduleAutofillRules'");
replaceInFile('src/features/schedules/domain/index.ts', /from '\.\/scheduleQuickTemplates'/g, "from './builders/scheduleQuickTemplates'");

// categoryLabels.ts
replaceInFile('src/features/schedules/domain/mappers/categoryLabels.ts', /from '\.\/types'/g, "from '../types'");

// userStatus.ts
replaceInFile('src/features/schedules/domain/mappers/userStatus.ts', /from '\.\.\/data\/port'/g, "from '../../data/port'");

// scheduleOps.ts
replaceInFile('src/features/schedules/domain/scheduleOps.ts', /from '\.\/userStatus'/g, "from './mappers/userStatus'");

// scheduleAutofillRules.ts
replaceInFile('src/features/schedules/domain/validation/scheduleAutofillRules.ts', /from '\.\.\/data'/g, "from '../../data'");
replaceInFile('src/features/schedules/domain/validation/scheduleAutofillRules.ts', /from '\.\/scheduleFormState'/g, "from '../scheduleFormState'");
replaceInFile('src/features/schedules/domain/validation/scheduleAutofillRules.ts', /from '\.\/scheduleQuickTemplates'/g, "from '../builders/scheduleQuickTemplates'");

// scheduleNextGap.ts
replaceInFile('src/features/schedules/domain/validation/scheduleNextGap.ts', /from '\.\/scheduleQuickTemplates'/g, "from '../builders/scheduleQuickTemplates'");

