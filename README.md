# Clone Royale

A browser-based, top-down real-time battle prototype. The initial goal is to validate the battle simulation and a small 2D articulated-character visual language before expanding the card roster.

## Current prototype

- PixiJS 8 rendering with vector-drawn characters and battlefield.
- TypeScript simulation kept independent from rendering.
- Fixed-step simulation with seeded, repeatable matches.
- Two AI controllers using the same card-play interface.
- Eight-card starter deck definitions: Giant, Archers, Mini P.E.K.K.A, Baby Dragon, Skeleton Army, Cannon, Fireball, and Arrows.
- Elixir, card cycling, towers, unit targeting, projectiles, splash damage, and match end conditions.
- Pause, single-step, speed control, and restart controls.
- Responsive browser layout intended for desktop and mobile.

The vector characters are deliberately a first-pass visual experiment, not final card art. They should make combat readable while the simulation is developed.

## Requirements

- Node.js 20.19 or newer.
- npm.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The development server binds to all interfaces, so a phone on the same network can also open the machine's LAN address and port.

## Verify

```sh
npm run typecheck
npm run build
```

## Architecture

- `src/game/types.ts`: simulation data contracts.
- `src/game/cards.ts`: card definitions and starter deck.
- `src/game/bot.ts`: decision-making only; emits card-play decisions.
- `src/game/simulation.ts`: deterministic game rules and state transitions.
- `src/render/arenaRenderer.ts`: PixiJS-only presentation.
- `src/main.ts`: browser lifecycle, fixed-step loop, and controls.

The simulation does not import PixiJS or access the DOM. Keep that boundary intact: rendering must never decide whether an attack hits or how much damage is dealt.

## Next milestones

1. Validate and improve the battle simulation with repeatable AI-vs-AI matches.
2. Refine the first articulated skeleton and humanoid rig.
3. Add human card placement and a playable human-vs-AI mode.
4. Improve pathing, unit separation, targeting rules, and balance.
5. Add multiplayer only after local battles are reliable.
