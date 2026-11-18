export function createMatchmaking(options) {
  const { queue, rooms, randomBytes, attachPlayer, isSocketUsable, send, maxQueue } = options;

  function broadcastQueueStatus() {
    const waiting = queue.length;
    queue.forEach((client, index) => {
      send(client, { type: "queue-status", waiting, position: index + 1 });
    });
  }

  function prune() {
    let changed = false;
    for (let index = queue.length - 1; index >= 0; index -= 1) {
      const client = queue[index];
      if (isSocketUsable(client) && !client.room) continue;
      queue.splice(index, 1);
      client.queued = false;
      changed = true;
    }
    if (changed) broadcastQueueStatus();
    return changed;
  }

  function remove(client, notify = false) {
    const index = queue.indexOf(client);
    if (index < 0) return false;
    queue.splice(index, 1);
    client.queued = false;
    if (notify) send(client, { type: "queue-cancelled" });
    broadcastQueueStatus();
    return true;
  }

  function startMatchedRoom(first, second) {
    if (!isSocketUsable(first) || !isSocketUsable(second) || first.room || second.room) return false;
    first.queued = false;
    second.queued = false;
    const room = {
      code: "PUBLIC-" + randomBytes(8).toString("hex"),
      players: new Map(),
      state: null,
      lastUpdate: Date.now(),
      accumulator: 0,
      publicMatch: true
    };
    rooms.set(room.code, room);
    attachPlayer(room, first, "blue");
    attachPlayer(room, second, "red");
    return true;
  }

  function join(client) {
    if (!isSocketUsable(client)) return;
    if (client.room) {
      send(client, { type: "error", message: "Leave your current room before searching for another match." });
      return;
    }
    prune();
    if (client.queued) {
      const index = queue.indexOf(client);
      send(client, { type: "queue-status", waiting: queue.length, position: index + 1 });
      return;
    }
    let opponent = null;
    while (queue.length > 0 && !opponent) {
      const candidate = queue.shift();
      candidate.queued = false;
      if (isSocketUsable(candidate) && !candidate.room) opponent = candidate;
    }
    if (opponent) {
      client.queued = false;
      if (!startMatchedRoom(opponent, client)) {
        if (isSocketUsable(opponent) && !opponent.room) {
          queue.unshift(opponent);
          opponent.queued = true;
        }
        if (queue.length < maxQueue) {
          queue.push(client);
          client.queued = true;
        } else {
          send(client, { type: "error", message: "The matchmaking queue is full. Please try again shortly." });
        }
      }
      broadcastQueueStatus();
      return;
    }
    if (queue.length >= maxQueue) {
      send(client, { type: "error", message: "The matchmaking queue is full. Please try again shortly." });
      return;
    }
    queue.push(client);
    client.queued = true;
    broadcastQueueStatus();
  }

  return { join, remove, prune, get size() { return queue.length; } };
}
