/*
  guessnote.live — i18n

  Simple runtime translations (no dependencies).
  - Detects language from ?lang=es|en|pt or browser language.
  - Exposes `GuessNote.i18n.t(key, vars)`.
  - Replaces any element with `data-i18n="key"`.
*/

(function () {
    "use strict";

    const root = window;
    root.GuessNote = root.GuessNote || {};

    const DICT = {
        en: {
            "round": "ROUND",
            "round.left": "LEFT",
            "result.title": "RESULT",
            "share.label": "SHARE:",
            "share.whatsapp": "WhatsApp",
            "share.instagram": "Instagram",
            "share.facebook": "Facebook",
            "footer.replay": "Replay ?:",
            "start.cta": "TAP / CLICK TO START",
            "start.playing": "PLAYING",
            "time.up": "TIME",
            "share.message": "I got {score}/{max}. How many can you do? {url}",
            "share.instagram.copied": "Copied. Open Instagram and paste it.",
            "share.copy.prompt": "Copy this:",
        },
        es: {
            "round": "RONDA",
            "round.left": "RESTAN",
            "result.title": "Resultado",
            "share.label": "Compartí:",
            "share.whatsapp": "WhatsApp",
            "share.instagram": "Instagram",
            "share.facebook": "Facebook",
            "footer.replay": "Repetir ?:",
            "start.cta": "TOCÁ / CLICK PARA EMPEZAR",
            "start.playing": "JUGANDO",
            "time.up": "TIEMPO",
            "share.message": "Acerté {score}/{max}, cuantas haces vos? {url}",
            "share.instagram.copied": "Copiado. Abrí Instagram y pegalo en tu story/post.",
            "share.copy.prompt": "Copiá esto:",
        },
        pt: {
            "round": "RODADA",
            "round.left": "FALTAM",
            "result.title": "Resultado",
            "share.label": "Compartilhe:",
            "share.whatsapp": "WhatsApp",
            "share.instagram": "Instagram",
            "share.facebook": "Facebook",
            "footer.replay": "Repetir ?:",
            "start.cta": "TOQUE / CLIQUE PARA COMEÇAR",
            "start.playing": "JOGANDO",
            "time.up": "TEMPO",
            "share.message": "Acertei {score}/{max}. Quantas você consegue? {url}",
            "share.instagram.copied": "Copiado. Abra o Instagram e cole no story/post.",
            "share.copy.prompt": "Copie isto:",
        },
    };

    function detectLang() {
        try {
            const qs = new URLSearchParams(root.location.search);
            const raw = String(qs.get("lang") || "").trim().toLowerCase();
            if (raw === "es" || raw === "en" || raw === "pt") return raw;
        } catch {
            // ignore
        }

        const nav = (navigator.language || "en").toLowerCase();
        if (nav.startsWith("es")) return "es";
        if (nav.startsWith("pt")) return "pt";
        return "en";
    }

    function format(str, vars) {
        if (!vars) return str;
        return str.replace(/\{(\w+)\}/g, (_, k) => {
            const v = vars[k];
            return v === undefined || v === null ? "" : String(v);
        });
    }

    const lang = detectLang();

    function t(key, vars) {
        const table = DICT[lang] || DICT.en;
        const fallbackTable = DICT.en;
        const raw = table[key] ?? fallbackTable[key] ?? (vars && vars.fallback) ?? key;
        return format(String(raw), vars);
    }

    function apply() {
        const nodes = document.querySelectorAll("[data-i18n]");
        nodes.forEach((el) => {
            const k = el.getAttribute("data-i18n");
            if (!k) return;
            el.textContent = t(k);
        });
    }

    root.GuessNote.i18n = {
        lang,
        t,
        apply,
    };

    // Defer until DOM is ready (scripts are `defer`, so DOM is typically ready already)
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", apply, { once: true });
    } else {
        apply();
    }
})();
