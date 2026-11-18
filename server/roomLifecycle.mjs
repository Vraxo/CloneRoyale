export function createRoomLifecycle(options) {
  const {
    rooms,
    clients,
    reconnectTimers,
    randomBytes,
    createGame,
    ReplayRecorder,
    starterDeck,
    send,
    broadcast,
    playerSummaries,
    sendRoom,
    removeFromMatchmaking,
    reconnectGraceSeconds
  } = options;

  function attachPlayer(room, client, side) {
    client.room = room;
    client.side = side;
    room.players.set(client.id, client);
    send(client, {
      type: "assigned",
      side,
      code: room.publicMatch ? null : room.code,
      publicMatch: room.publicMatch,
      resumeToken: client.resumeToken,
      name: client.name
    });
    if (!room.publicMatch) sendRoom(room);
    if (room.players.size === 2 && [...room.players.values()].every(player => !player.disconnected)) {
      room.seed = randomBytes(4).readUInt32BE(0);
      room.state = createGame(room.seed);
      room.replayRecorder = new ReplayRecorder(room.seed, starterDeck, randomBytes(16).toString("hex"), "online");
      room.replaySent = false;
      room.lastUpdate = Date.now();
      broadcast(room, { type: "match-start", state: room.state, players: playerSummaries(room) });
    }
  }

  function makeCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 5; i += 1) code += alphabet[randomBytes(1)[0] % alphabet.length];
    return code;
  }

  function createRoom(client) {
    let code;
    do { code = makeCode(); } while (rooms.has(code));
    const room = { code, players: new Map(), state: null, lastUpdate: Date.now(), accumulator: 0, publicMatch: false };
    rooms.set(code, room);
    attachPlayer(room, client, "blue");
  }

  function leaveRoom(client) {
    const room = client.room;
    if (!room) return;
    const timer = reconnectTimers.get(client.resumeToken);
    if (timer) clearTimeout(timer);
    reconnectTimers.delete(client.resumeToken);
    room.players.delete(client.id);
    client.room = null;
    client.side = null;
    client.rematchReady = false;
    if (room.players.size === 0 || room.state) rooms.delete(room.code);
    if (room.players.size > 0) {
      broadcast(room, { type: "opponent-left" });
      if (!room.state) sendRoom(room);
    }
  }

  function requestRematch(client) {
    const room = client.room;
    if (!room?.state?.gameOver || !client.side || client.disconnected) return;
    client.rematchReady = true;
    const ready = [...room.players.values()].filter(player => player.rematchReady && !player.disconnected).length;
    broadcast(room, { type: "rematch-status", ready, total: room.players.size });
    if (room.players.size !== 2 || ready !== 2) return;
    for (const player of room.players.values()) player.rematchReady = false;
    room.seed = randomBytes(4).readUInt32BE(0);
    room.state = createGame(room.seed);
    room.replayRecorder = new ReplayRecorder(room.seed, starterDeck, randomBytes(16).toString("hex"), "online");
    room.replaySent = false;
    room.lastUpdate = Date.now();
    room.accumulator = 0;
    broadcast(room, { type: "rematch-start", state: room.state, players: playerSummaries(room) });
  }

  function resumePlayer(client, token) {
    if (typeof token !== "string" || token.length < 24 || token.length > 128) {
      send(client, { type: "resume-failed" });
      return;
    }
    for (const room of rooms.values()) {
      const player = [...room.players.values()].find(candidate => candidate.resumeToken === token);
      if (!player || !player.disconnected) continue;
      const timer = reconnectTimers.get(token);
      if (timer) clearTimeout(timer);
      reconnectTimers.delete(token);
      room.players.delete(player.id);
      client.room = room;
      client.side = player.side;
      client.resumeToken = token;
      client.name = player.name;
      client.disconnected = false;
      client.queued = false;
      client.rematchReady = false;
      room.players.set(client.id, client);
      clients.add(client);
      send(client, {
        type: "resumed",
        side: client.side,
        code: room.publicMatch ? null : room.code,
        publicMatch: room.publicMatch,
        state: room.state,
        resumeToken: token,
        name: client.name,
        players: playerSummaries(room)
      });
      for (const opponent of room.players.values()) {
        if (opponent !== client && !opponent.disconnected) send(opponent, { type: "opponent-reconnected", side: client.side });
      }
      if (room.state && room.players.size === 2) room.lastUpdate = Date.now();
      else sendRoom(room);
      return;
    }
    send(client, { type: "resume-failed" });
  }

  function closeClient(client) {
    if (client.closed) return;
    client.closed = true;
    removeFromMatchmaking(client);
    clients.delete(client.id);
    if (client.room && client.room.state && !client.room.state.gameOver) {
      const room = client.room;
      client.disconnected = true;
      client.socket = null;
      broadcast(room, { type: "opponent-disconnected", graceSeconds: reconnectGraceSeconds });
      const timer = setTimeout(() => {
        reconnectTimers.delete(client.resumeToken);
        if (!client.disconnected || client.room !== room) return;
        leaveRoom(client);
      }, reconnectGraceSeconds * 1000);
      reconnectTimers.set(client.resumeToken, timer);
      return;
    }
    leaveRoom(client);
    client.socket?.end();
  }

  return { attachPlayer, createRoom, leaveRoom, requestRematch, resumePlayer, closeClient };
}
