<script lang="ts">
import { onMount } from "svelte";
import { cubicOut } from "svelte/easing";
import { fade } from "svelte/transition";

let isEnabled = true;

// 检查localStorage是否可用
function isLocalStorageAvailable() {
	try {
		return (
			typeof window !== "undefined" &&
			typeof window.localStorage !== "undefined"
		);
	} catch {
		return false;
	}
}

// 从localStorage加载状态
function loadLanternState() {
	if (isLocalStorageAvailable()) {
		const savedState = localStorage.getItem("lanternEnabled");
		if (savedState !== null) {
			isEnabled = savedState === "true";
		}
	}
}

// 保存状态到localStorage
function saveLanternState() {
	if (isLocalStorageAvailable()) {
		localStorage.setItem("lanternEnabled", isEnabled.toString());
	}
}

// 切换灯笼状态
function toggleLantern() {
	isEnabled = !isEnabled;
	saveLanternState();
}

// 组件挂载时加载状态
onMount(() => {
	loadLanternState();
});
</script>

{#if isEnabled}
	<div
		class="lantern-container"
		transition:fade={{ duration: 350, easing: cubicOut }}
	>
		<div class="lantern-item pos-1">
			<div class="lantern-line"></div>
			<div class="lantern-body">
				<div class="lantern-cap cap-top"></div>
				<div class="lantern-body-inner"></div>
				<span class="lantern-text">新</span>
				<div class="lantern-cap cap-bottom"></div>
			</div>
			<div class="lantern-tassel"></div>
		</div>

		<div class="lantern-item pos-2">
			<div class="lantern-line"></div>
			<div class="lantern-body">
				<div class="lantern-cap cap-top"></div>
				<div class="lantern-body-inner"></div>
				<span class="lantern-text">年</span>
				<div class="lantern-cap cap-bottom"></div>
			</div>
			<div class="lantern-tassel"></div>
		</div>

		<div class="lantern-item pos-3">
			<div class="lantern-line"></div>
			<div class="lantern-body">
				<div class="lantern-cap cap-top"></div>
				<div class="lantern-body-inner"></div>
				<span class="lantern-text">快</span>
				<div class="lantern-cap cap-bottom"></div>
			</div>
			<div class="lantern-tassel"></div>
		</div>

		<div class="lantern-item pos-4">
			<div class="lantern-line"></div>
			<div class="lantern-body">
				<div class="lantern-cap cap-top"></div>
				<div class="lantern-body-inner"></div>
				<span class="lantern-text">乐</span>
				<div class="lantern-cap cap-bottom"></div>
			</div>
			<div class="lantern-tassel"></div>
		</div>
	</div>
{/if}

<!-- 控制开关 -->
<div class="lantern-control">
	<button 
		class="lantern-toggle" 
		onclick={toggleLantern}
		aria-label={isEnabled ? '关闭灯笼' : '打开灯笼'}
	>
		{isEnabled ? '🧨 关闭灯笼' : '🏮 打开灯笼'}
	</button>
</div>

<style lang="css">
	/* 容器定位 */
	.lantern-container {
		position: fixed;
		top: -20px; /* 向上微调，露出挂绳 */
		width: 100%;
		display: flex;
		justify-content: space-between;
		padding: 0 50px;
		box-sizing: border-box;
		z-index: 9999;
		pointer-events: none;
	}

	.lantern-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		animation: swing 3.5s infinite ease-in-out;
		transform-origin: top center;
	}

	/* 顶部吊绳 */
	.lantern-line {
		width: 3px;
		height: 50px;
		background-color: #dc8f03;
	}

	/* 灯笼主体：调整为更圆润的扁椭圆 */
	.lantern-body {
		width: 120px;
		height: 95px;
		background: #d32f2f; /* 更深一点的红 */
		border-radius: 50% / 45%;
		position: relative;
		/* 核心修改：多重阴影实现图片中的红色外发光效果 */
		box-shadow: 0 0 50px 15px rgba(255, 69, 0, 0.4);
		display: flex;
		justify-content: center;
		align-items: center;
		border: 2px solid #ffca28;
	}

	/* 灯笼纵向纹理：改为弧形 */
	.lantern-body::before {
		content: "";
		position: absolute;
		width: 70px;
		height: 100%;
		border-left: 2px solid #ffca28;
		border-right: 2px solid #ffca28;
		border-radius: 50%;
		opacity: 0.5;
	}

	/* 灯笼中间纵向纹理 */
	.lantern-body-inner {
		position: absolute;
		width: 30px;
		height: 100%;
		border-left: 2px solid #ffca28;
		border-right: 2px solid #ffca28;
		border-radius: 50%;
		opacity: 0.5;
	}

	/* 灯笼上下盖子 */
	.lantern-cap {
		width: 50px;
		height: 8px;
		background: #ffca28;
		border-radius: 4px;
		position: absolute;
		z-index: 10;
	}
	.cap-top { top: -4px; }
	.cap-bottom { bottom: -4px; }

	/* 文字样式：优化了字体族和光效 */
	.lantern-text {
		color: #ffca28;
		/* 优先使用华文行楷，其次是楷体，最后是通用的 serif 衬线体 */
		font-family: "STXingkai", "华文行楷", "KaiTi", "楷体", "STKaiti", "华文楷体", serif;
		font-size: 42px; /* 略微调大一点，更有视觉冲击力 */
		font-weight: bold;
		line-height: 1;
		text-align: center;
		/* 金色文字的微弱外发光，模拟灯火照亮文字的效果 */
		text-shadow:
			0 0 10px rgba(255, 202, 40, 0.8),
			1px 1px 3px rgba(0, 0, 0, 0.5);
		z-index: 20;
		user-select: none;
	}

	/* 底部流苏：加长并优化细节 */
	.lantern-tassel {
		width: 6px;
		height: 40px;
		background: #ffca28;
		position: relative;
		margin-top: 5px;
		border-radius: 0 0 3px 3px;
	}

	/* 摇摆动画 */
	@keyframes swing {
		0% { transform: rotate(-5deg); }
		50% { transform: rotate(5deg); }
		100% { transform: rotate(-5deg); }
	}

	/* 个别位置微调 */
	.pos-1 { margin-top: 10px; }
	.pos-2 { margin-top: 40px; }
	.pos-3 { margin-top: 40px; }
	.pos-4 { margin-top: 10px; }
	
	/* 控制开关样式 */
	.lantern-control {
		position: fixed;
		top: 10px;
		right: 10px;
		z-index: 10000;
		pointer-events: auto;
	}
	
	.lantern-toggle {
		background-color: rgba(255, 202, 40, 0.9);
		color: #d32f2f;
		border: 2px solid #d32f2f;
		border-radius: 20px;
		padding: 8px 16px;
		font-size: 14px;
		font-weight: bold;
		cursor: pointer;
		transition: all 0.3s ease;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
	}
	
	.lantern-toggle:hover {
		background-color: rgba(255, 202, 40, 1);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}
	
	.lantern-toggle:active {
		transform: translateY(0);
	}

	/* Mobile only adjustments */
	@media (max-width: 768px) {
		.lantern-container {
			top: -10px;
			padding: 0 12px;
		}

		.lantern-item {
			animation-duration: 4.5s;
		}

		.lantern-line {
			width: 2px;
			height: 30px;
		}

		.lantern-body {
			width: 72px;
			height: 58px;
			box-shadow: 0 0 24px 8px rgba(255, 69, 0, 0.35);
			border-width: 1px;
		}

		.lantern-body::before {
			width: 40px;
			border-left-width: 1px;
			border-right-width: 1px;
		}

		.lantern-body-inner {
			width: 18px;
			border-left-width: 1px;
			border-right-width: 1px;
		}

		.lantern-cap {
			width: 34px;
			height: 6px;
			border-radius: 3px;
		}

		.lantern-text {
			font-size: 24px;
			text-shadow:
				0 0 6px rgba(255, 202, 40, 0.7),
				1px 1px 2px rgba(0, 0, 0, 0.45);
		}

		.lantern-tassel {
			width: 4px;
			height: 24px;
			margin-top: 4px;
		}

		.pos-2,
		.pos-3 {
			display: none;
		}

		.lantern-control {
			top: 6px;
			right: 6px;
		}

		.lantern-toggle {
			padding: 6px 12px;
			font-size: 12px;
			border-radius: 16px;
		}
	}
</style>
