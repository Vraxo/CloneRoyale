import type { BattleReplay } from "../../src/game/replay.js";
import type { GameState, Side } from "../../src/game/types/index.js";
import type { RandomBytes, ServerRoom } from "../core/types.js";

interface MatchSimulationOptions {
  rooms: Map<string, ServerRoom>;
  broadcast: (room: ServerRoom, payload: Record<string, unknown>) => void;
  stepGame: (state: GameState, delta: number, botSide: Side | null, online: boolean) => void;
  simulationStep: number;
  saveReplay: (replay: BattleReplay, shareToken: string) => Promise<void>;
  randomBytes: RandomBytes;
  reportError?: (error: unknown) => void;
}

export function createMatchSimulation(options: MatchSimulationOptions) {
  const { rooms, broadcast, stepGame, simulationStep, saveReplay, randomBytes } = options;
  const reportError = options.reportError ?? (error => console.error("Match simulation error:", error));

  function advanceMatches(): void {
    for (const room of rooms.values()) {
      const state = room.state;
      if (!state || state.gameOver || room.players.size !== 2 || [...room.players.values()].some(player => player.disconnected)) continue;

      const now = Date.now();
      const elapsed = Math.min((now - room.lastUpdate) / 1000, 0.1);
      room.lastUpdate = now;
      room.accumulator += elapsed;

      while (room.accumulator >= simulationStep) {
        stepGame(state, simulationStep, null, true);
        room.accumulator -= simulationStep;
      }

      broadcast(room, { type: "state", state });

      if (state.gameOver && !room.replaySent && room.replayRecorder) {
        room.replaySent = true;
        const replay = room.replayRecorder.finish(state);
        replay.players = {
          blue: [...room.players.values()].find(player => player.side === "blue")?.name ?? "Blue",
          red: [...room.players.values()].find(player => player.side === "red")?.name ?? "Red"
        };

        const shareToken = randomBytes(32).toString("hex");
        void saveReplay(replay, shareToken)
          .then(() => broadcast(room, { type: "match-replay", replay, shareToken }))
          .catch(error => {
            reportError(error);
            broadcast(room, { type: "match-replay", replay });
          });
      }

      state.audioEvents = [];
    }
  }

  function start(): ReturnType<typeof setInterval> {
    return setInterval(advanceMatches, simulationStep * 1000);
  }

  return { advanceMatches, start };
}
