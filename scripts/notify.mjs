import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { URL } from 'node:url';

const parseArgs = (argv) => {
	const options = {
		onlyOnFail: false,
		title: '',
		files: [],
	};
	const messageParts = [];
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		switch (arg) {
			case '--only-on-fail':
				options.onlyOnFail = true;
				break;
			case '--title':
				options.title = argv[index + 1] ?? '';
				index += 1;
				break;
			case '--files':
				{
					const filesArg = argv[index + 1];
					if (typeof filesArg === 'string') {
						options.files.push(...filesArg.split(',').map((entry) => entry.trim()).filter(Boolean));
					}
					index += 1;
				}
				break;
			default:
				if (arg.startsWith('--')) {
					// ignore unknown flag
					break;
				}
				messageParts.push(arg);
		}
	}
	return { options, message: messageParts.join(' ') };
};

const url = process.env.NOTIFY_WEBHOOK_URL;

if (!url) {
	console.log('[notify] NOTIFY_WEBHOOK_URL not set. Skip.');
	process.exit(0);
}

const { options, message } = parseArgs(process.argv.slice(2));

const lastExitCode = Number.parseInt(process.env.NOTIFY_LAST_EXIT_CODE ?? '', 10);
if (options.onlyOnFail && (Number.isNaN(lastExitCode) || lastExitCode === 0)) {
	console.log('[notify] skip: only-on-fail and no failure detected');
	process.exit(0);
}

const sections = [];

if (options.title) {
	sections.push(options.title);
}

if (message) {
	sections.push(message);
}

for (const file of options.files) {
	try {
		const resolved = path.resolve(file);
		const content = fs.readFileSync(resolved, 'utf8');
		const maxLength = 3500;
		const trimmed = content.length > maxLength ? `${content.slice(0, maxLength)}\n…` : content;
		sections.push(`--- ${file} ---\n${trimmed}`);
	} catch (error) {
		sections.push(`--- ${file} ---\n(read error: ${error.message ?? error})`);
	}
}

const text = sections.join('\n\n').trim() || 'No message';
const payload = JSON.stringify({ text });

const { hostname, pathname, search, protocol } = new URL(url);

if (protocol !== 'https:') {
	console.error('[notify] Only HTTPS webhooks are supported.');
	process.exit(1);
}

const request = https.request(
	{
		hostname,
		path: `${pathname}${search}`,
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Content-Length': Buffer.byteLength(payload),
		},
	},
	(res) => {
		console.log(`[notify] status ${res.statusCode}`);
	}
);

request.on('error', (error) => {
	console.error('[notify] error', error);
});

request.write(payload);
request.end();
