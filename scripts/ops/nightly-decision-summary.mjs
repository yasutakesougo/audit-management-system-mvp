import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Error: Please provide decision json file path.');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
console.log(`- verdict: **${data.final?.line ?? 'n/a'}**`);
if (Array.isArray(data.reasons?.fail) && data.reasons.fail.length > 0) {
  console.log(`- failTriggers: ${data.reasons.fail.length}`);
} else {
  console.log('- failTriggers: 0');
}
if (Array.isArray(data.reasons?.warn) && data.reasons.warn.length > 0) {
  console.log(`- watchTriggers: ${data.reasons.warn.length}`);
} else {
  console.log('- watchTriggers: 0');
}
if (Array.isArray(data.reasonCodes?.fail) && data.reasonCodes.fail.length > 0) {
  console.log(`- failCodes: \`${data.reasonCodes.fail.join(', ')}\``);
}
if (Array.isArray(data.reasonCodes?.warn) && data.reasonCodes.warn.length > 0) {
  console.log(`- watchCodes: \`${data.reasonCodes.warn.join(', ')}\``);
}
if (Array.isArray(data.escalations) && data.escalations.length > 0) {
  const rows = data.escalations.map((x) => {
    const type = x?.type || 'unknown';
    const days = Number.isFinite(x?.days) ? x.days : 'n/a';
    const code = x?.code || 'n/a';
    return `${type}:${code} (${days}d)`;
  });
  console.log(`- escalations: \`${rows.join(', ')}\``);
}
