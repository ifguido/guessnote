# GuessNote

A tiny browser game: you hear a 4‑chord progression, then you guess the hidden 4th chord.

## Run locally

Because the project loads multiple JS files, run it with a local web server:

```bash
python3 -m http.server 8080
```

Open:
- http://localhost:8080/

## How to play

- Click **Start** (required by browser audio policies)
- Listen to the progression
- Pick the correct hidden chord from the options
- **Replay hidden chord**: press **Space** or tap the **?** slot (mobile)

## Game rules

- **5 rounds total**
- Difficulty is proportional to total rounds:
  - ~20% easy
  - ~50% medium
  - ~30% impossible (last round is always impossible)

## Language (i18n)

The UI language is detected from the browser, or you can force it:

- `?lang=es` Spanish
- `?lang=pt` Portuguese
- `?lang=en` English

Example:
- http://localhost:8080/?lang=pt

## Analytics

Firebase Analytics is initialized in [js/analytics.js](js/analytics.js) and the game logs events such as:

- `game_start`, `round_start`, `answer`, `timeout`, `game_end`
- `share_click`, `share_success`
- `replay_unknown`, `lang_change`

## Project structure

- [index.html](index.html) — markup + script/style includes
- [styles.css](styles.css) — styling
- [js/audioEngine.js](js/audioEngine.js) — WebAudio synth
- [js/chords.js](js/chords.js) — chord dictionary
- [js/game.js](js/game.js) — game loop
- [js/main.js](js/main.js) — UI wiring
- [js/i18n.js](js/i18n.js) — translations
- [js/analytics.js](js/analytics.js) — Firebase analytics wrapper
