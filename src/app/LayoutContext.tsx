import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type DisplayMode = 'sceneA' | 'hybrid' | 'sceneB';
export type LayoutDensity = 'spacious' | 'standard' | 'compact';

type LayoutState = {
	/** 画面幅に基づく表示モード（sceneA: ≤768px, hybrid: 768-1200px, sceneB: ≥1200px） */
	displayMode: DisplayMode;
	/** UI密度（sceneA→spacious, hybrid→standard, sceneB→compact, またはforceDensityで上書き） */
	density: LayoutDensity;
	/** ビューポート幅 */
	width: number;
	/** ビューポート高さ */
	height: number;
	/** 縦向きかどうか（height >= width） */
	isPortrait: boolean;
	/** 横向きかどうか（width > height） */
	isLandscape: boolean;
};

type LayoutProviderProps = {
	children: React.ReactNode;
	/** 画面幅からの自動判定を上書き（ユーザー設定で使える） */
	forceDensity?: LayoutDensity;
	/** ブレークポイントを差し替えたい場合 */
	breakpoints?: Partial<{ sceneA: number; sceneB: number }>;
};

const defaultBreakpoints = { sceneA: 768, sceneB: 1200 } as const;

const defaultViewport = { width: 1024, height: 768 };
const defaultState: LayoutState = {
	displayMode: 'hybrid',
	density: 'standard',
	...defaultViewport,
	isPortrait: defaultViewport.height >= defaultViewport.width,
	isLandscape: defaultViewport.width > defaultViewport.height,
};

function readViewport() {
	if (typeof window === 'undefined') return defaultViewport;
	return {
		width: window.visualViewport?.width ?? window.innerWidth,
		height: window.visualViewport?.height ?? window.innerHeight,
	};
}

function classifyDisplayMode(width: number, bp: { sceneA: number; sceneB: number }): DisplayMode {
	if (width <= bp.sceneA) return 'sceneA';
	if (width >= bp.sceneB) return 'sceneB';
	return 'hybrid';
}

function resolveDensity(displayMode: DisplayMode): LayoutDensity {
	if (displayMode === 'sceneA') return 'spacious';
	if (displayMode === 'sceneB') return 'compact';
	return 'standard';
}

function computeState(
	width: number,
	height: number,
	bp: { sceneA: number; sceneB: number },
	force?: LayoutDensity,
): LayoutState {
	const displayMode = classifyDisplayMode(width, bp);
	const autoDensity = resolveDensity(displayMode);
	const density = force ?? autoDensity;
	const isPortrait = height >= width;
	const isLandscape = width > height;
	return { displayMode, density, width, height, isPortrait, isLandscape };
}

function safeEquals(a: LayoutState, b: LayoutState) {
	return (
		a.displayMode === b.displayMode &&
		a.density === b.density &&
		a.width === b.width &&
		a.height === b.height &&
		a.isPortrait === b.isPortrait &&
		a.isLandscape === b.isLandscape
	);
}

export const LayoutContext = createContext<LayoutState>(defaultState);

export const LayoutProvider: React.FC<LayoutProviderProps> = ({ children, forceDensity, breakpoints }) => {
	const bp = useMemo(
		() => ({ sceneA: breakpoints?.sceneA ?? defaultBreakpoints.sceneA, sceneB: breakpoints?.sceneB ?? defaultBreakpoints.sceneB }),
		[breakpoints],
	);

	const [state, setState] = useState<LayoutState>(() => {
		const { width, height } = readViewport();
		return computeState(width, height, bp, forceDensity);
	});

	const rafId = useRef<number>(0);

	useEffect(() => {
		if (typeof window === 'undefined') return;

		const update = () => {
			cancelAnimationFrame(rafId.current);
			rafId.current = requestAnimationFrame(() => {
				const { width, height } = readViewport();
				setState(prev => {
					const next = computeState(width, height, bp, forceDensity);
					return safeEquals(prev, next) ? prev : next;
				});
			});
		};

		update();

		const onResize = () => update();
		const onOrientation = () => update();

		window.addEventListener('resize', onResize, { passive: true });
		window.addEventListener('orientationchange', onOrientation, { passive: true });
		const vv = window.visualViewport;
		vv?.addEventListener('resize', onResize, { passive: true });
		vv?.addEventListener('scroll', onResize, { passive: true });

		return () => {
			cancelAnimationFrame(rafId.current);
			window.removeEventListener('resize', onResize);
			window.removeEventListener('orientationchange', onOrientation);
			vv?.removeEventListener('resize', onResize);
			vv?.removeEventListener('scroll', onResize);
		};
	}, [bp, forceDensity]);

	return <LayoutContext.Provider value={state}>{children}</LayoutContext.Provider>;
};

export function useLayout() {
	return useContext(LayoutContext);
}

export function useDisplayMode() {
	return useLayout().displayMode;
}

export function useDisplayFlags() {
	const displayMode = useDisplayMode();
	return {
		displayMode,
		isSceneA: displayMode === 'sceneA',
		isSceneB: displayMode === 'sceneB',
		isHybrid: displayMode === 'hybrid',
	};
}

export function useDensity() {
	return useLayout().density;
}

export function useDensityFlags() {
	const density = useDensity();
	return {
		density,
		isSpacious: density === 'spacious',
		isStandard: density === 'standard',
		isCompact: density === 'compact',
	};
}

export function useViewport() {
	const { width, height } = useLayout();
	return { width, height };
}

export function useOrientation() {
	const { isPortrait, isLandscape } = useLayout();
	return { isPortrait, isLandscape };
}

/**
 * 現在の幅がブレークポイント基準でどの範囲にあるかを判定
 */
export function useBreakpointFlags() {
	const { width } = useLayout();
	return {
		width,
		isXs: width <= layoutBreakpoints.sceneA,
		isSm: width > layoutBreakpoints.sceneA && width < layoutBreakpoints.sceneB,
		isLg: width >= layoutBreakpoints.sceneB,
		isMobileSize: width <= layoutBreakpoints.sceneA,
		isTabletSize: width > layoutBreakpoints.sceneA && width < layoutBreakpoints.sceneB,
		isDesktopSize: width >= layoutBreakpoints.sceneB,
	};
}

export const layoutBreakpoints = Object.freeze({ sceneA: defaultBreakpoints.sceneA, sceneB: defaultBreakpoints.sceneB });
