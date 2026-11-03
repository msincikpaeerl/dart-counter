import { DuplicatePlayerNameError, type Database, type Player } from '../../src/server/db.js';

/** In-memory stand-in for the database, with the same player rules (unique name ignoring case). */
export function createMemoryDb(options: { down?: boolean } = {}): Database {
  const players: Player[] = [];
  let nextId = 1;

  function assertUnique(name: string, exceptId?: number) {
    const taken = players.some(
      (p) => p.id !== exceptId && p.name.toLowerCase() === name.toLowerCase(),
    );
    if (taken) throw new DuplicatePlayerNameError();
  }

  return {
    async ping() {
      if (options.down) throw new Error('down');
    },
    async close() {},
    async listPlayers() {
      return players
        .filter((p) => !p.archived)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => ({ ...p }));
    },
    async getPlayer(id) {
      const found = players.find((p) => p.id === id);
      return found ? { ...found } : null;
    },
    async createPlayer(input) {
      assertUnique(input.name);
      const player: Player = { id: nextId++, ...input, archived: false };
      players.push(player);
      return { ...player };
    },
    async updatePlayer(id, changes) {
      const player = players.find((p) => p.id === id);
      if (!player) return null;
      assertUnique(changes.name, id);
      player.name = changes.name;
      player.nickname = changes.nickname;
      if (changes.photoPath !== undefined) player.photoPath = changes.photoPath;
      return { ...player };
    },
    async archivePlayer(id) {
      const player = players.find((p) => p.id === id);
      if (!player) return null;
      player.archived = true;
      return { ...player };
    },
  };
}
