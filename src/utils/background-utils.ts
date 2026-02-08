export type BackgroundType = "image" | "video";

export type BackgroundOption = {
	src: string;
	type: BackgroundType;
	label?: string;
};

const BASE_URL = import.meta.env.BASE_URL || "/";

function withBasePath(path: string): string {
	if (!path.startsWith("/")) {
		return path;
	}
	const normalizedBase = BASE_URL.endsWith("/")
		? BASE_URL.slice(0, -1)
		: BASE_URL;
	return `${normalizedBase}${path}` || path;
}

export const BACKGROUND_OPTIONS: BackgroundOption[] = [
	{ src: withBasePath("/background/1.webp"), type: "image" },
	{ src: withBasePath("/background/2.webp"), type: "image" },
	{ src: withBasePath("/background/3.webp"), type: "image" },
	{ src: withBasePath("/background/4.webp"), type: "image" },
	{ src: withBasePath("/background/5.webp"), type: "image" },
	{ src: withBasePath("/background/rain.mp4"), type: "video" },
];

export function normalizeBackgroundIndex(index: number): number {
	const count = BACKGROUND_OPTIONS.length;
	if (count === 0) {
		return 0;
	}
	return ((index % count) + count) % count;
}

export function clampBackgroundIndex(index: number): number {
	const count = BACKGROUND_OPTIONS.length;
	if (count === 0) {
		return 0;
	}
	return Math.min(count - 1, Math.max(0, index));
}

export function getBackgroundOption(index: number): BackgroundOption | null {
	if (BACKGROUND_OPTIONS.length === 0) {
		return null;
	}
	const clamped = clampBackgroundIndex(index);
	return BACKGROUND_OPTIONS[clamped] ?? null;
}
