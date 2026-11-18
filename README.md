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

- Node.js 20.19 or newer (includes npm).
- Tailscale, if you want to make your game publicly accessible through the included launcher.

## Start the game (recommended)

On Windows, install Tailscale, sign in, and enable Tailscale Funnel for your tailnet once. Then double-click **Start Clone Royale.cmd**.

The launcher installs dependencies when needed, builds the game, starts the server, and enables the public Funnel URL. It prints both the local address and your public address. Friends can open the public address in their browsers; they do not need Tailscale.

Keep Tailscale running while you host. The game server runs in a separate minimized window; close that window to stop the server.

## Run locally / development

If you only want to run the game on your own machine or your local network, use:

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

## Online multiplayer

The app runs as a single Node service that serves the Vite client and hosts the authoritative WebSocket match server. Players can enter a public FIFO matchmaking queue and be paired automatically, or create private rooms with five-character invite codes. Players can still join as guests. Optional accounts are available through the HTTP API; account registration and login UI will be added separately.

For manual production-style startup:

```sh
npm run build
npm start
```

Open the app and choose **Online play**. Use **Find match** in two browser sessions to be paired automatically, or use **Create private room** and share its code. The recommended `Start Clone Royale.cmd` launcher runs the multiplayer server directly on your Windows PC and exposes it through **Tailscale Funnel**. There is no hosted application server in this setup: your PC is the host, and it must remain powered on with the server window and Tailscale running for others to connect. The optional `render.yaml` is an unused deployment template; the launcher does not use Render.\n\nCompleted real PvP matches are archived on the host PC under `data/replays/` (relative to the repository root) and appear in the public Replay Library automatically. Replays are written to disk, so they survive stopping and restarting the Node server, rebuilding the client, and rebooting Windows. The archive is not automatically backed up or replicated to other devices: back up this folder if you want to protect or migrate it. Set `CLONEROYALE_REPLAY_DIR` before starting the server to use a different archive directory.

## Accounts and authentication\n\nAccount registration and login are available at `POST /api/auth/register` and `POST /api/auth/login`. Both accept JSON with `username` and `password`, and return an account profile with an HttpOnly session cookie. `GET /api/auth/me` returns the signed-in account (or `null` for guests), and `POST /api/auth/logout` revokes the current session. Passwords are stored as salted scrypt hashes; session tokens are random, stored only as SHA-256 hashes, and expire after 30 days. Authentication attempts are rate-limited per remote IP. Guest play and existing multiplayer behavior remain available without an account.\n\nAccount data is stored on the host PC in `data/accounts/accounts.json` by default, separate from replay files and excluded from Git. Set `CLONEROYALE_ACCOUNT_FILE` to move the file to another location. Back up this file securely: it contains password hashes and active session hashes.\n\n## Architecture

- `src/game/types.ts`: simulation data contracts.
- `src/game/cards.ts`: card definitions and starter deck.
- `src/game/bot.ts`: decision-making only; emits card-play decisions.
- `src/game/simulation.ts`: deterministic game rules and state transitions.
- `src/render/arenaRenderer.ts`: PixiJS-only presentation.
- `src/main.ts`: browser lifecycle, fixed-step loop, and controls.

The simulation does not import PixiJS or access the DOM. Keep that boundary intact: rendering must never decide whether an attack hits or how much damage is dealt.

## Server architecture

The authoritative multiplayer server is written in TypeScript under `server/`. Its entry point is `server/index.ts`; focused modules handle WebSocket transport, HTTP requests, matchmaking, room lifecycle, client messages, match simulation, and replay archiving. The production build compiles the server to `dist-server/index.js`, which is what `npm start` runs. The standalone simulation and service bundles are also built for automated tests.

## Next milestones

1. Add reconnection and safe handling for interrupted public matches.
2. Add matchmaking protections and queue observability.
3. Add account registration and login UI, then attach account identities to player profiles and match history.
4. Introduce skill-based matchmaking once enough real matches exist.
