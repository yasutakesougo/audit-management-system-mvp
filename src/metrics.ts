import { onCLS, onFID, onINP, onLCP, onTTFB } from 'web-vitals';

type Metric = {
	name: string;
	value: number;
	id: string;
	delta: number;
	entries: PerformanceEntry[];
};

const entries: Array<Pick<Metric, 'name' | 'value'>> = [];

const isCI = typeof process !== 'undefined' && process.env?.CI === 'true';
const isBrowser = typeof window !== 'undefined';

const persistEntries = () => {
	if (!isCI || isBrowser) return;
	void import('node:fs')
		.then((fsModule) => {
			const fs = fsModule.default ?? fsModule;
			const payload = JSON.stringify({ entries }, null, 2);
			fs.writeFileSync('web-vitals.json', payload);
		})
		.catch(() => {
			// ignore file system issues in CI SSR contexts
		});
};

const handleMetric = (metric: Metric) => {
	entries.push({ name: metric.name, value: metric.value });
	console.log('[web-vitals]', metric.name, metric.value, metric.id);
	persistEntries();
};

[onLCP, onINP, onFID, onTTFB, onCLS].forEach((register) => register(handleMetric));
