/*
  guessnote.live — DOM references

  Central place for all DOM element lookups.
  This keeps game/audio code focused on logic.
*/

(function () {
    "use strict";

    const root = window;
    root.GuessNote = root.GuessNote || {};
    const { $ } = root.GuessNote.utils;

    /**
     * Collect and expose the DOM nodes we use.
     * @returns {{
     *  timerValue: HTMLElement,
     *  okCount: HTMLElement,
     *  noCount: HTMLElement,
     *  msg: HTMLElement,
     *  round: HTMLElement,
     *  roundLeft: HTMLElement,
     *  choices: HTMLElement,
     *  overlay: HTMLElement,
     *  progression: HTMLElement,
     *  tapToStart: HTMLElement,
     *  endCard: HTMLElement,
     *  endScore: HTMLElement,
     *  shareWhatsapp: HTMLElement,
     *  shareInstagram: HTMLElement,
     *  shareFacebook: HTMLElement,
     * }}
     */
    function getDom() {
        return {
            timerValue: $("timerValue"),
            okCount: $("okCount"),
            noCount: $("noCount"),
            msg: $("msg"),
            round: $("round"),
            roundLeft: $("roundLeft"),
            choices: $("choices"),
            overlay: $("overlay"),
            progression: $("progression"),
            tapToStart: $("tapToStart"),
            endCard: $("endCard"),
            endScore: $("endScore"),
            shareWhatsapp: $("shareWhatsapp"),
            shareInstagram: $("shareInstagram"),
            shareFacebook: $("shareFacebook"),
        };
    }

    root.GuessNote.dom = getDom();
})();
