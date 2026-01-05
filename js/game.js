/*
  guessnote.live — Game logic

  Responsibilities:
  - generate a 4-chord progression
  - render: 3 visible chords + 4 multiple-choice options
  - timer and auto-next
  - scoring
  - feedback overlay

  The game does NOT do any audio synthesis itself.
  It calls `GuessNote.AudioEngine`.
*/

(function () {
    "use strict";

    const root = window;
    root.GuessNote = root.GuessNote || {};

    const { pick, shuffle, clamp } = root.GuessNote.utils;
    const dom = root.GuessNote.dom;
    const AudioEngine = root.GuessNote.AudioEngine;
    const Chords = root.GuessNote.Chords;
    const chordLabel = root.GuessNote.chordLabel;
    const i18n = root.GuessNote.i18n;
    const analytics = root.GuessNote.analytics;

    const FEEDBACK_MS = 1550;
    const MAX_ROUNDS = 5;

    function fitTextToBox(el, { maxPx = 36, minPx = 16, padPx = 22 } = {}) {
        if (!el) return;
        const node = /** @type {HTMLElement} */ (el);
        node.style.fontSize = maxPx + "px";
        node.style.whiteSpace = "nowrap";

        // Reduce font size until it fits (or we reach min).
        let size = maxPx;
        const box = Math.max(10, node.clientWidth - padPx);
        while (size > minPx && node.scrollWidth > box) {
            size -= 1;
            node.style.fontSize = size + "px";
        }
    }

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

    /**
     * Render the 3 known chords and a hidden question mark.
     * @param {string[]} chordIds3
     */
    function renderProgression(chordIds3) {
        const slots = dom.progression.querySelectorAll(".slot");
        for (let i = 0; i < 3; i++) {
            slots[i].textContent = chordLabel(chordIds3[i] || "");
            slots[i].classList.remove("q");
            fitTextToBox(slots[i]);
        }
        slots[3].textContent = "?";
        slots[3].classList.add("q");
    }

    /**
     * Create and mount the option buttons.
     * @param {string[]} options
     * @param {(id: string) => void} onPick
     */
    function renderChoices(options, onPick) {
        dom.choices.innerHTML = "";

        options.forEach((id, i) => {
            const idx = i + 1;

            const div = document.createElement("div");
            div.className = "choice";
            div.setAttribute("role", "button");
            div.setAttribute("tabindex", "0");
            div.setAttribute("aria-disabled", "false");

            div.innerHTML = `
                <div class="sub">OPTION</div>
        <div class="title">
          <div class="t">${chordLabel(id)}</div>
          <div class="kbd">${idx}</div>
        </div>
      `;

            const choose = () => onPick(id);
            div.addEventListener("click", choose);
            div.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    choose();
                }
            });

            dom.choices.appendChild(div);
        });
    }

    function renderStats(state) {
        dom.okCount.textContent = String(state.correct);
        dom.noCount.textContent = String(Math.max(0, state.total - state.correct));
        dom.round.textContent = String(state.round) + "/" + String(MAX_ROUNDS);
        dom.roundLeft.textContent = String(Math.max(0, MAX_ROUNDS - state.total));
    }

    function lockChoices(locked) {
        const nodes = dom.choices.querySelectorAll(".choice");
        nodes.forEach((n) => n.setAttribute("aria-disabled", locked ? "true" : "false"));
    }

    /**
     * Feedback message + fullscreen overlay.
     * @param {string} text
     * @param {"ok"|"bad"|""} kind
     */
    function setMsg(text, kind) {
        dom.msg.textContent = text;
        dom.msg.className = "msg show " + (kind || "");

        // Restart animation reliably
        void dom.msg.offsetWidth;

        dom.msg.className = "msg show anim " + (kind || "");
        dom.overlay.className = "overlay show " + (kind || "");

        setTimeout(() => {
            if (dom.msg.textContent === text) {
                dom.msg.className = "msg";
                dom.overlay.className = "overlay";
            }
        }, FEEDBACK_MS);
    }

    /**
     * Factory for the game.
     * All state is private to the closure.
     */
    const Game = (() => {
        const EASY_PCT = 0.2;
        const MED_PCT = 0.5;

        function tierCounts(maxRounds) {
            let easy = Math.max(1, Math.round(maxRounds * EASY_PCT));
            let medium = Math.max(1, Math.round(maxRounds * MED_PCT));
            if (easy + medium >= maxRounds) {
                medium = Math.max(1, maxRounds - easy - 1);
            }
            const impossible = Math.max(1, maxRounds - easy - medium);
            return { easy, medium, impossible };
        }

        const TIERS = tierCounts(MAX_ROUNDS);

        /** @param {number} roundIndex 1-based */
        function tierForRound(roundIndex) {
            if (roundIndex <= TIERS.easy) return "easy";
            if (roundIndex <= TIERS.easy + TIERS.medium) return "medium";
            return "impossible";
        }

        const state = {
            started: false,
            locked: true,
            correct: 0,
            total: 0,
            round: 0,

            shareText: "",

            autoplayT: /** @type {number|null} */ (null),

            visible: /** @type {string[]} */ ([]),
            answer: /** @type {string} */ (""),
            options: /** @type {string[]} */ ([]),

            timeLimitMs: 10000,
            tEnd: 0,
            raf: 0,

            lastRoundSet: /** @type {Set<string>} */ (new Set()),
        };

        function stopTimer() {
            if (state.raf) cancelAnimationFrame(state.raf);
            state.raf = 0;
        }

        function fmt(ms) {
            const s = Math.max(0, ms) / 1000;
            return s.toFixed(1);
        }

        function startTimer() {
            stopTimer();
            const t0 = performance.now();
            state.tEnd = t0 + state.timeLimitMs;

            const tick = () => {
                const now = performance.now();
                const left = state.tEnd - now;
                dom.timerValue.textContent = fmt(left);

                if (left <= 0) {
                    stopTimer();
                    lockChoices(true);
                    state.total++;
                    renderStats(state);
                    setMsg(t("time.up", { fallback: "TIME" }), "bad");
                    logEvent("timeout", {
                        round: state.total,
                        max: MAX_ROUNDS,
                    });
                    setTimeout(() => nextRound(), 550);
                    return;
                }

                state.raf = requestAnimationFrame(tick);
            };

            tick();
        }

        function currentPool() {
            const tier = tierForRound(state.round);
            if (tier === "impossible") {
                const all = Chords.chords.map((c) => c.id);
                return all.length >= 4 ? all : ["C", "F", "G", "Am"];
            }

            if (tier === "easy") {
                // Diatonic triads (no 7ths)
                return ["C", "Dm", "Em", "F", "G", "Am", "Bdim"];
            }

            // medium: diatonic + 7ths + a bit of diminished color
            return [
                "C",
                "Dm",
                "Em",
                "F",
                "G",
                "Am",
                "Bdim",
                "G7",
                "Cmaj7",
                "Dm7",
                "Em7",
                "Fmaj7",
                "Am7",
                "Bm7b5",
                "Bdim7",
            ];
        }

        function generateSequence() {
            // 4-chord progression without any repeats.
            // Best-effort: also try to avoid reusing the previous round chords.
            const pool = currentPool();
            const steps = [-2, -1, +1, +2];
            const used = new Set();
            const avoid = state.lastRoundSet;

            let idx = Math.floor(Math.random() * pool.length);
            let guard = 0;

            while (guard++ < 250) {
                const seq = [];
                used.clear();

                let localIdx = idx;
                for (let i = 0; i < 4; i++) {
                    if (i > 0) {
                        localIdx = clamp(localIdx + pick(steps), 0, pool.length - 1);
                    }
                    let cand = pool[localIdx];

                    // Force uniqueness within the round.
                    if (used.has(cand)) {
                        const alts = pool.filter((x) => !used.has(x));
                        if (!alts.length) break;
                        cand = pick(alts);
                    }

                    // Try to avoid last round (if possible).
                    if (avoid.size && avoid.has(cand)) {
                        const alts = pool.filter((x) => !used.has(x) && !avoid.has(x));
                        if (alts.length >= (4 - i)) cand = pick(alts);
                    }

                    seq.push(cand);
                    used.add(cand);
                }

                if (seq.length === 4 && new Set(seq).size === 4) return seq;
                idx = Math.floor(Math.random() * pool.length);
            }

            // Absolute fallback: take 4 unique from a shuffled pool.
            const shuffled = shuffle(pool.slice());
            const seq = [];
            for (const x of shuffled) {
                if (!seq.includes(x)) seq.push(x);
                if (seq.length >= 4) break;
            }
            while (seq.length < 4) seq.push(shuffled[seq.length] || "C");
            return seq;
        }

        function buildOptions(answerId) {
            const pool = currentPool();
            const aIdx = pool.indexOf(answerId);

            const near = [];
            for (const d of [-2, -1, +1, +2, +3, -3]) {
                const j = aIdx + d;
                if (j >= 0 && j < pool.length) near.push(pool[j]);
            }

            const distractors = new Set();
            let guard = 0;
            while (distractors.size < 3 && guard++ < 200) {
                const cand = near.length && Math.random() < 0.85 ? pick(near) : pick(pool);
                if (cand !== answerId) distractors.add(cand);
            }

            // Defensive fallback (prevents any chance of an infinite loop)
            if (distractors.size < 3) {
                const all = Chords.chords.map((c) => c.id);
                const candidates = shuffle(Array.from(new Set([...pool, ...all])));
                for (const cand of candidates) {
                    if (cand !== answerId) distractors.add(cand);
                    if (distractors.size >= 3) break;
                }
            }

            return shuffle([answerId, ...Array.from(distractors)]);
        }

        function replaySequence() {
            if (!state.started) return;
            const chordFreqs = [...state.visible, state.answer].map(
                (id) => Chords.byId.get(id).freqs
            );
            AudioEngine.playChordSequence(chordFreqs, { gapSec: 1.05, dur: 1.1, vel: 0.92 }, true);
        }

        function replayUnknown() {
            if (!state.started) return;
            const chosen = Chords.byId.get(state.answer);
            if (!chosen) return;
            AudioEngine.killAll(true);
            AudioEngine.playChord(chosen.freqs, AudioEngine.time() + 0.02, {
                dur: 1.0,
                vel: 0.92,
            });
        }

        function getShareText() {
            return state.shareText || "";
        }

        function showEndCard() {
            stopTimer();
            state.locked = true;
            lockChoices(true);

            // Ensure any pending feedback timer won't hide the end overlay.
            dom.msg.textContent = "";
            dom.msg.className = "msg";

            const score = Math.max(0, state.correct);
            dom.endScore.textContent = `${score}/${MAX_ROUNDS}`;

            const url = String(root.location.href || "").split("#")[0];
            state.shareText = t("share.message", {
                score,
                max: MAX_ROUNDS,
                url,
                fallback: `Acerté ${score}/${MAX_ROUNDS}, cuantas haces vos? ${url}`,
            });

            logEvent("game_end", {
                score,
                max: MAX_ROUNDS,
            });

            dom.overlay.className = "overlay show";
            dom.endCard.className = "endCard show";
            dom.endCard.setAttribute("aria-hidden", "false");
        }

        function nextRound() {
            // Max rounds: stop and show share card.
            if (state.total >= MAX_ROUNDS) {
                showEndCard();
                return;
            }

            state.round++;
            renderStats(state);

            const tier = tierForRound(state.round);
            logEvent("round_start", {
                round: state.round,
                max: MAX_ROUNDS,
                tier,
            });

            // Rotate instrument preset every few rounds (less fatigue)
            AudioEngine.setInstrument((state.round - 1) % 3);

            if (state.autoplayT) {
                clearTimeout(state.autoplayT);
                state.autoplayT = null;
            }

            // Generate round
            const seq = generateSequence();
            state.visible = seq.slice(0, 3);
            state.answer = seq[3];
            state.options = buildOptions(state.answer);

            state.lastRoundSet = new Set(seq);

            // Render
            renderProgression(state.visible);
            renderChoices(state.options, pickAnswer);

            // Start
            state.locked = false;
            lockChoices(false);
            startTimer();

            // Autoplay sequence
            state.autoplayT = window.setTimeout(() => replaySequence(), 240);
        }

        function pickAnswer(id) {
            if (!state.started || state.locked) return;
            state.locked = true;
            lockChoices(true);
            stopTimer();

            if (state.autoplayT) {
                clearTimeout(state.autoplayT);
                state.autoplayT = null;
            }

            // No feedback sounds on win/lose; only chords.
            AudioEngine.killAll(true);

            state.total++;
            const correct = id === state.answer;
            if (correct) {
                state.correct++;
                setMsg("✓", "ok");
            } else {
                setMsg("✕", "bad");
            }

            logEvent("answer", {
                round: state.total,
                max: MAX_ROUNDS,
                correct: correct ? 1 : 0,
            });

            // Always play what you clicked.
            const chosen = Chords.byId.get(id);
            if (chosen) {
                AudioEngine.playChord(chosen.freqs, AudioEngine.time() + 0.02, {
                    dur: 0.95,
                    vel: 0.92,
                });
            }

            renderStats(state);

            // No replay of the previous progression.
            // Wait until the overlay clears (it blocks clicks).
            setTimeout(() => nextRound(), FEEDBACK_MS);
        }

        function start() {
            AudioEngine.ensure();

            // Reset end UI
            dom.endCard.className = "endCard";
            dom.endCard.setAttribute("aria-hidden", "true");

            state.started = true;
            dom.tapToStart.textContent = t("start.playing", { fallback: "PLAYING" });
            dom.tapToStart.style.opacity = "0.6";
            dom.tapToStart.style.cursor = "default";

            logEvent("game_start", {
                max: MAX_ROUNDS,
                tiers: `${TIERS.easy}/${TIERS.medium}/${TIERS.impossible}`,
            });

            nextRound();
        }

        return {
            start,
            replaySequence,
            replayUnknown,
            nextRound,
            pickAnswer,
            getShareText,

            // metadata
            maxRounds: MAX_ROUNDS,

            // Rendering helpers used at boot
            renderProgression,
        };
    })();

    root.GuessNote.Game = Game;
})();
