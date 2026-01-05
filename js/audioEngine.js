/*
  guessnote.live — AudioEngine

  WebAudio-only (no samples): a "soft piano" style synth with:
  - single AudioContext
  - voice management to prevent overlaps
  - a small generated reverb
  - a few rotating timbre presets to reduce ear fatigue

  Public API is a small set of functions used by the game.
*/

(function () {
    "use strict";

    const root = window;
    root.GuessNote = root.GuessNote || {};
    const { pick } = root.GuessNote.utils;

    const AudioEngine = (() => {
        /** @type {AudioContext|null} */
        let ctx = null;
        /** @type {GainNode|null} */
        let master = null;
        /** @type {DynamicsCompressorNode|null} */
        let comp = null;

        /** @type {PeriodicWave|null} */
        let pianoWave = null;

        /** @type {AudioBuffer|null} */
        let noiseBuf = null;

        /** @type {boolean} */
        let muted = false;

        // Active voices to stop them before new playback (prevents overlaps)
        /** @type {Array<{osc: OscillatorNode, g: GainNode, stopAt: number}>} */
        let voices = [];

        /** @type {Array<{src: AudioBufferSourceNode, g: GainNode, stopAt: number}>} */
        let noises = [];

        const DEFAULT_GAP_SEC = 0.95; // more time between chords
        const DEFAULT_NOTE_DUR = 1.05; // more sustain

        /** @type {Array<PeriodicWave>|null} */
        let waves = null;

        // 0: warm piano, 1: darker/felt-ish, 2: soft e-piano-ish
        let instrument = 0;

        function buildWave(c, harmonics, rolloff) {
            const real = new Float32Array(harmonics + 1);
            const imag = new Float32Array(harmonics + 1);
            for (let n = 1; n <= harmonics; n++) {
                // Softer partials (less metallic): amplitude drops quickly.
                imag[n] = 1 / Math.pow(n, rolloff);
            }
            return c.createPeriodicWave(real, imag, {
                disableNormalization: false,
            });
        }

        function pickTimbre() {
            // Rotate soft presets so it doesn't fatigue as fast.
            const r = Math.random();
            if (instrument === 1) {
                // darker / "felt"
                const wave = waves ? waves[1] : pianoWave;
                return {
                    wave,
                    lpMul: 3.8 + r * 0.35,
                    bodyGain: 0.9 + r * 0.18,
                    hsGain: -18,
                    sineGain: 0.9,
                    mixGain: 0.1,
                };
            }
            if (instrument === 2) {
                // soft e-piano-ish (round, less body peak)
                const wave = waves ? waves[0] : pianoWave;
                return {
                    wave,
                    lpMul: 5.0 + r * 0.45,
                    bodyGain: 0.75 + r * 0.18,
                    hsGain: -16,
                    sineGain: 0.94,
                    mixGain: 0.08,
                };
            }

            // warm piano (default)
            const wave = waves ? waves[r < 0.65 ? 0 : 1] : pianoWave;
            return {
                wave,
                lpMul: (r < 0.65 ? 4.6 : 4.9) + r * 0.25,
                bodyGain: r < 0.65 ? 1.15 : 0.95,
                hsGain: -16,
                sineGain: 0.88,
                mixGain: 0.12,
            };
        }

        function ensure() {
            if (ctx) return;
            ctx = new (window.AudioContext || window.webkitAudioContext)();

            master = ctx.createGain();
            master.gain.value = 0.7;

            // Simple generated reverb (helps realism without samples)
            const convolver = ctx.createConvolver();
            const wet = ctx.createGain();
            const dry = ctx.createGain();
            const sum = ctx.createGain();
            dry.gain.value = 0.9;
            wet.gain.value = 0.16;

            // Build an impulse response
            const seconds = 1.25;
            const decay = 3.0;
            const len = Math.floor(ctx.sampleRate * seconds);
            const ir = ctx.createBuffer(2, len, ctx.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const data = ir.getChannelData(ch);
                for (let i = 0; i < len; i++) {
                    const t = i / len;
                    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
                }
            }
            convolver.buffer = ir;

            master.connect(dry);
            master.connect(convolver);
            convolver.connect(wet);
            dry.connect(sum);
            wet.connect(sum);

            comp = ctx.createDynamicsCompressor();
            comp.threshold.value = -20;
            comp.knee.value = 18;
            comp.ratio.value = 3;
            comp.attack.value = 0.004;
            comp.release.value = 0.2;

            sum.connect(comp);
            comp.connect(ctx.destination);

            // Softer harmonics (less metallic)
            pianoWave = buildWave(ctx, 8, 2.55);
            waves = [
                buildWave(ctx, 9, 2.35), // warm
                buildWave(ctx, 7, 2.8), // felt / dark
            ];

            // Disable hammer-noise (user reported it as metallic)
            noiseBuf = null;
        }

        function setInstrument(next) {
            instrument = ((Number(next) % 3) + 3) % 3;
        }

        function setMuted(next) {
            ensure();
            muted = Boolean(next);
            if (master) master.gain.value = muted ? 0 : 0.85;
        }

        function toggleMuted() {
            setMuted(!muted);
            return muted;
        }

        function isMuted() {
            return muted;
        }

        function time() {
            ensure();
            return ctx.currentTime;
        }

        function killAll(immediate = false) {
            ensure();
            const t = time();
            for (const v of voices) {
                try {
                    v.g.gain.cancelScheduledValues(t);
                    v.g.gain.setValueAtTime(v.g.gain.value || 0.0001, t);
                    v.g.gain.exponentialRampToValueAtTime(
                        0.0001,
                        t + (immediate ? 0.01 : 0.06)
                    );
                    v.osc.stop(t + (immediate ? 0.015 : 0.08));
                } catch { }
            }
            voices = [];

            for (const n of noises) {
                try {
                    n.g.gain.cancelScheduledValues(t);
                    n.g.gain.setValueAtTime(n.g.gain.value || 0.0001, t);
                    n.g.gain.exponentialRampToValueAtTime(
                        0.0001,
                        t + (immediate ? 0.01 : 0.06)
                    );
                    n.src.stop(t + (immediate ? 0.015 : 0.08));
                } catch { }
            }
            noises = [];
        }

        /**
         * Play a single note.
         * This is the core synth voice used for both melodies and chords.
         */
        function play(freq, startAt, dur = DEFAULT_NOTE_DUR, vel = 0.9) {
            ensure();
            if (muted) return;
            const c = ctx;
            const t = startAt ?? time();

            const timbre = pickTimbre();

            // Clean up old voices
            const now = time();
            voices = voices.filter((v) => v.stopAt > now);
            noises = noises.filter((n) => n.stopAt > now);

            const g = c.createGain();
            g.gain.setValueAtTime(0.0001, t);

            // Body filters
            const hp = c.createBiquadFilter();
            hp.type = "highpass";
            hp.frequency.setValueAtTime(55, t);
            hp.Q.setValueAtTime(0.7, t);

            const lp = c.createBiquadFilter();
            lp.type = "lowpass";
            lp.frequency.setValueAtTime(Math.min(2200, freq * timbre.lpMul), t);
            lp.Q.setValueAtTime(0.6, t);

            const hs = c.createBiquadFilter();
            hs.type = "highshelf";
            hs.frequency.setValueAtTime(2300, t);
            hs.gain.setValueAtTime(timbre.hsGain ?? -10, t);

            const body = c.createBiquadFilter();
            body.type = "peaking";
            body.frequency.setValueAtTime(
                Math.min(1300, Math.max(250, freq * 3)),
                t
            );
            body.Q.setValueAtTime(0.9, t);
            body.gain.setValueAtTime(timbre.bodyGain, t);

            const panner = c.createStereoPanner();
            panner.pan.setValueAtTime((Math.random() * 2 - 1) * 0.06, t);

            const sine = c.createOscillator();
            sine.type = "sine";
            sine.frequency.setValueAtTime(freq, t);

            const sineG = c.createGain();
            sineG.gain.setValueAtTime(timbre.sineGain ?? 0.78, t);

            // Main harmonic oscillator
            const osc = c.createOscillator();
            if (timbre.wave) osc.setPeriodicWave(timbre.wave);
            osc.frequency.setValueAtTime(freq, t);
            osc.detune.setValueAtTime((Math.random() * 2 - 1) * 0.5, t);

            // Very subtle second osc for richness
            const osc2 = c.createOscillator();
            if (timbre.wave) osc2.setPeriodicWave(timbre.wave);
            osc2.frequency.setValueAtTime(freq, t);
            osc2.detune.setValueAtTime(1.6 + (Math.random() * 2 - 1) * 0.6, t);

            const mix = c.createGain();
            mix.gain.setValueAtTime(timbre.mixGain ?? 0.22, t);

            const sum = c.createGain();
            sum.gain.setValueAtTime(1, t);

            sine.connect(sineG);
            osc.connect(mix);
            osc2.connect(mix);
            sineG.connect(sum);
            mix.connect(sum);
            sum.connect(hp);
            hp.connect(body);
            body.connect(lp);
            lp.connect(hs);
            hs.connect(panner);
            panner.connect(g);
            g.connect(master);

            // Envelope (more sustain)
            const a = 0.006;
            const d = 0.14;
            const s = 0.18;
            const r = 1.35;

            g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vel), t + a);
            g.gain.exponentialRampToValueAtTime(
                Math.max(0.0002, vel * s),
                t + a + d
            );
            g.gain.setValueAtTime(
                Math.max(0.0002, vel * s),
                t + Math.max(0.06, dur)
            );
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur + r);

            sine.start(t);
            osc.start(t);
            osc2.start(t);

            const stopAt = t + dur + r + 0.04;
            sine.stop(stopAt);
            osc.stop(stopAt);
            osc2.stop(stopAt);

            voices.push({ osc: sine, g, stopAt });
            voices.push({ osc, g, stopAt });
            voices.push({ osc: osc2, g, stopAt });
        }

        function playSequence(
            freqs,
            { gapSec = DEFAULT_GAP_SEC, dur = DEFAULT_NOTE_DUR, vel = 0.95 } = {},
            killFirst = true
        ) {
            ensure();
            if (muted) return time();
            if (killFirst) killAll(true);
            let t = time() + 0.06;
            for (const f of freqs) {
                play(f, t, dur, vel);
                t += gapSec;
            }
            return t;
        }

        function playChord(freqs, startAt, { dur = DEFAULT_NOTE_DUR, vel = 0.9 } = {}) {
            ensure();
            if (muted) return;

            // Slight stagger so it feels like a real attack (not a harsh block chord)
            const base = startAt ?? time();
            const offsets = [0.0, 0.012, 0.02, 0.028, 0.036];
            for (let i = 0; i < freqs.length; i++) {
                play(freqs[i], base + (offsets[i] || 0), dur, vel * (i === 0 ? 1 : 0.92));
            }
        }

        function playChordSequence(
            chordFreqs,
            { gapSec = DEFAULT_GAP_SEC, dur = DEFAULT_NOTE_DUR, vel = 0.92 } = {},
            killFirst = true
        ) {
            ensure();
            if (muted) return time();
            if (killFirst) killAll(true);
            let t = time() + 0.08;
            for (const freqs of chordFreqs) {
                playChord(freqs, t, { dur, vel });
                t += gapSec;
            }
            return t;
        }

        return {
            ensure,
            time,
            killAll,
            play,
            playSequence,
            playChord,
            playChordSequence,
            setMuted,
            toggleMuted,
            isMuted,
            setInstrument,
        };
    })();

    root.GuessNote.AudioEngine = AudioEngine;
})();
