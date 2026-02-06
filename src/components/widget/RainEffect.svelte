<script lang="ts">
	import { onMount } from "svelte";
	import { getRainConfig, getRainMode, type RainConfig } from "@utils/setting-utils";

	let config: RainConfig = getRainConfig();

	let canvas: HTMLCanvasElement | null = null;
	let ctx: CanvasRenderingContext2D | null = null;
	let width = 0;
	let height = 0;
	let dpr = 1;
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
			const spread = Math.abs(width * config.angle);
			this.x = Math.random() * (width + spread * 2) - spread;
			this.y = isFirstTime ? Math.random() * height : -config.length * 4;
			this.vMult = Math.random() * 0.4 + 0.8;
			this.opacity = Math.random() * 0.4 + 0.2;
		}

		draw(target: CanvasRenderingContext2D) {
			const currentLen = config.length * this.vMult;
			const grad = target.createLinearGradient(
				this.x,
				this.y,
				this.x + currentLen * config.angle,
				this.y + currentLen,
			);
			grad.addColorStop(0, "rgba(255, 255, 255, 0)");
			grad.addColorStop(1, `rgba(255, 255, 255, ${this.opacity})`);

			target.beginPath();
			target.strokeStyle = grad;
			target.lineWidth = config.width;
			target.lineCap = "round";
			target.moveTo(this.x, this.y);
			target.lineTo(this.x + currentLen * config.angle, this.y + currentLen);
			target.stroke();
		}

		update() {
			this.y += config.speed * this.vMult;
			this.x += config.speed * this.vMult * config.angle;

			if (this.y > height + 50) {
				this.init(false);
			}
		}
	}

	function resizeCanvas() {
		if (!canvas || !ctx) return;
		width = window.innerWidth;
		height = window.innerHeight;
		dpr = window.devicePixelRatio || 1;
		canvas.width = Math.floor(width * dpr);
		canvas.height = Math.floor(height * dpr);
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	function setupParticles() {
		particles = [];
		for (let i = 0; i < config.count; i += 1) {
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
		config = next;
		if (enabled && countChanged) {
			setupParticles();
		}
	}

	function handleResize() {
		if (!enabled) return;
		resizeCanvas();
		setupParticles();
	}

	onMount(() => {
		if (!canvas) return;
		ctx = canvas.getContext("2d");
		if (!ctx) return;
		setEnabled(getRainMode());
		window.addEventListener("rain-mode-change", handleModeEvent as EventListener);
		window.addEventListener("rain-config-change", handleConfigEvent as EventListener);
		window.addEventListener("resize", handleResize);
		return () => {
			stop();
			window.removeEventListener("rain-mode-change", handleModeEvent as EventListener);
			window.removeEventListener("rain-config-change", handleConfigEvent as EventListener);
			window.removeEventListener("resize", handleResize);
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
