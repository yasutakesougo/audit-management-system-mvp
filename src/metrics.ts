import { onCLS, onFID, onINP, onLCP, onTTFB } from 'web-vitals';

type Metric = {
	name: string;
	value: number;
	id: string;
	delta: number;
	entries: PerformanceEntry[];
};

const entries: Array<Pick<Metric, 'name' | 'value' | 'delta'>> = [];

const isCI = typeof process !== 'undefined' && process.env?.CI === 'true';
const isBrowser = typeof window !== 'undefined';

const persistEntries = () => {
	// 🔧 ロジック明確化：CI環境かつNode実行時のみファイル出力
	const shouldWrite = isCI && !isBrowser;
	if (!shouldWrite) return;

	void import('node:fs')
		.then((fsModule) => {
			// 🔧 Node.js ESM/CJS 互換性対応
			const fs = fsModule.default ?? fsModule;
			const payload = JSON.stringify({ entries }, null, 2);
			fs.writeFileSync('web-vitals.json', payload);
		})
		.catch(() => {
			// ignore file system issues in CI SSR contexts
		});
};

const handleMetric = (metric: Metric) => {
	// 🔧 メモリ効率化：最新結果で上書き（CI環境での肥大化回避）
	const existingIndex = entries.findIndex(entry => entry.name === metric.name);
	const metricEntry = {
		name: metric.name,
		value: metric.value,
		delta: metric.delta
	};

	if (existingIndex >= 0) {
		entries[existingIndex] = metricEntry;
	} else {
		entries.push(metricEntry);
	}

	if (import.meta.env.DEV) {
		console.log('[web-vitals]', metric.name, metric.value, metric.id, `(δ${metric.delta})`);
	}
	persistEntries();
};

// 🚀 web-vitals v3 対応：配列化で将来の metrics 追加に対応
const metricsCollectors = [onLCP, onINP, onFID, onTTFB, onCLS];
metricsCollectors.forEach((register) => register(handleMetric));
