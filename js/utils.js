/*
  guessnote.live — utilities

  Small, boring helpers that keep the rest of the code readable.
  Everything is attached under the single global namespace `window.GuessNote`
  to keep it working even when opened via `file://`.
*/

(function () {
    "use strict";

    /** @type {any} */
    const root = window;
    root.GuessNote = root.GuessNote || {};

    /**
     * DOM helper.
     * Throws early if an expected element is missing.
     * @param {string} id
     * @returns {HTMLElement}
     */
    function $(id) {
        const el = document.getElementById(id);
        if (!el) throw new Error("Missing #" + id);
        return el;
    }

    /** @template T @param {T[]} arr @returns {T} */
    function pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    /**
     * Fisher–Yates shuffle (in-place).
     * @template T
     * @param {T[]} a
     * @returns {T[]}
     */
    function shuffle(a) {
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    /** @param {number} v @param {number} lo @param {number} hi */
    function clamp(v, lo, hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    root.GuessNote.utils = {
        $,
        pick,
        shuffle,
        clamp,
    };
})();
