const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'src');

const mappings = {
  'scheduleNextGap': 'validation/scheduleNextGap',
  'scheduleAutofillRules': 'validation/scheduleAutofillRules',
  'categoryLabels': 'mappers/categoryLabels',
  'userStatus': 'mappers/userStatus',
  'scheduleQuickTemplates': 'builders/scheduleQuickTemplates',
  'inlineScheduleDraft': 'builders/inlineScheduleDraft'
};

function walkSync(currentDirPath, callback) {
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
    // Check if the import path ends with any of our mappings
    for (const [oldName, newName] of Object.entries(mappings)) {
      if (importPath.endsWith(`domain/${oldName}`) || importPath.endsWith(`domain/${oldName}.js`) || importPath.endsWith(`domain/${oldName}.ts`)) {
        changed = true;
        // Replace the last occurrence of oldName with newName
        const newImportPath = importPath.replace(new RegExp(`domain/${oldName}$`), `domain/${newName}`);
        return `from '${newImportPath}'`;
      } else if (importPath.includes(oldName) && !importPath.includes(newName)) {
         // for relative paths directly from inside domain or same dir
         if (filePath.includes('domain') && importPath.endsWith(`/${oldName}`)) {
            // inside domain, e.g. from './scheduleNextGap'
            // Need to be careful. If we are in validation/, we might need '../validation/'? No, we just use regex to fix all.
         }
      }
    }
    return match;
  });

  // A bit more robust string replacement for any occurrences
  for (const [oldName, newName] of Object.entries(mappings)) {
    // replace `domain/oldName`
    const regex1 = new RegExp(`domain/${oldName}(['"])`, 'g');
    if (regex1.test(newContent)) {
       newContent = newContent.replace(regex1, `domain/${newName}$1`);
       changed = true;
    }
    
    // For local imports within domain (e.g. from './userStatus')
    const regex2 = new RegExp(`['"]\\.\\/${oldName}(['"])`, 'g');
    if (filePath.includes('src\\features\\schedules\\domain') && regex2.test(newContent)) {
       // Just general fallback: replacing `./oldName` with `../mappers/oldName` or similar if needed.
       // Actually it's easier to just do it via tsc errors later if these fail.
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated ${filePath}`);
  }
});
