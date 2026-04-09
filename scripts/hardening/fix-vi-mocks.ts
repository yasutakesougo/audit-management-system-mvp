import { Project, SyntaxKind, StringLiteral } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';

const project = new Project({ tsConfigFilePath: 'tsconfig.json' });
const dailyRoot = path.join(process.cwd(), 'src/features/daily').replace(/\\/g, '/');

// Mapping of OLD absolute paths (without src) to NEW absolute paths
const _oldToNewPaths: Record<string, string> = {
  // e.g. 'src/features/daily/hooks/useTableDailyRecordForm': 'src/features/daily/hooks/view-models/useTableDailyRecordForm'
};

// We know what moved because we can extract the move rules again, or just rely on what is CURRENTLY present and find the missing old ones.
// The easiest is: any relative path that no longer exists, see if there is a file in daily that matches the basename, and just use that new path!
// Since daily file basenames are mostly unique, this is very robust.

const allCurrentFiles = project.getSourceFiles().map(f => f.getFilePath());
const basenameToNewPath = new Map<string, string>();

for (const f of allCurrentFiles) {
  if (f.startsWith(dailyRoot)) {
    const ext = path.extname(f);
    const basename = path.basename(f, ext);
    basenameToNewPath.set(basename, f);
  }
}

let patchedCount = 0;

for (const file of project.getSourceFiles()) {
  const filePath = file.getFilePath();
  if (!filePath.includes('/__tests__/') && !filePath.endsWith('.spec.ts') && !filePath.endsWith('.test.ts') && !filePath.endsWith('.spec.tsx')) {
    continue;
  }

  let fileChanged = false;

  const calls = file.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const call of calls) {
    const expr = call.getExpression().getText();
    if (expr === 'vi.mock' || expr === 'vi.doMock' || expr === 'jest.mock') {
      const args = call.getArguments();
      if (args.length > 0 && args[0].getKind() === SyntaxKind.StringLiteral) {
        const strLiteral = args[0] as StringLiteral;
        const mockPath = strLiteral.getLiteralText();
        
        // If it's a relative path inside features/daily
        if (mockPath.startsWith('.')) {
          const absMockedPath = path.resolve(path.dirname(filePath), mockPath).replace(/\\/g, '/');
          
          // Does the original path exist? If yes, nothing to fix.
          if (fs.existsSync(absMockedPath + '.ts') || fs.existsSync(absMockedPath + '.tsx')) {
            continue;
          }
          
          // Path doesn't exist! Let's find its new home by basename
          const basename = path.basename(mockPath);
          const newAbsPath = basenameToNewPath.get(basename);
          
          if (newAbsPath) {
            // Convert new absolute path to alias '@/... '
            // e.g. C:/Users/安武/.vscode/workspace/audit-management-system/src/features/daily/...
            const srcIndex = newAbsPath.indexOf('/src/');
            if (srcIndex !== -1) {
              const aliasPath = '@/' + newAbsPath.substring(srcIndex + 5).replace(/\.tsx?$/, '');
              strLiteral.setLiteralValue(aliasPath);
              fileChanged = true;
              console.log(`Fixed mock in ${path.basename(filePath)}: ${mockPath} -> ${aliasPath}`);
            }
          }
        } else if (mockPath.startsWith('@/features/daily/')) {
           // Also check if an absolute alias mock is broken
           const absMockedPath = path.join(process.cwd(), 'src', mockPath.substring(2)).replace(/\\/g, '/');
           if (!fs.existsSync(absMockedPath + '.ts') && !fs.existsSync(absMockedPath + '.tsx')) {
              const basename = path.basename(mockPath);
              const newAbsPath = basenameToNewPath.get(basename);
              if (newAbsPath) {
                 const srcIndex = newAbsPath.indexOf('/src/');
                 if (srcIndex !== -1) {
                   const aliasPath = '@/' + newAbsPath.substring(srcIndex + 5).replace(/\.tsx?$/, '');
                   strLiteral.setLiteralValue(aliasPath);
                   fileChanged = true;
                   console.log(`Fixed alias mock in ${path.basename(filePath)}: ${mockPath} -> ${aliasPath}`);
                 }
              }
           }
        }
      }
    }
  }

  if (fileChanged) {
    patchedCount++;
  }
}

async function run() {
  if (patchedCount > 0) {
    console.log(`Saving ${patchedCount} files with fixed mocks...`);
    await project.save();
    console.log('Done!');
  } else {
    console.log('No broken mocks found.');
  }
}

run();
