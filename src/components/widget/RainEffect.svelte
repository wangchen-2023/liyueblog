<script lang="ts">
import {
	getRainConfig,
	getRainMode,
	type RainConfig,
} from "@utils/setting-utils";
import { onMount } from "svelte";

let config: RainConfig = getRainConfig();
type RenderProfile = {
	maxDpr: number;
	countScale: number;
	speedScale: number;
	useSimpleStroke: boolean;
};
let profile: RenderProfile = {
	maxDpr: 2,
	countScale: 1,
	speedScale: 1,
	useSimpleStroke: false,
};
let runtimeConfig: RainConfig = config;

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let width = 0;
let height = 0;
let dpr = 1;
let spawnMinX = 0;
let spawnMaxX = 0;
let recycleY = 0;
let recycleXPadding = 0;
let particles: RainDrop[] = [];
let animationFrame: number | null = null;
let enabled = false;

class RainDrop {
	x = 0;
	y = 0;
	vMult = 1;
	opacity = 0.5;

	constructor() {
		this.init(true);
	}

	init(isFirstTime = false) {
		this.x = spawnMinX + Math.random() * (spawnMaxX - spawnMinX);
		this.y = isFirstTime
			? Math.random() * (height + runtimeConfig.length * 2) -
				runtimeConfig.length * 2
			: -runtimeConfig.length * 4;
		this.vMult = Math.random() * 0.4 + 0.8;
		this.opacity = Math.random() * 0.4 + 0.2;
	}

	draw(target: CanvasRenderingContext2D) {
		const currentLen = runtimeConfig.length * this.vMult;
		if (profile.useSimpleStroke) {
			target.strokeStyle = `rgba(255, 255, 255, ${this.opacity})`;
		} else {
			const grad = target.createLinearGradient(
				this.x,
				this.y,
				this.x + currentLen * runtimeConfig.angle,
				this.y + currentLen,
			);
			grad.addColorStop(0, "rgba(255, 255, 255, 0)");
			grad.addColorStop(1, `rgba(255, 255, 255, ${this.opacity})`);
			target.strokeStyle = grad;
		}
		target.beginPath();
		target.lineWidth = runtimeConfig.width;
		target.lineCap = "round";
		target.moveTo(this.x, this.y);
		target.lineTo(
			this.x + currentLen * runtimeConfig.angle,
			this.y + currentLen,
		);
		target.stroke();
	}

	update() {
		this.y += runtimeConfig.speed * this.vMult;
		this.x += runtimeConfig.speed * this.vMult * runtimeConfig.angle;

		if (
			this.y > recycleY ||
			this.x < spawnMinX - recycleXPadding ||
			this.x > spawnMaxX + recycleXPadding
		) {
			this.init(false);
		}
	}
}

function getRenderProfile(): RenderProfile {
	if (typeof window === "undefined") {
		return {
			maxDpr: 2,
			countScale: 1,
			speedScale: 1,
			useSimpleStroke: false,
		};
	}
	const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
	const reducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)",
	).matches;
	const cpuCores =
		typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 8 : 8;
	const memory =
		typeof navigator !== "undefined"
			? (
					navigator as Navigator & {
						deviceMemory?: number;
					}
				).deviceMemory || 8
			: 8;
	// Check if rainbow mode is enabled
	const rainbowModeEnabled =
		document.documentElement.classList.contains("rainbow-mode");
	const lowPower =
		reducedMotion || coarsePointer || cpuCores <= 4 || memory <= 4;

	// If rainbow mode is enabled, use more conservative settings but preserve speed
	if (lowPower || rainbowModeEnabled) {
		return {
			maxDpr: 1.5,
			countScale: rainbowModeEnabled ? 0.6 : 0.45,
			speedScale: rainbowModeEnabled ? 1 : 0.9, // Preserve speed for rainbow mode
			useSimpleStroke: rainbowModeEnabled || lowPower,
		};
	}
	return {
		maxDpr: 2,
		countScale: 1,
		speedScale: 1,
		useSimpleStroke: false,
	};
}

function updateRuntimeConfig() {
	const count = Math.max(10, Math.round(config.count * profile.countScale));
	const speed = Math.max(3, Math.round(config.speed * profile.speedScale));
	// Preserve the original width to avoid rainbow mode affecting rain thickness
	const width = config.width;
	runtimeConfig = {
		...config,
		count,
		speed,
		width, // Explicitly set width to preserve original value
	};
	if (width > 0 && height > 0) {
		updateSpawnBounds();
	}
}

function updateSpawnBounds() {
	const horizontalDrift =
		(height + runtimeConfig.length * 6) * Math.abs(runtimeConfig.angle);
	const padding = runtimeConfig.length * 3 + runtimeConfig.speed * 4;
	spawnMinX = -horizontalDrift - padding;
	spawnMaxX = width + horizontalDrift + padding;
	recycleY = height + runtimeConfig.length * 2;
	recycleXPadding = padding;
}

function resizeCanvas() {
	if (!canvas || !ctx) return;
	width = window.innerWidth;
	height = window.innerHeight;
	dpr = Math.min(window.devicePixelRatio || 1, profile.maxDpr);
	canvas.width = Math.floor(width * dpr);
	canvas.height = Math.floor(height * dpr);
	canvas.style.width = `${width}px`;
	canvas.style.height = `${height}px`;
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	updateSpawnBounds();
}

function setupParticles() {
	particles = [];
	for (let i = 0; i < runtimeConfig.count; i += 1) {
		particles.push(new RainDrop());
	}
}

function clearCanvas() {
	if (!ctx) return;
	ctx.clearRect(0, 0, width, height);
}

function animate() {
	if (!ctx || !enabled) return;
	ctx.clearRect(0, 0, width, height);
	for (const p of particles) {
		p.update();
		p.draw(ctx);
	}
	animationFrame = window.requestAnimationFrame(animate);
}

function start() {
	if (enabled) return;
	enabled = true;
	config = getRainConfig();
	profile = getRenderProfile();
	updateRuntimeConfig();
	resizeCanvas();
	setupParticles();
	animationFrame = window.requestAnimationFrame(animate);
}

function stop() {
	if (!enabled) return;
	enabled = false;
	if (animationFrame !== null) {
		window.cancelAnimationFrame(animationFrame);
		animationFrame = null;
	}
	clearCanvas();
}

function setEnabled(next: boolean) {
	if (next) {
		start();
	} else {
		stop();
	}
}

function handleModeEvent(event: Event) {
	const next = (event as CustomEvent<boolean>).detail;
	setEnabled(next);
}

function handleConfigEvent(event: Event) {
	const next = (event as CustomEvent<RainConfig>).detail;
	const countChanged = next.count !== config.count;
	const geometryChanged =
		next.angle !== config.angle ||
		next.length !== config.length ||
		next.speed !== config.speed;
	config = next;
	updateRuntimeConfig();
	if (enabled && (countChanged || geometryChanged)) {
		setupParticles();
	}
}

function handleResize() {
	if (!enabled) return;
	profile = getRenderProfile();
	updateRuntimeConfig();
	resizeCanvas();
	setupParticles();
}

function handleRainbowModeChange() {
	if (!enabled) return;
	// Update render profile based on new rainbow mode status
	profile = getRenderProfile();
	updateRuntimeConfig();
	setupParticles();
}

onMount(() => {
	if (!canvas) return;
	ctx = canvas.getContext("2d");
	if (!ctx) return;
	setEnabled(getRainMode());
	window.addEventListener("rain-mode-change", handleModeEvent as EventListener);
	window.addEventListener(
		"rain-config-change",
		handleConfigEvent as EventListener,
	);
	window.addEventListener("resize", handleResize);
	window.addEventListener(
		"rainbow-mode-change",
		handleRainbowModeChange as EventListener,
	);
	return () => {
		stop();
		window.removeEventListener(
			"rain-mode-change",
			handleModeEvent as EventListener,
		);
		window.removeEventListener(
			"rain-config-change",
			handleConfigEvent as EventListener,
		);
		window.removeEventListener("resize", handleResize);
		window.removeEventListener(
			"rainbow-mode-change",
			handleRainbowModeChange as EventListener,
		);
	};
});
</script>

<canvas
	bind:this={canvas}
	class="rain-effect-canvas"
	class:active={enabled}
	aria-hidden="true"
></canvas>

<style>
	:global(.rain-effect-canvas) {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		opacity: 0;
		transition: opacity 200ms ease-out;
		z-index: -1;
	}

	:global(.rain-effect-canvas.active) {
		opacity: 1;
	}
</style>
