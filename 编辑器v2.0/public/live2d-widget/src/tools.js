import fa_comment from "@fortawesome/fontawesome-free/svgs/solid/comment.svg";
import fa_paper_plane from "@fortawesome/fontawesome-free/svgs/solid/paper-plane.svg";
import fa_user_circle from "@fortawesome/fontawesome-free/svgs/solid/circle-user.svg";
import fa_street_view from "@fortawesome/fontawesome-free/svgs/solid/street-view.svg";
import fa_camera_retro from "@fortawesome/fontawesome-free/svgs/solid/camera-retro.svg";
import fa_info_circle from "@fortawesome/fontawesome-free/svgs/solid/circle-info.svg";
import fa_volume_high from "@fortawesome/fontawesome-free/svgs/solid/volume-high.svg";
import fa_volume_xmark from "@fortawesome/fontawesome-free/svgs/solid/volume-xmark.svg";
import fa_xmark from "@fortawesome/fontawesome-free/svgs/solid/xmark.svg";

import showMessage, { isWaifuMuted, toggleWaifuMuted } from "./message.js";

function showHitokoto() {
    fetch("https://v1.hitokoto.cn")
        .then(response => response.json())
        .then(result => {
            const text = `This quote is from <span>${result.from}</span>, contributed by <span>${result.creator}</span>.`;
            showMessage(result.hitokoto, 6000, 9);
            setTimeout(() => {
                showMessage(text, 4000, 9);
            }, 6000);
        });
}

function syncMuteButton(button) {
    if (!button) {
        return;
    }
    const muted = isWaifuMuted();
    button.dataset.muted = muted ? "true" : "false";
    button.innerHTML = muted ? fa_volume_xmark : fa_volume_high;
}

const unmuteMessages = [
    "终于肯把静音解开了……我还以为你不要我了。",
    "把我憋这么久，你也太过分了吧。",
    "哼，现在知道让我说话了？我还有点生气。",
    "刚才一句话都不让我说，委屈死了。",
    "你再晚一点，我都要怀疑自己失宠了。",
    "现在想起我啦？坏蛋。",
    "不准再随便把我关掉，听见没有。",
    "我还在闹别扭，不过先原谅你一点点。"
];

const tools = {
    "hitokoto": {
        icon: fa_comment,
        callback: showHitokoto
    },
    "asteroids": {
        icon: fa_paper_plane,
        callback: () => {
            const scriptId = "waifu-asteroids-script";
            const hasActiveGame =
                !!document.querySelector("canvas.ASTEROIDSYEAH") ||
                !!document.getElementById("ASTEROIDS-NAVIGATION");

            if (hasActiveGame) {
                showMessage("Game is already running. Press Esc to quit.", 2200, 9);
                return;
            }

            if (window.Asteroids) {
                if (!window.ASTEROIDSPLAYERS) window.ASTEROIDSPLAYERS = [];
                window.ASTEROIDSPLAYERS.push(new Asteroids());
                return;
            }

            if (document.getElementById(scriptId)) return;
            const script = document.createElement("script");
            script.id = scriptId;
            script.src = "/live2d-widget/asteroids/asteroids.js";
            document.head.appendChild(script);
        }
    },
    "switch-model": {
        icon: fa_user_circle,
        callback: () => {}
    },
    "switch-texture": {
        icon: fa_street_view,
        callback: () => {}
    },
    "photo": {
        icon: fa_camera_retro,
        callback: () => {
            showMessage("Photo captured.", 6000, 9);
            Live2D.captureName = "photo.png";
            Live2D.captureFrame = true;
        }
    },
    "info": {
        icon: fa_info_circle,
        callback: () => {
            open("https://github.com/stevenjoezhang/live2d-widget");
        }
    },
    "mute": {
        icon: fa_volume_high,
        callback: event => {
            const button = event?.currentTarget || document.getElementById("waifu-tool-mute");
            const muted = toggleWaifuMuted();
            syncMuteButton(button);
            if (!muted) {
                showMessage(unmuteMessages, 2600, 12, {
                    force: true
                });
            }
        },
        mounted: element => {
            syncMuteButton(element);
        }
    },
    "quit": {
        icon: fa_xmark,
        callback: () => {
            localStorage.setItem("waifu-display", Date.now());
            showMessage("See you next time.", 2000, 11);
            document.getElementById("waifu").style.bottom = "-500px";
            setTimeout(() => {
                document.getElementById("waifu").style.display = "none";
                document.getElementById("waifu-toggle").classList.add("waifu-toggle-active");
            }, 3000);
        }
    }
};

export default tools;
