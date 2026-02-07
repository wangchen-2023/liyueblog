export type BackgroundType = "image" | "video";

export type BackgroundOption = {
	src: string;
	type: BackgroundType;
	label?: string;
};

export const BACKGROUND_OPTIONS: BackgroundOption[] = [
	{ src: "/background/1.webp", type: "image" },
	{ src: "/background/2.webp", type: "image" },
	{ src: "/background/3.webp", type: "image" },
	{ src: "/background/4.webp", type: "image" },
	{ src: "/background/5.webp", type: "image" },
	{ src: "/background/rain.mp4", type: "video" },
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
