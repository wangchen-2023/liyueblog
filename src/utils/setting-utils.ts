import {
	AUTO_MODE,
	DARK_MODE,
	DEFAULT_THEME,
	LIGHT_MODE,
} from "@constants/constants.ts";
import {
	BACKGROUND_OPTIONS,
	clampBackgroundIndex,
	normalizeBackgroundIndex,
} from "@utils/background-utils";
import { expressiveCodeConfig } from "@/config";
import type { LIGHT_DARK_MODE } from "@/types/config";

function canUseStorage(): boolean {
	return (
		typeof window !== "undefined" && typeof window.localStorage !== "undefined"
	);
}

export function getDefaultHue(): number {
	const fallback = "250";
	if (typeof document === "undefined") {
		return Number.parseInt(fallback, 10);
	}
	const configCarrier = document.getElementById("config-carrier");
	return Number.parseInt(configCarrier?.dataset.hue || fallback, 10);
}

export function getHue(): number {
	if (!canUseStorage()) {
		return getDefaultHue();
	}
	const stored = localStorage.getItem("hue");
	return stored ? Number.parseInt(stored, 10) : getDefaultHue();
}

export function setHue(hue: number): void {
	if (!canUseStorage()) {
		return;
	}
	localStorage.setItem("hue", String(hue));
	const r = document.querySelector(":root") as HTMLElement;
	if (!r) {
		return;
	}
	r.style.setProperty("--hue", String(hue));
}

export function applyThemeToDocument(theme: LIGHT_DARK_MODE) {
	switch (theme) {
		case LIGHT_MODE:
			document.documentElement.classList.remove("dark");
			break;
		case DARK_MODE:
			document.documentElement.classList.add("dark");
			break;
		case AUTO_MODE:
			if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
				document.documentElement.classList.add("dark");
			} else {
				document.documentElement.classList.remove("dark");
			}
			break;
	}

	// Set to theme for Expressive Code
	document.documentElement.setAttribute(
		"data-theme",
		expressiveCodeConfig.theme,
	);
}

function applyThemeWithoutTransitions(theme: LIGHT_DARK_MODE): void {
	const root = document.documentElement;
	root.classList.add("theme-switching");
	applyThemeToDocument(theme);
	window.requestAnimationFrame(() => {
		window.requestAnimationFrame(() => {
			root.classList.remove("theme-switching");
		});
	});
}

export function setTheme(theme: LIGHT_DARK_MODE): void {
	if (!canUseStorage()) {
		return;
	}
	localStorage.setItem("theme", theme);
	applyThemeWithoutTransitions(theme);
}

export function getStoredTheme(): LIGHT_DARK_MODE {
	if (!canUseStorage()) {
		return DEFAULT_THEME;
	}
	return (localStorage.getItem("theme") as LIGHT_DARK_MODE) || DEFAULT_THEME;
}

// Background settings
export function getBackgroundDisabled(): boolean {
	// Default to false if not set, so background is enabled on startup
	if (!canUseStorage()) {
		return false;
	}
	return localStorage.getItem("backgroundDisabled") === "true";
}

export function setBackgroundDisabled(disabled: boolean): void {
	if (!canUseStorage()) {
		return;
	}
	localStorage.setItem("backgroundDisabled", String(disabled));
	const r = document.querySelector(":root") as HTMLElement;
	if (r) {
		r.classList.toggle("background-disabled", disabled);
		if (!disabled) {
			// Add background-active class to trigger the fade-in transition
			setTimeout(() => {
				r.classList.add("background-active");
			}, 50);
		} else {
			// Remove background-active class to trigger the fade-out transition
			r.classList.remove("background-active");
		}
	}
	if (typeof window !== "undefined") {
		const videos =
			document.querySelectorAll<HTMLVideoElement>(".background-video");
		videos.forEach((video) => {
			if (disabled) {
				video.pause();
			} else {
				video.play().catch(() => {});
			}
		});
		window.dispatchEvent(
			new CustomEvent("background-disabled-change", {
				detail: { disabled },
			}),
		);
	}
}

// Rainbow mode settings
let rainbowInterval: number | null = null;
let currentHue = 0;
const UPDATE_INTERVAL = 45; // Reduce repaint pressure when rainbow mode is on.

export function getRainbowMode(): boolean {
	if (!canUseStorage()) {
		return false;
	}
	return localStorage.getItem("rainbowMode") === "true";
}

function updateRainbowHue(root: HTMLElement): void {
	currentHue = (currentHue + 1) % 360;
	root.style.setProperty("--hue", String(currentHue));
}

export function setRainbowMode(enabled: boolean): void {
	if (!canUseStorage()) {
		return;
	}
	localStorage.setItem("rainbowMode", String(enabled));
	const root = document.querySelector(":root") as HTMLElement;
	if (!root) return;

	root.classList.toggle("rainbow-mode", enabled);

	// Clear any existing rainbow timer.
	if (rainbowInterval !== null) {
		clearInterval(rainbowInterval);
		rainbowInterval = null;
	}

	if (enabled) {
		// Start rainbow effect using a fixed interval to avoid per-frame callbacks.
		currentHue =
			Number.parseInt(root.style.getPropertyValue("--hue"), 10) || getHue();
		updateRainbowHue(root);
		rainbowInterval = window.setInterval(
			() => updateRainbowHue(root),
			UPDATE_INTERVAL,
		);
	} else {
		// Restore the original hue from localStorage
		const hue = getHue();
		root.style.setProperty("--hue", String(hue));
	}

	// Dispatch event for rainbow mode change
	if (typeof window !== "undefined") {
		window.dispatchEvent(
			new CustomEvent("rainbow-mode-change", { detail: enabled }),
		);
	}
}

// Rain effect settings
export type RainConfig = {
	count: number;
	width: number;
	length: number;
	speed: number;
	angle: number;
};

const DEFAULT_RAIN_CONFIG: RainConfig = {
	count: 165,
	width: 2.9,
	length: 70,
	speed: 11,
	angle: -0.1,
};

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function sanitizeRainConfig(input?: Partial<RainConfig>): RainConfig {
	const merged = { ...DEFAULT_RAIN_CONFIG, ...(input || {}) };
	return {
		count: Math.round(clamp(Number(merged.count), 10, 1000)),
		width: clamp(Number(merged.width), 0.5, 5),
		length: Math.round(clamp(Number(merged.length), 5, 120)),
		speed: Math.round(clamp(Number(merged.speed), 5, 60)),
		angle: clamp(Number(merged.angle), -0.8, 0.8),
	};
}

export function getDefaultRainConfig(): RainConfig {
	return { ...DEFAULT_RAIN_CONFIG };
}

export function getRainConfig(): RainConfig {
	if (!canUseStorage()) {
		return getDefaultRainConfig();
	}
	const stored = localStorage.getItem("rainConfig");
	if (!stored) {
		return getDefaultRainConfig();
	}
	try {
		return sanitizeRainConfig(JSON.parse(stored));
	} catch {
		return getDefaultRainConfig();
	}
}

export function setRainConfig(config: RainConfig): void {
	if (!canUseStorage()) {
		return;
	}
	const next = sanitizeRainConfig(config);
	localStorage.setItem("rainConfig", JSON.stringify(next));
	if (typeof window !== "undefined") {
		window.dispatchEvent(
			new CustomEvent("rain-config-change", { detail: next }),
		);
	}
}

export function getRainMode(): boolean {
	if (!canUseStorage()) {
		return false;
	}
	return localStorage.getItem("rainMode") === "true";
}

export function setRainMode(enabled: boolean): void {
	if (!canUseStorage()) {
		return;
	}
	localStorage.setItem("rainMode", String(enabled));
	const root = document.querySelector(":root") as HTMLElement | null;
	if (root) {
		root.classList.toggle("rain-effect", enabled);
	}
	if (typeof window !== "undefined") {
		window.dispatchEvent(
			new CustomEvent("rain-mode-change", { detail: enabled }),
		);
	}
}

// Background blur settings
export function getBackgroundBlur(): number {
	if (!canUseStorage()) {
		return 8;
	}
	const stored = localStorage.getItem("backgroundBlur");
	return stored ? Number.parseInt(stored, 10) : 8;
}

export function setBackgroundBlur(blur: number): void {
	if (!canUseStorage()) {
		return;
	}
	localStorage.setItem("backgroundBlur", String(blur));
	const r = document.querySelector(":root") as HTMLElement;
	if (r) {
		r.style.setProperty("--background-blur", `${blur}px`);
	}
}

// Background image selection
const BACKGROUND_INDEX_KEY = "backgroundIndex";

export function getStoredBackgroundIndex(): number | null {
	if (!canUseStorage()) {
		return null;
	}
	const stored = localStorage.getItem(BACKGROUND_INDEX_KEY);
	if (!stored) {
		return null;
	}
	const parsed = Number.parseInt(stored, 10);
	if (Number.isNaN(parsed) || BACKGROUND_OPTIONS.length === 0) {
		return null;
	}
	return clampBackgroundIndex(parsed);
}

export function setBackgroundIndex(index: number): void {
	if (!canUseStorage() || BACKGROUND_OPTIONS.length === 0) {
		return;
	}
	const normalized = normalizeBackgroundIndex(index);
	localStorage.setItem(BACKGROUND_INDEX_KEY, String(normalized));
	if (typeof window !== "undefined") {
		window.dispatchEvent(
			new CustomEvent("background-selection-change", {
				detail: { index: normalized },
			}),
		);
	}
}
