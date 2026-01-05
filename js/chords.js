/*
  guessnote.live — Chords

  A small set of chord "cards" the game can pick from.
  Each chord is stored as MIDI note numbers and precomputed frequencies.

  Notes are kept in a comfortable register so the synth sounds nicer.
*/

(function () {
    "use strict";

    const root = window;
    root.GuessNote = root.GuessNote || {};

    const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

    /**
     * Chord dictionary.
     * `id` is what we show to the player.
     */
    const baseChords = [
        // Triads
        { id: "C", tones: [60, 64, 67] },
        { id: "Dm", tones: [62, 65, 69] },
        { id: "Em", tones: [64, 67, 71] },
        { id: "F", tones: [65, 69, 72] },
        { id: "G", tones: [67, 71, 74] },
        { id: "Am", tones: [69, 72, 76] },
        { id: "Bdim", tones: [71, 74, 77] },

        // 7ths
        { id: "Cmaj7", tones: [60, 64, 67, 71] },
        { id: "Dm7", tones: [62, 65, 69, 72] },
        { id: "Em7", tones: [64, 67, 71, 74] },
        { id: "Fmaj7", tones: [65, 69, 72, 76] },
        { id: "G7", tones: [67, 71, 74, 77] },
        { id: "Am7", tones: [69, 72, 76, 79] },

        // Half-diminished / diminished
        { id: "Bm7b5", tones: [59, 62, 65, 69] },
        { id: "Bdim7", tones: [59, 62, 65, 68] },
    ];

    const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

    const QUALITIES = [
        { suf: "", iv: [0, 4, 7] },
        { suf: "m", iv: [0, 3, 7] },
        { suf: "dim", iv: [0, 3, 6] },
        { suf: "maj7", iv: [0, 4, 7, 11] },
        { suf: "m7", iv: [0, 3, 7, 10] },
        { suf: "7", iv: [0, 4, 7, 10] },
        { suf: "m7b5", iv: [0, 3, 6, 10] },
        { suf: "dim7", iv: [0, 3, 6, 9] },
    ];

    /**
     * Generate a big chord set for the last rounds.
     * We keep it in a comfortable register (around C4).
     */
    function generateChromaticChords() {
        /** @type {{id: string, tones: number[]}[]} */
        const extra = [];

        for (let s = 0; s < NOTE_NAMES.length; s++) {
            const rootName = NOTE_NAMES[s];
            let rootMidi = 60 + s; // C4 + semitone offset
            if (rootMidi > 66) rootMidi -= 12; // keep upper notes from getting too bright

            for (const q of QUALITIES) {
                const id = rootName + q.suf;
                const tones = q.iv.map((d) => rootMidi + d);
                extra.push({ id, tones });
            }
        }

        return extra;
    }

    const allChords = [...baseChords];
    const existingIds = new Set(allChords.map((c) => c.id));
    for (const c of generateChromaticChords()) {
        if (!existingIds.has(c.id)) {
            existingIds.add(c.id);
            allChords.push(c);
        }
    }

    const chords = allChords.map((c) => ({ ...c, freqs: c.tones.map(midiToFreq) }));

    const byId = new Map(chords.map((c) => [c.id, c]));

    /** @param {string} id */
    function chordLabel(id) {
        return id;
    }

    root.GuessNote.Chords = { chords, byId };
    root.GuessNote.chordLabel = chordLabel;
})();
