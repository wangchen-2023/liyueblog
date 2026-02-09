<script lang="ts">
import { onDestroy, onMount } from "svelte";
import { cubicOut } from "svelte/easing";
import { fade } from "svelte/transition";

let isEnabled = true;
let isDragging = false;
let startX = 0;
let startY = 0;
let offsetX = 0;
let offsetY = 0;
let showDragAnimation = false;
let dragAnimationOffset = { x: 0, y: 0 };
let currentDeviceKey = "";

// 触摸事件相关变量 - 用于检测双击
let lastTapTime = 0;
const DOUBLE_TAP_THRESHOLD = 300;

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

// 检查是否是移动设备
function isMobileDevice() {
	return typeof window !== "undefined" && window.innerWidth <= 768;
}

// 获取设备类型的存储键
function getDeviceStorageKey() {
	const deviceKey = isMobileDevice() ? "mobile" : "desktop";
	currentDeviceKey = deviceKey;
	return deviceKey;
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

// 从localStorage加载位置
function loadLanternPosition() {
	if (isLocalStorageAvailable()) {
		const deviceKey = getDeviceStorageKey();
		const savedPosition = localStorage.getItem(`lanternPosition_${deviceKey}`);
		if (savedPosition !== null) {
			try {
				const position = JSON.parse(savedPosition);
				offsetX = position.x || 0;
				offsetY = position.y || 0;
			} catch {
				// 解析失败，使用默认值
				offsetX = 0;
				offsetY = 0;
			}
		}
	}
}

// 保存位置到localStorage
function saveLanternPosition() {
	if (isLocalStorageAvailable()) {
		const deviceKey = getDeviceStorageKey();
		localStorage.setItem(
			`lanternPosition_${deviceKey}`,
			JSON.stringify({ x: offsetX, y: offsetY }),
		);
	}
}

// 切换灯笼状态
function toggleLantern() {
	isEnabled = !isEnabled;
	saveLanternState();
}

// 开始拖动
function startDrag(event: MouseEvent | TouchEvent) {
	// 检测双击事件
	if (event instanceof TouchEvent) {
		const currentTime = Date.now();
		const tapLength = currentTime - lastTapTime;

		// 检查是否是双击（时间间隔小于阈值）
		if (tapLength < DOUBLE_TAP_THRESHOLD && tapLength > 0) {
			// 触发双击处理
			handleDoubleClick();
			// 阻止默认行为，防止拖动
			event.preventDefault();
			return;
		}

		// 记录本次点击时间
		lastTapTime = currentTime;
	}

	isDragging = true;

	// 隐藏拖动动画
	showDragAnimation = false;

	// 计算初始位置
	if (event instanceof MouseEvent) {
		startX = event.clientX - offsetX;
		startY = event.clientY - offsetY;
		// 阻止默认行为，提高拖动灵敏度
		event.preventDefault();
	} else {
		startX = event.touches[0].clientX - offsetX;
		startY = event.touches[0].clientY - offsetY;
		// 阻止默认行为，防止页面滚动
		event.preventDefault();
	}
}

// 拖动中
function drag(event: MouseEvent | TouchEvent) {
	if (!isDragging) return;

	// 阻止默认行为，防止页面滚动
	if (event instanceof MouseEvent) {
		event.preventDefault();
		offsetX = event.clientX - startX;
		offsetY = event.clientY - startY;
	} else {
		event.preventDefault();
		offsetX = event.touches[0].clientX - startX;
		offsetY = event.touches[0].clientY - startY;
	}
}

// 添加触摸事件处理，防止页面滚动
function preventScroll(event: TouchEvent) {
	if (isDragging) {
		event.preventDefault();
	}
}

// 结束拖动
function endDrag() {
	isDragging = false;
	saveLanternPosition();
}

// 双击事件处理 - 重置按钮位置并打开灯笼
function handleDoubleClick() {
	// 打开灯笼
	isEnabled = true;
	saveLanternState();

	// 实现回弹动画效果
	// 1. 先稍微超过目标位置
	const bounceOffsetX = -5;
	const bounceOffsetY = -5;

	// 2. 快速设置到回弹位置
	offsetX = bounceOffsetX;
	offsetY = bounceOffsetY;

	// 3. 强制浏览器重排
	void (document.querySelector(".lantern-toggle-container") as HTMLElement)
		?.offsetWidth;

	// 4. 动画回到准确位置
	setTimeout(() => {
		offsetX = 0;
		offsetY = 0;
		saveLanternPosition();
	}, 50);
}

// 处理窗口大小变化
function handleResize() {
	// 检查设备类型是否发生变化
	const newDeviceKey = isMobileDevice() ? "mobile" : "desktop";
	if (newDeviceKey !== currentDeviceKey) {
		// 设备类型发生变化，重新加载对应设备的位置
		currentDeviceKey = newDeviceKey;
		loadLanternPosition();
	}
}

// 组件挂载时加载状态
onMount(() => {
	loadLanternState();
	// 初始化设备类型
	currentDeviceKey = getDeviceStorageKey();
	loadLanternPosition();

	// 添加窗口大小变化监听
	window.addEventListener("resize", handleResize);

	// 检查是否是第一次打开网页
	function isFirstVisit() {
		// 暂时总是返回true，方便测试动画
		return true;
		/*
		if (!isLocalStorageAvailable()) return true;
		const hasVisited = localStorage.getItem("lanternAnimationShown");
		return !hasVisited;
		*/
	}

	// 标记动画已显示
	function markAnimationShown() {
		// 暂时注释掉，方便测试动画
		/*
		if (isLocalStorageAvailable()) {
			localStorage.setItem("lanternAnimationShown", "true");
		}
		*/
	}

	// 在所有设备上显示拖动动画（方便测试）
	if (isFirstVisit()) {
		showDragAnimation = true;

		// 开始拖动动画 - 只左右移动，先快后慢
		const directions = [
			{ x: 10, y: 0 },
			{ x: -10, y: 0 },
		];
		let currentDirection = 0;
		let animationCount = 0;
		const maxAnimations = 6; // 动画次数
		let currentSpeed = 100; // 初始动画速度（毫秒）
		const speedIncrease = 25; // 每次动画增加的速度（毫秒）

		// 使用递归函数实现可变速度的动画
		function animate() {
			if (showDragAnimation && animationCount < maxAnimations) {
				dragAnimationOffset = directions[currentDirection];
				currentDirection = (currentDirection + 1) % directions.length;
				animationCount++;

				// 增加动画间隔，实现先快后慢的效果
				currentSpeed += speedIncrease;

				// 安排下一次动画
				setTimeout(animate, currentSpeed);
			} else {
				// 停止动画，恢复原位置
				dragAnimationOffset = { x: 0, y: 0 };
				showDragAnimation = false;
				markAnimationShown();
			}
		}

		// 开始动画
		animate();

		// 添加全局鼠标事件监听
		window.addEventListener("mousemove", drag);
		window.addEventListener("mouseup", endDrag);
		window.addEventListener("mouseleave", endDrag);
		window.addEventListener("touchmove", preventScroll, { passive: false });
		window.addEventListener("touchmove", drag, { passive: false });
		window.addEventListener("touchend", endDrag);

		return () => {
			window.removeEventListener("mousemove", drag);
			window.removeEventListener("mouseup", endDrag);
			window.removeEventListener("mouseleave", endDrag);
			window.removeEventListener("touchmove", preventScroll);
			window.removeEventListener("touchmove", drag);
			window.removeEventListener("touchend", endDrag);
			window.removeEventListener("resize", handleResize);
		};
	}
	// 在桌面设备上添加全局鼠标事件监听
	window.addEventListener("mousemove", drag);
	window.addEventListener("mouseup", endDrag);
	window.addEventListener("mouseleave", endDrag);
	window.addEventListener("touchmove", preventScroll, { passive: false });
	window.addEventListener("touchmove", drag, { passive: false });
	window.addEventListener("touchend", endDrag);

	return () => {
		window.removeEventListener("mousemove", drag);
		window.removeEventListener("mouseup", endDrag);
		window.removeEventListener("mouseleave", endDrag);
		window.removeEventListener("touchmove", preventScroll);
		window.removeEventListener("touchmove", drag);
		window.removeEventListener("touchend", endDrag);
		window.removeEventListener("resize", handleResize);
	};
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
	<div 
		class="lantern-toggle-container"
		onmousedown={startDrag}
		ontouchstart={startDrag}
		ondblclick={handleDoubleClick}
		style={`transform: translate(${offsetX + (showDragAnimation ? dragAnimationOffset.x : 0)}px, ${offsetY + (showDragAnimation ? dragAnimationOffset.y : 0)}px); cursor: ${isDragging ? 'grabbing' : 'grab'}`}
		tabindex="0"
		role="button"
		aria-label="拖拽灯笼控制开关，双击重置位置并打开灯笼"
	>
		<button 
			class="lantern-toggle" 
			onclick={toggleLantern}
			aria-label={isEnabled ? '关闭灯笼' : '打开灯笼'}
		>
			{isEnabled ? '🧨 关闭灯笼' : '🏮 打开灯笼'}
		</button>
	</div>
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
		bottom: 10px;
		right: 10px;
		z-index: 10000;
		pointer-events: auto;
	}
	
	.lantern-toggle-container {
		position: relative;
		transition: transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
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
		user-select: none;
	}
	
	.lantern-toggle:hover {
		background-color: rgba(255, 202, 40, 1);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}
	
	.lantern-toggle:active {
		transform: translateY(0);
	}
	
	/* 拖动动画效果 */
	.lantern-toggle-container {
		transition: transform 0.1s ease-out;
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
			bottom: 6px;
			right: 6px;
		}

		.lantern-toggle {
			padding: 10px 18px;
			font-size: 14px;
			border-radius: 20px;
		}
	}
</style>
