<script lang="ts">
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import Icon from "@iconify/svelte";
import { 
    getDefaultHue, 
    getHue, 
    setHue,
    getBackgroundDisabled,
    setBackgroundDisabled,
    getRainbowMode,
    setRainbowMode,
    getBackgroundBlur,
    setBackgroundBlur
} from "@utils/setting-utils";

let hue = getHue();
const defaultHue = getDefaultHue();
let backgroundDisabled = getBackgroundDisabled();
let rainbowMode = getRainbowMode();
let backgroundBlur = getBackgroundBlur();

function resetHue() {
	hue = getDefaultHue();
}

$: if (hue || hue === 0) {
	setHue(hue);
}

$: setBackgroundDisabled(backgroundDisabled);
$: setRainbowMode(rainbowMode);
$: setBackgroundBlur(backgroundBlur);

// Update background blur slider fill effect
let backgroundBlurSlider: HTMLInputElement;
$: if (backgroundBlurSlider) {
    // Calculate percentage value (0-20 range)
    const percentage = (backgroundBlur / 20) * 100;
    backgroundBlurSlider.style.setProperty('--slider-value', `${percentage}%`);
}
</script>

<div id="display-setting" class="float-panel float-panel-closed absolute transition-all w-80 right-4 px-4 py-4">
    <!-- Theme Color -->
    <div class="mb-4" class:opacity-50={rainbowMode} class:pointer-events-none={rainbowMode}>
        <div class="flex flex-row gap-2 mb-3 items-center justify-between">
            <div class="flex gap-2 font-bold text-lg text-neutral-900 dark:text-neutral-100 transition relative ml-3
                before:w-1 before:h-4 before:rounded-md before:bg-[var(--primary)]
                before:absolute before:-left-3 before:top-[0.33rem]"
            >
                {i18n(I18nKey.themeColor)}
                <button aria-label="Reset to Default" class="btn-regular w-7 h-7 rounded-md  active:scale-90 will-change-transform"
                        class:opacity-0={hue === defaultHue} class:pointer-events-none={hue === defaultHue} on:click={resetHue}>
                    <div class="text-[var(--btn-content)]">
                        <Icon icon="fa6-solid:arrow-rotate-left" class="text-[0.875rem]"></Icon>
                    </div>
                </button>
            </div>
            <div class="flex gap-1">
                <div id="hueValue" class="transition bg-[var(--btn-regular-bg)] w-10 h-7 rounded-md flex justify-center
                font-bold text-sm items-center text-[var(--btn-content)]">
                    {rainbowMode ? '🌈' : hue}
                </div>
            </div>
        </div>
        <div class="w-full h-6 select-none">
            <input aria-label={i18n(I18nKey.themeColor)} type="range" min="0" max="360" bind:value={hue}
                   class="slider" id="colorSlider" step="5" style="width: 100%">
        </div>
    </div>

    <!-- Disable Background -->
    <div class="mb-4">
        <div class="flex flex-row gap-2 items-center justify-between mb-3">
            <div class="font-bold text-lg text-neutral-900 dark:text-neutral-100 transition relative ml-3
                before:w-1 before:h-4 before:rounded-md before:bg-[var(--primary)]
                before:absolute before:-left-3 before:top-[0.33rem]">
                禁用背景
            </div>
            <button class="relative inline-flex h-7 w-12 items-center rounded-full bg-[var(--btn-regular-bg)] transition-colors duration-200 ease-in-out"
                    class:bg-[var(--primary)]={backgroundDisabled}
                    on:click={() => backgroundDisabled = !backgroundDisabled}>
                <span class="inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 ease-in-out"
                      class:translate-x-5={backgroundDisabled}></span>
            </button>
        </div>
    </div>

    <!-- Rainbow Mode -->
    <div class="mb-4">
        <div class="flex flex-row gap-2 items-center justify-between mb-3">
            <div class="font-bold text-lg text-neutral-900 dark:text-neutral-100 transition relative ml-3
                before:w-1 before:h-4 before:rounded-md before:bg-[var(--primary)]
                before:absolute before:-left-3 before:top-[0.33rem]">
                彩虹模式
            </div>
            <button class="relative inline-flex h-7 w-12 items-center rounded-full bg-[var(--btn-regular-bg)] transition-colors duration-200 ease-in-out"
                    class:bg-[var(--primary)]={rainbowMode}
                    on:click={() => rainbowMode = !rainbowMode}>
                <span class="inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 ease-in-out"
                      class:translate-x-5={rainbowMode}></span>
            </button>
        </div>
    </div>

    <!-- Background Blur -->
    <div class="mb-4">
        <div class="flex flex-row gap-2 mb-3 items-center justify-between">
            <div class="font-bold text-lg text-neutral-900 dark:text-neutral-100 transition relative ml-3
                before:w-1 before:h-4 before:rounded-md before:bg-[var(--primary)]
                before:absolute before:-left-3 before:top-[0.33rem]">
                背景模糊
            </div>
            <div class="transition bg-[var(--btn-regular-bg)] w-12 h-7 rounded-md flex justify-center
            font-bold text-sm items-center text-[var(--btn-content)]">
                {backgroundBlur}px
            </div>
        </div>
        <div class="w-full h-6 select-none">
            <input type="range" min="0" max="20" bind:value={backgroundBlur}
                   class="slider" step="1" style="width: 100%"
                   bind:this={backgroundBlurSlider}>
        </div>
    </div>
</div>


<style lang="stylus">
    #display-setting
      /* Theme color slider (fixed rainbow gradient with solid background) */
      input[type="range"][id="colorSlider"]
        -webkit-appearance none
        height 100%
        /* Remove default margin and padding */
        margin 0
        padding 0
        /* Use fixed rainbow gradient for slider background */
        background-image linear-gradient(to right, oklch(0.70 0.14 0), oklch(0.70 0.14 30), oklch(0.70 0.14 60), oklch(0.70 0.14 90), oklch(0.70 0.14 120), oklch(0.70 0.14 150), oklch(0.70 0.14 180), oklch(0.70 0.14 210), oklch(0.70 0.14 240), oklch(0.70 0.14 270), oklch(0.70 0.14 300), oklch(0.70 0.14 330), oklch(0.70 0.14 360))
        /* Add small rounded corners, matching the second image */
        border-radius 0.125rem
        /* Remove transition to prevent animation when hue changes */
        transition none
        /* Reset all border styles */
        border none
        outline none
        box-shadow none

      /* Background blur slider (theme color fill effect) */
      input[type="range"]:not([id="colorSlider"])
        -webkit-appearance none
        height 100%
        background-image linear-gradient(to right, var(--primary) var(--slider-value, 0%), #374151 var(--slider-value, 0%))
        /* Add small rounded corners, matching the second image */
        border-radius 0.125rem
        transition background-image 0.15s ease-in-out
        /* Reset all border styles */
        border none
        outline none
        box-shadow none

      /* Hide thumb for all sliders by default */
      input[type="range"]
        &::-webkit-slider-thumb
          -webkit-appearance none
          height 0
          width 0
          background transparent
          border none
          box-shadow none

        &::-moz-range-thumb
          -webkit-appearance none
          height 0
          width 0
          background transparent
          border none
          box-shadow none

        &::-ms-thumb
          -webkit-appearance none
          height 0
          width 0
          background transparent
          border none
          box-shadow none

      /* Only restore thumb for theme color slider */
      input[type="range"][id="colorSlider"]
        /* Adjust slider track height and appearance */
        &::-webkit-slider-runnable-track
          height 0.5rem
          border-radius 0.125rem
          background-image linear-gradient(to right, oklch(0.70 0.14 0), oklch(0.70 0.14 30), oklch(0.70 0.14 60), oklch(0.70 0.14 90), oklch(0.70 0.14 120), oklch(0.70 0.14 150), oklch(0.70 0.14 180), oklch(0.70 0.14 210), oklch(0.70 0.14 240), oklch(0.70 0.14 270), oklch(0.70 0.14 300), oklch(0.70 0.14 330), oklch(0.70 0.14 360))
        
        &::-moz-range-track
          height 0.5rem
          border-radius 0.125rem
          background-image linear-gradient(to right, oklch(0.70 0.14 0), oklch(0.70 0.14 30), oklch(0.70 0.14 60), oklch(0.70 0.14 90), oklch(0.70 0.14 120), oklch(0.70 0.14 150), oklch(0.70 0.14 180), oklch(0.70 0.14 210), oklch(0.70 0.14 240), oklch(0.70 0.14 270), oklch(0.70 0.14 300), oklch(0.70 0.14 330), oklch(0.70 0.14 360))
        
        &::-ms-track
          height 0.5rem
          border-radius 0.125rem
          background-image linear-gradient(to right, oklch(0.70 0.14 0), oklch(0.70 0.14 30), oklch(0.70 0.14 60), oklch(0.70 0.14 90), oklch(0.70 0.14 120), oklch(0.70 0.14 150), oklch(0.70 0.14 180), oklch(0.70 0.14 210), oklch(0.70 0.14 240), oklch(0.70 0.14 270), oklch(0.70 0.14 300), oklch(0.70 0.14 330), oklch(0.70 0.14 360))
          color transparent
        
        /* Theme color slider thumb */
        &::-webkit-slider-thumb
          -webkit-appearance none
          /* Adjust size to match the second image */
          height 1rem
          width 0.5rem
          /* Add small rounded corners matching the second image */
          border-radius 0.125rem
          background rgba(255, 255, 255, 0.7)
          box-shadow none
          /* Center thumb vertically on track */
          margin-top -0.25rem
          &:hover
            background rgba(255, 255, 255, 0.8)
          &:active
            background rgba(255, 255, 255, 0.6)

        &::-moz-range-thumb
          -webkit-appearance none
          height 1rem
          width 0.5rem
          border-radius 0.125rem
          border-width 0
          background rgba(255, 255, 255, 0.7)
          box-shadow none
          &:hover
            background rgba(255, 255, 255, 0.8)
          &:active
            background rgba(255, 255, 255, 0.6)

        &::-ms-thumb
          -webkit-appearance none
          height 1rem
          width 0.5rem
          border-radius 0.125rem
          background rgba(255, 255, 255, 0.7)
          box-shadow none
          /* Center thumb vertically on track for IE */
          margin-top 0
          &:hover
            background rgba(255, 255, 255, 0.8)
          &:active
            background rgba(255, 255, 255, 0.6)

      /* Background blur slider track styles */
      input[type="range"]:not([id="colorSlider"])
        /* Adjust slider track height and appearance */
        &::-webkit-slider-runnable-track
          height 0.5rem
          border-radius 0.125rem
          background-image linear-gradient(to right, var(--primary) var(--slider-value, 0%), #374151 var(--slider-value, 0%))
        
        &::-moz-range-track
          height 0.5rem
          border-radius 0.125rem
          background-image linear-gradient(to right, var(--primary) var(--slider-value, 0%), #374151 var(--slider-value, 0%))
        
        &::-ms-track
          height 0.5rem
          border-radius 0.125rem
          background-image linear-gradient(to right, var(--primary) var(--slider-value, 0%), #374151 var(--slider-value, 0%))
          color transparent

</style>
