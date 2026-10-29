# 羊羊大作战 · Sheep Showdown

A five-lane, real-time sheep battle game built on
[`xechoz/mg-platform`](https://github.com/xechoz/mg-platform). Deploy shield,
archer, ram and healer sheep, push the front line and break the enemy base.

- **Vs AI** — three difficulty levels with a seeded, deterministic opponent.
- **2 Players** — shared-screen duel: the top player's rail and units are
  rotated 180° so both players see their own side upright.
- **No time limit** — the match ends only when one base falls. Every 60 seconds
  a pressure phase boosts energy regeneration and damage, so stalled matches
  always resolve.

The platform is a git submodule pinned at `v4.1.0`:

```bash
git clone --recurse-submodules <this-repo>
npm ci
npm run dev          # http://localhost:5175
```

## Rules

| Unit | Cost | Role |
| --- | --- | --- |
| Shield sheep | 2 | High HP, slow blocker |
| Archer sheep | 4 | Long range, fragile |
| Ram sheep | 5 | Fast, high damage |
| Healer sheep | 5 | Heals nearby allies, no attack |

- Select a card, then tap your half of the field to deploy into that lane.
- Units advance automatically, stop at the nearest enemy and attack.
- Base HP is 100. A unit at the enemy gate damages the base.
- Energy regenerates over time and faster while your base is damaged.
- Pause on blur or tab hide; resuming always runs a 3-2-1 countdown.

## Architecture

- `src/logic/` — pure rules: units, lanes, combat, pressure, AI, seeded RNG.
  No Phaser, DOM, audio or ad access.
- `src/scenes/` — `Menu` and `Game` scenes. Fixed 50 ms simulation step with
  render interpolation and queued deployment input.
- `src/ui/` — procedural sheep art, board, cards, HUD rails, layout, modals.
- `src/save.ts` — versioned profile (`wins`, `losses`, `bestSeconds`,
  `localMatches`) under `mg:yangyangdazuozhan:profile`.
- `src/i18n.ts` — 11 languages; Chinese and English are the reference.

All art is generated at runtime from Phaser Graphics or authored as SVG in this
repository. The game makes no external runtime requests and bundles no fonts.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server on port `5175` |
| `npm run check` | Typecheck, Biome and game boundary checks |
| `npm run test` | Vitest rules, AI and layout tests |
| `npm run build` | Production self-hosted build |
| `npm run package:web` | `<id>-web.zip` release asset |
| `npm run package:poki` | Poki build |
| `npm run package:crazy:basic` | CrazyGames lifecycle build |
| `npm run package:crazy:full` | CrazyGames lifecycle + ads build |

## Platform updates

```bash
cd platform
git fetch --tags
git checkout vX.Y.Z
cd ..
npm install
git add platform package-lock.json
git commit -m "chore: platform vX.Y.Z"
```

Do not edit `platform/` in place; changes belong in the platform repository.
