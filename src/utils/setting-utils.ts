import {
	AUTO_MODE,
	DARK_MODE,
	DEFAULT_THEME,
	LIGHT_MODE,
} from "@constants/constants.ts";
import { expressiveCodeConfig } from "@/config";
import type { LIGHT_DARK_MODE } from "@/types/config";

export function getDefaultHue(): number {
	const fallback = "250";
	const configCarrier = document.getElementById("config-carrier");
	return Number.parseInt(configCarrier?.dataset.hue || fallback, 10);
}

export function getHue(): number {
	const stored = localStorage.getItem("hue");
	return stored ? Number.parseInt(stored, 10) : getDefaultHue();
}

export function setHue(hue: number): void {
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

export function setTheme(theme: LIGHT_DARK_MODE): void {
	localStorage.setItem("theme", theme);
	applyThemeToDocument(theme);
}

export function getStoredTheme(): LIGHT_DARK_MODE {
	return (localStorage.getItem("theme") as LIGHT_DARK_MODE) || DEFAULT_THEME;
}

// Background settings
export function getBackgroundDisabled(): boolean {
	// Default to false if not set, so background is enabled on startup
	return localStorage.getItem("backgroundDisabled") === "true";
}

export function setBackgroundDisabled(disabled: boolean): void {
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
}

// Rainbow mode settings
let rainbowInterval: number | null = null;
let currentHue = 0;

export function getRainbowMode(): boolean {
	return localStorage.getItem("rainbowMode") === "true";
}

export function setRainbowMode(enabled: boolean): void {
	localStorage.setItem("rainbowMode", String(enabled));
	const root = document.querySelector(":root") as HTMLElement;
	if (!root) return;
	
	root.classList.toggle("rainbow-mode", enabled);
	
	// Clear any existing interval
	if (rainbowInterval) {
		clearInterval(rainbowInterval);
		rainbowInterval = null;
	}
	
	if (enabled) {
		// Start rainbow effect with JavaScript
		currentHue = parseInt(root.style.getPropertyValue("--hue")) || 0;
		rainbowInterval = window.setInterval(() => {
			currentHue = (currentHue + 1) % 360;
			root.style.setProperty("--hue", String(currentHue));
		}, 30); // Update every 30ms for smooth effect
	} else {
		// Restore the original hue from localStorage
		const hue = getHue();
		root.style.setProperty("--hue", String(hue));
	}
}

// Background blur settings
export function getBackgroundBlur(): number {
	const stored = localStorage.getItem("backgroundBlur");
	return stored ? Number.parseInt(stored, 10) : 8;
}

export function setBackgroundBlur(blur: number): void {
	localStorage.setItem("backgroundBlur", String(blur));
	const r = document.querySelector(":root") as HTMLElement;
	if (r) {
		r.style.setProperty("--background-blur", `${blur}px`);
	}
}
