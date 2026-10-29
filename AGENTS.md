# 羊羊大作战 — Agent Instructions

This repository contains exactly one game, **Sheep Showdown** (羊羊大作战).
Shared infrastructure lives in `platform/`, a git submodule of
`xechoz/mg-platform` pinned to `v4.1.0`.

## Read first

1. `platform/AGENTS.md` — platform-wide rules and shared APIs.
2. `platform/docs/game-development.md` — game development spec and process.
3. This file — game-specific scope.
4. `src/logic` before changing rules; `src/scenes` before changing rendering.

**Never edit files under `platform/` in this repository.** Platform changes go
to `xechoz/mg-platform`, get a new tag, and are pulled in by bumping the
submodule.

## Layout

- `src/logic/` — pure rules. No Phaser, DOM, audio or ads. Seeded RNG only.
  - `config.ts` — unit stats, economy, pressure, AI tuning.
  - `state.ts` — creation, deployment, fixed-step simulation, win check.
  - `ai.ts` — opponent decisions for either side (team 1 by default).
- `src/scenes/` — `MenuScene`, `GameScene` (countdown, pause, result).
- `src/ui/` — procedural sheep art, board, HUD rails, cards, layout, modals.
- `src/main.ts` — `createGame()` composition root.
- `src/i18n.ts` — 11 locales; Chinese and English are the reference.
- `src/save.ts` — versioned profile save and migrations.
- `game.manifest.json` — site card metadata; `id` is `yangyangdazuozhan`.

## Game rules

- Five vertical lanes. Blue (team 0) is at the bottom, red (team 1) at the top.
- Four units: shield (2), archer (4), ram (5), healer (5). Costs, HP, speed,
  range, damage and intervals live in `src/logic/config.ts`.
- Energy starts at 12, caps at 20, regenerates over time. A damaged base grants
  a comeback regeneration bonus.
- **No time limit.** A match ends only when a base reaches 0 HP. Every 60 s a
  pressure tier raises energy regeneration and damage; keep this converging.
- A unit stops at the nearest same-lane enemy, or attacks the enemy base at the
  gate. Healers follow and heal instead of attacking.
- Units queue behind allies; deployment has a short per-team cooldown.
- AI mode: team 1 is the AI. Local mode: both sides are human, the top rail and
  all red units are rotated 180° so each player reads their side upright.
- Pause on blur/hidden; resume runs a 3-2-1 countdown. Fixed 50 ms simulation
  step with interpolation; input commands are queued and applied first.

## Commands

```bash
npm ci
npm run dev          # http://localhost:5175
npm run check        # tsc + biome + game boundaries
npm run test
npm run build
npm run package:web
npm run package:poki
npm run package:crazy:basic
npm run package:crazy:full
```

## Release

Push a `vX.Y.Z` tag. CI runs checks, builds all four flavors and creates a
GitHub Release with:

- `yangyangdazuozhan-web.zip`
- `yangyangdazuozhan-poki.zip`
- `yangyangdazuozhan-crazygames-basic.zip`
- `yangyangdazuozhan-crazygames-full.zip`

After the release, update `site/games.json` in `xechoz/mini-games` to the new
version. Do not commit or tag without an explicit request.
