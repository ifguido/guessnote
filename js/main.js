/*
  guessnote.live — bootstrap

  Wires UI events to the game.
  Keeps all side-effects (DOM events) in one file.
*/

(function () {
    "use strict";

    const root = window;
    root.GuessNote = root.GuessNote || {};

    const dom = root.GuessNote.dom;
    const AudioEngine = root.GuessNote.AudioEngine;
    const Game = root.GuessNote.Game;
    const i18n = root.GuessNote.i18n;
    const analytics = root.GuessNote.analytics;

    function t(key, vars) {
        try {
            if (i18n && typeof i18n.t === "function") return i18n.t(key, vars);
        } catch {
            // ignore
        }
        return String(vars && vars.fallback ? vars.fallback : key);
    }

    function logEvent(name, params) {
        try {
            if (analytics && typeof analytics.logEvent === "function") {
                analytics.logEvent(name, params);
            }
        } catch {
            // ignore
        }
    }

    // Start gate (browser audio policies)
    dom.tapToStart.addEventListener("click", () => {
        if (!dom.tapToStart.dataset.started) {
            dom.tapToStart.dataset.started = "1";
            Game.start();
        }
    });

    // Language selector
    function setLang(next) {
        try {
            const url = new URL(window.location.href);
            url.searchParams.set("lang", next);
            window.location.href = url.toString();
        } catch {
            // ignore
        }
    }

    function markActiveLang() {
        const current = (i18n && i18n.lang) ? String(i18n.lang) : "en";
        document.querySelectorAll(".langBtn").forEach((el) => {
            const lang = el.getAttribute("data-lang");
            if (lang === current) el.classList.add("active");
            else el.classList.remove("active");
        });
    }

    document.querySelectorAll(".langBtn").forEach((el) => {
        el.addEventListener("click", () => {
            const lang = el.getAttribute("data-lang");
            if (lang) {
                logEvent("lang_change", { lang });
                setLang(lang);
            }
        });
    });

    markActiveLang();

    // Keyboard shortcuts
    window.addEventListener("keydown", (e) => {
        const k = e.key.toLowerCase();

        if (k === " ") {
            e.preventDefault();
            Game.replayUnknown();
            logEvent("replay_unknown", {});
        }

        if (k === "1" || k === "2" || k === "3" || k === "4") {
            const idx = Number(k) - 1;
            const nodes = document.querySelectorAll(".choice");
            const node = nodes[idx];
            if (node && node.getAttribute("aria-disabled") !== "true") node.click();
        }
    });

    function shareText() {
        return Game.getShareText();
    }

    function openShareUrl(url) {
        window.open(url, "_blank", "noopener,noreferrer");
    }

    dom.shareWhatsapp.addEventListener("click", () => {
        const text = encodeURIComponent(shareText());
        openShareUrl(`https://wa.me/?text=${text}`);
        logEvent("share_click", { platform: "whatsapp" });
    });

    dom.shareFacebook.addEventListener("click", () => {
        const txt = shareText();
        const u = encodeURIComponent(txt.split(" ").slice(-1)[0] || window.location.href);
        const quote = encodeURIComponent(txt);
        openShareUrl(`https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${quote}`);
        logEvent("share_click", { platform: "facebook" });
    });

    dom.shareInstagram.addEventListener("click", async () => {
        const txt = shareText();
        logEvent("share_click", { platform: "instagram" });
        if (navigator.share) {
            try {
                await navigator.share({ text: txt });
                logEvent("share_success", { platform: "instagram", method: "native" });
                return;
            } catch {
                // Fall through to copy
            }
        }

        try {
            await navigator.clipboard.writeText(txt);
            window.alert(t("share.instagram.copied", { fallback: "Copied" }));
            logEvent("share_success", { platform: "instagram", method: "copy" });
        } catch {
            window.prompt(t("share.copy.prompt", { fallback: "Copy this:" }), txt);
        }
    });

    // Mobile-friendly replay: tap the '?' slot.
    dom.progression.addEventListener("click", (e) => {
        const tEl = /** @type {HTMLElement|null} */ (e.target);
        if (!tEl) return;
        const slot = tEl.closest(".slot");
        if (!slot) return;
        if (slot.classList.contains("q")) {
            Game.replayUnknown();
            logEvent("replay_unknown", { method: "tap" });
        }
    });

    // Initial placeholder
    Game.renderProgression(["C", "F", "G"]);
})();
