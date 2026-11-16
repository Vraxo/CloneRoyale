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

## Online multiplayer

The app runs as a single Node service that serves the Vite client and hosts the authoritative WebSocket match server. Players can enter a public FIFO matchmaking queue and be paired automatically, or create private rooms with five-character invite codes. Players join as guests, with no account or password storage.

```sh
npm run build
npm start
```

Open the app and choose **Online play**. Use **Find match** in two browser sessions to be paired automatically, or use **Create private room** and share its code. For deployment, the included `render.yaml` describes a Render web service. Import the repository into Render and deploy the Blueprint. The free instance may sleep when idle, and room state is in memory, so active rooms are lost if the service restarts.

## Next milestones

1. Add reconnection and safe handling for interrupted public matches.
2. Add matchmaking protections and queue observability.
3. Add persistent player accounts, profiles, and match history.
4. Introduce skill-based matchmaking once enough real matches exist.
