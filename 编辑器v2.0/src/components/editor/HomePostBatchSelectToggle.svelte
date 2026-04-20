<script lang="ts">
import {
	type DevHomeBulkDeleteState,
	subscribeDevHomeBulkDeleteState,
	toggleDevHomeBulkDeleteId,
} from "@utils/dev-home-bulk-delete";
import { getDeveloperModeEnabled } from "@utils/setting-utils";
import { onMount } from "svelte";

export let postId = "";
export let title = "";

let developerModeEnabled = false;
let selectionMode = false;
let checked = false;

function refreshDeveloperMode() {
	developerModeEnabled = getDeveloperModeEnabled();
}

function handleStateChange(state: DevHomeBulkDeleteState) {
	selectionMode = state.selectionMode;
	checked = state.selectedIds.includes(postId);
}

function toggleChecked() {
	if (!postId) return;
	toggleDevHomeBulkDeleteId(postId);
}

onMount(() => {
	refreshDeveloperMode();
	const unsubscribe = subscribeDevHomeBulkDeleteState(handleStateChange);
	const handleDeveloperModeChange = () => {
		refreshDeveloperMode();
	};
	const handleFocus = () => {
		refreshDeveloperMode();
	};
	const handleVisibility = () => {
		if (!document.hidden) {
			refreshDeveloperMode();
		}
	};

	window.addEventListener("developer-mode-change", handleDeveloperModeChange);
	window.addEventListener("focus", handleFocus);
	document.addEventListener("visibilitychange", handleVisibility);

	return () => {
		unsubscribe();
		window.removeEventListener(
			"developer-mode-change",
			handleDeveloperModeChange,
		);
		window.removeEventListener("focus", handleFocus);
		document.removeEventListener("visibilitychange", handleVisibility);
	};
});
</script>

{#if developerModeEnabled && selectionMode}
	<label class="post-select-toggle" on:click|stopPropagation>
		<input
			type="checkbox"
			checked={checked}
			aria-label={`选择文章 ${title || postId}`}
			on:change={toggleChecked}
		/>
	</label>
{/if}

<style lang="stylus">
.post-select-toggle
  position absolute
  top 0.95rem
  right 0.95rem
  z-index 40
  display inline-flex
  align-items center
  justify-content center
  width 2rem
  height 2rem
  border 1px solid rgba(255, 255, 255, 0.16)
  border-radius 999px
  background rgba(15, 23, 42, 0.72)
  backdrop-filter blur(10px)
  box-shadow 0 12px 28px -18px rgba(15, 23, 42, 0.56)
  cursor pointer

  input
    width 1rem
    height 1rem
    accent-color var(--primary)
    cursor pointer
</style>
