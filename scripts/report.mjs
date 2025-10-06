import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = 'reports';
const LHCI_JSON = 'lhci-results.json';
const WEBVITALS_JSON = 'web-vitals.json';
const SUMMARY_MD = 'perf-summary.md';
const SUMMARY_JSON = 'perf-summary.json';

const readJsonSafe = (filePath) => {
	try {
		return JSON.parse(fs.readFileSync(filePath, 'utf8'));
	} catch (error) {
		if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
			console.warn(`[report] failed to parse ${filePath}:`, error);
		}
		return null;
	}
};

const toScore = (category) =>
	category != null && typeof category.score === 'number'
		? Math.round(category.score * 100)
		: null;

const extractLighthouse = (lhResults) => {
	const results = Array.isArray(lhResults)
		? lhResults.filter((entry) => entry && entry.lhr && entry.lhr.categories)
		: [];
	if (!results.length) {
		return { score: {}, urls: [] };
	}
	const first = results[0];
	const categories = first.lhr.categories ?? {};
	return {
		score: {
			performance: toScore(categories.performance),
			accessibility: toScore(categories.accessibility),
			bestPractices: toScore(categories['best-practices']),
			seo: toScore(categories.seo),
			pwa: toScore(categories.pwa),
		},
		urls: results.map((entry) => entry.url).filter(Boolean),
	};
};

const average = (values) => {
	if (!values?.length) return null;
	const total = values.reduce((sum, value) => sum + value, 0);
	return Math.round(total / values.length);
};

const averageFloat = (values) => {
	if (!values?.length) return null;
	const total = values.reduce((sum, value) => sum + value, 0);
	return Number((total / values.length).toFixed(3));
};

const extractWebVitals = (webVitals) => {
	if (!webVitals) {
		return { FID: null, INP: null, LCP: null, CLS: null, TTFB: null, samples: 0 };
	}
	const entries = Array.isArray(webVitals?.entries)
		? webVitals.entries
		: Array.isArray(webVitals)
			? webVitals
			: [];
	const grouped = new Map();
	for (const entry of entries) {
		if (!entry || typeof entry.name !== 'string') continue;
		const list = grouped.get(entry.name) ?? [];
		grouped.set(entry.name, list);
		const value = Number(entry.value);
		if (!Number.isNaN(value)) {
			list.push(value);
		}
	}
	return {
		FID: average(grouped.get('FID')),
		INP: average(grouped.get('INP')),
		LCP: average(grouped.get('LCP')),
		CLS: averageFloat(grouped.get('CLS')),
		TTFB: average(grouped.get('TTFB')),
		samples: entries.length,
	};
};

fs.mkdirSync(OUT_DIR, { recursive: true });

let lighthouseResults = readJsonSafe(LHCI_JSON);
if (Array.isArray(lighthouseResults)) {
	lighthouseResults = lighthouseResults.filter((entry) => entry && entry.lhr && entry.lhr.categories);
}
if (Array.isArray(lighthouseResults) && lighthouseResults.length) {
	fs.writeFileSync(LHCI_JSON, JSON.stringify(lighthouseResults, null, 2));
}
const hasValidLighthouse = Array.isArray(lighthouseResults) && lighthouseResults.length > 0;

if (!hasValidLighthouse) {
	const lhciDir = '.lighthouseci';
	try {
		const files = fs.readdirSync(lhciDir).filter((file) => file.endsWith('.json'));
		const collected = files
			.map((file) => readJsonSafe(path.join(lhciDir, file)))
			.filter((entry) => entry && typeof entry === 'object')
			.map((entry) => ({
				url: entry.requestedUrl ?? entry.finalUrl ?? null,
				lhr: entry,
			}))
			.filter((entry) => entry.lhr && entry.lhr.categories);
		if (collected.length) {
			lighthouseResults = collected;
			fs.writeFileSync(LHCI_JSON, JSON.stringify(collected, null, 2));
		}
	} catch (error) {
		if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
			console.warn('[report] unable to hydrate from .lighthouseci', error);
		}
	}
}
const webVitalsResults = readJsonSafe(WEBVITALS_JSON);

const lighthouse = extractLighthouse(lighthouseResults);
const webVitals = extractWebVitals(webVitalsResults);

const summary = {
	generatedAt: new Date().toISOString(),
	lighthouse,
	webVitals,
};

const summaryJsonPath = path.join(OUT_DIR, SUMMARY_JSON);
fs.writeFileSync(summaryJsonPath, JSON.stringify(summary, null, 2));

const summaryMarkdown = `# パフォーマンス・サマリ

**生成:** ${summary.generatedAt}

## Lighthouse
- Performance: **${lighthouse.score.performance ?? '—'}**
- Accessibility: ${lighthouse.score.accessibility ?? '—'}
- Best Practices: ${lighthouse.score.bestPractices ?? '—'}
- SEO: ${lighthouse.score.seo ?? '—'}
- PWA: ${lighthouse.score.pwa ?? '—'}
- URLs: ${lighthouse.urls.join(', ') || '—'}

## Web Vitals（任意）
- LCP: ${webVitals.LCP ?? '—'} ms
- INP: ${webVitals.INP ?? '—'} ms
- FID: ${webVitals.FID ?? '—'} ms
- TTFB: ${webVitals.TTFB ?? '—'} ms
- CLS: ${webVitals.CLS ?? '—'}
- Samples: ${webVitals.samples}
`;

const summaryMarkdownPath = path.join(OUT_DIR, SUMMARY_MD);
fs.writeFileSync(summaryMarkdownPath, summaryMarkdown);

console.log(`Wrote ${OUT_DIR}/${SUMMARY_MD} and ${OUT_DIR}/${SUMMARY_JSON}`);
