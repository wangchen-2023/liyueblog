import randomSelection from "./utils.js";

const muteStorageKey = "waifu-muted";
let messageTimer;

function getTipsElement() {
    return document.getElementById("waifu-tips");
}

function clearMessageTimer() {
    if (messageTimer) {
        clearTimeout(messageTimer);
        messageTimer = null;
    }
}

function isWaifuMuted() {
    try {
        return localStorage.getItem(muteStorageKey) === "1";
    } catch (error) {
        console.warn("Failed to read waifu mute state.", error);
        return false;
    }
}

function hideMessage() {
    clearMessageTimer();
    sessionStorage.removeItem("waifu-text");
    const tips = getTipsElement();
    if (!tips) {
        return;
    }
    tips.classList.remove("waifu-tips-active");
}

function setWaifuMuted(muted) {
    const normalizedMuted = !!muted;
    try {
        localStorage.setItem(muteStorageKey, normalizedMuted ? "1" : "0");
    } catch (error) {
        console.warn("Failed to persist waifu mute state.", error);
    }

    if (normalizedMuted) {
        hideMessage();
    }
    window.dispatchEvent(new CustomEvent("waifu:mutechange", {
        detail: {
            muted: normalizedMuted
        }
    }));
    return normalizedMuted;
}

function toggleWaifuMuted() {
    return setWaifuMuted(!isWaifuMuted());
}

function showMessage(text, timeout, priority, options = {}) {
    const { force = false } = options;
    if (!text || (!force && isWaifuMuted())) return false;
    if (sessionStorage.getItem("waifu-text") && sessionStorage.getItem("waifu-text") > priority) return false;

    clearMessageTimer();
    text = randomSelection(text);
    const tips = getTipsElement();
    if (!tips) {
        return false;
    }
    sessionStorage.setItem("waifu-text", priority);
    tips.innerHTML = text;
    tips.classList.add("waifu-tips-active");
    messageTimer = setTimeout(() => {
        sessionStorage.removeItem("waifu-text");
        tips.classList.remove("waifu-tips-active");
    }, timeout);
    return true;
}

window.addEventListener("storage", event => {
    if (event.key === muteStorageKey && event.newValue === "1") {
        hideMessage();
    }
});

export { hideMessage, isWaifuMuted, setWaifuMuted, toggleWaifuMuted };
export default showMessage;
