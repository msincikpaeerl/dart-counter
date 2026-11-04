import {
  DuplicatePlayerNameError,
  type DartRecord,
  type Database,
  type Game,
  type Player,
} from '../../src/server/db.js';

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

  const games: Game[] = [];
  const darts = new Map<number, DartRecord[]>();
  const results = new Map<number, { winnerId: number; finishedAt: string }>();

  return {
    async createGame(mode, playerIds) {
      const game: Game = {
        id: games.length + 1,
        mode,
        status: 'in_progress',
        players: playerIds.map((id) => {
          const found = players.find((p) => p.id === id);
          if (!found) throw new Error('Unknown player');
          return { ...found };
        }),
      };
      games.push(game);
      return structuredClone(game);
    },
    async getGame(id) {
      const found = games.find((g) => g.id === id);
      return found ? structuredClone(found) : null;
    },
    async getUnfinishedGame() {
      const found = [...games].reverse().find((g) => g.status === 'in_progress');
      return found ? structuredClone(found) : null;
    },
    async abandonGame(id) {
      const found = games.find((g) => g.id === id);
      if (found && found.status === 'in_progress') found.status = 'abandoned';
    },
    async listDarts(gameId) {
      return structuredClone(darts.get(gameId) ?? []);
    },
    async addDart(gameId, dart) {
      darts.set(gameId, [...(darts.get(gameId) ?? []), { ...dart }]);
    },
    async removeLastDart(gameId) {
      darts.set(gameId, (darts.get(gameId) ?? []).slice(0, -1));
    },
    async setWinner(gameId, winnerId) {
      const found = games.find((g) => g.id === gameId);
      if (!found) return;
      found.status = winnerId === null ? 'in_progress' : 'finished';
      if (winnerId === null) results.delete(gameId);
      else
        results.set(gameId, { winnerId, finishedAt: new Date(Date.now() + gameId).toISOString() });
    },
    async listFinishedGames() {
      return games
        .filter((g) => g.status === 'finished')
        .map((g) => {
          const result = results.get(g.id);
          return {
            ...structuredClone(g),
            // Players are read again so that archiving is reflected, as in the real database.
            players: g.players.map((p) => ({ ...(players.find((q) => q.id === p.id) ?? p) })),
            winnerId: result?.winnerId ?? null,
            startedAt: result?.finishedAt ?? new Date(0).toISOString(),
            finishedAt: result?.finishedAt ?? new Date(0).toISOString(),
          };
        })
        .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
    },
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
      const player: Player = {
        id: nextId++,
        ...input,
        doubleOut: input.doubleOut ?? false,
        archived: false,
      };
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
      if (changes.doubleOut !== undefined) player.doubleOut = changes.doubleOut;
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
