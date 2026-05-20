import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Error: Please provide index pressure json file path.');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const results = data.results || [];
const critical = results.filter(r => ['action_required', 'critical'].includes(r.severity));
console.log(`- totalFindings: **${results.length}**`);
console.log(`- actionRequired: **${critical.length}**`);
if (critical.length > 0) {
  console.log('\n| List | Field | Severity |');
  console.log('|------|-------|:---:|');
  critical.forEach(r => {
    const sev = r.severity === 'critical' ? '🔴' : '🟠';
    console.log(`| ${r.listKey} | ${r.fieldName} | ${sev} ${r.severity} |`);
  });
} else if (results.length > 0) {
  console.log('\n✅ No action required (all findings are low severity)');
} else {
  console.log('\n✅ No index pressure detected');
}
