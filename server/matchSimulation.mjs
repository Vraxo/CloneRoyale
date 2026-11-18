export function createMatchSimulation(options) {
  const { rooms, broadcast, stepGame, simulationStep, saveReplay, randomBytes } = options;
  const reportError = options.reportError ?? (error => console.error("Match simulation error:", error));

  function advanceMatches() {
    for (const room of rooms.values()) {
      if (!room.state || room.state.gameOver || room.players.size !== 2 || [...room.players.values()].some(player => player.disconnected)) continue;

      const now = Date.now();
      const elapsed = Math.min((now - room.lastUpdate) / 1000, 0.1);
      room.lastUpdate = now;
      room.accumulator += elapsed;

      while (room.accumulator >= simulationStep) {
        stepGame(room.state, simulationStep, null, true);
        room.accumulator -= simulationStep;
      }

      broadcast(room, { type: "state", state: room.state });

      if (room.state.gameOver && !room.replaySent && room.replayRecorder) {
        room.replaySent = true;
        const replay = room.replayRecorder.finish(room.state);
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

      room.state.audioEvents = [];
    }
  }

  function start() {
    return setInterval(advanceMatches, simulationStep * 1000);
  }

  return { advanceMatches, start };
}
