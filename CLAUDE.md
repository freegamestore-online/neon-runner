# APPNAME

A free game on FreeGameStore, built on the **Phaser 4** browser game engine.

- Subdomain: `APPNAME.freegamestore.online`
- Dev: `pnpm install && pnpm dev`
- Build: `pnpm build`
- Deploy: `git push origin main` (auto-deploys to R2 via GitHub Actions)

## Engine: Phaser 4

This template uses [Phaser 4](https://phaser.io) — the most widely-used HTML5
game engine. It gives you a scene lifecycle, arcade & matter physics, sprite
groups, tweens, input and a responsive scaler out of the box, so you write game
logic instead of a render loop. Phaser is the right choice when a game grows past
"a few shapes" — platformers, shooters, top-down games, anything with real
collisions, many entities, or multiple levels.

- **`web/src/game.ts`** — the whole game. Phaser owns the loop, rendering, input
  and physics. This is where you build; start from the sample "catch" game.
- **`web/src/App.tsx`** — thin React layer: the `@freegamestore/games` shell +
  score readout. It mounts a `<div>` that Phaser fills with its own `<canvas>`,
  and passes an `onScore` callback so the game can update the topbar. You rarely
  touch this.

### Working in game.ts

- A game is one or more `Phaser.Scene` subclasses with `preload()`, `create()`
  and `update()`. This template has a single `PlayScene`; add more scenes
  (`MenuScene`, `LevelScene`) and pass them in the `scene` array for larger games.
- **Objects:** `this.add.rectangle/circle/text/sprite(...)`. Give an object
  physics with `this.physics.add.existing(obj)`, then drive its
  `obj.body as Phaser.Physics.Arcade.Body` (`setVelocity`, `setImmovable`,
  `setCircle`, `setAllowGravity`).
- **Groups & collisions:** `this.physics.add.group()`;
  `this.physics.add.overlap(a, b, cb)` / `collider(a, b, cb)`.
- **Input:** `this.input.on("pointermove"/"pointerdown", …)` for touch+mouse;
  `this.input.keyboard?.createCursorKeys()` for arrows.
- **Timing:** `this.time.addEvent({ delay, loop, callback })`; tweens via
  `this.tweens.add({...})`.
- **Scaling:** the game uses a fixed virtual resolution (`VW`×`VH`) with
  `Scale.FIT`, so it letterboxes cleanly on any screen — design against `VW`/`VH`,
  not the device size.
- **No external assets by default.** Published games must be self-contained (no
  external `<script>`/asset hosts). Draw with Phaser shapes/text, generate
  textures at runtime, or commit assets into `web/public/` and load them with a
  relative path.
- **Report the score to React** via the `onScore` callback passed into
  `startGame` — that is what drives the topbar.
- **Bundle:** Phaser is split into its own vendor chunk (`vite.config.ts`
  `manualChunks`) so it caches separately; keep your game code in the app chunk
  small. Don't add other heavy libraries — Phaser already covers rendering,
  physics, input, audio and tweens.
- **Keep files focused (~300 lines).** Split multi-scene games into modules
  (`scenes/play.ts`, `entities/player.ts`) and import them — smaller files are
  easier to edit safely.

Free, MIT-licensed, no tracking. For platform conventions, read
https://freegamestore.online/skills.md
before writing or changing anything.
