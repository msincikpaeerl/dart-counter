import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { DuplicatePlayerNameError, type Database, type Player } from './db.js';
import { deletePhoto, InvalidImageError, savePhoto } from './photos.js';

const MAX_NAME_LENGTH = 40;
const MAX_PHOTO_BYTES = 20 * 1024 * 1024;

/** A player as sent to the browser. */
export function present(player: Player) {
  return {
    id: player.id,
    name: player.name,
    nickname: player.nickname,
    photoUrl: player.photoPath ? `/uploads/${player.photoPath}` : null,
    doubleOut: player.doubleOut,
  };
}

interface Form {
  name: string;
  nickname: string | null;
  doubleOut: boolean;
  photo: Buffer | null;
  removePhoto: boolean;
}

class FormError extends Error {}

async function readForm(request: FastifyRequest): Promise<Form> {
  const form: Form = {
    name: '',
    nickname: null,
    doubleOut: false,
    photo: null,
    removePhoto: false,
  };
  for await (const part of request.parts({ limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } })) {
    if (part.type === 'file') {
      const data = await part.toBuffer();
      if (part.file.truncated) throw new FormError('La photo est trop volumineuse.');
      if (data.length > 0) form.photo = data;
    } else if (part.fieldname === 'name') {
      form.name = String(part.value).trim();
    } else if (part.fieldname === 'nickname') {
      form.nickname = String(part.value).trim() || null;
    } else if (part.fieldname === 'doubleOut') {
      form.doubleOut = part.value === '1';
    } else if (part.fieldname === 'removePhoto') {
      form.removePhoto = part.value === '1';
    }
  }
  if (!form.name) throw new FormError('Le nom est obligatoire.');
  if (form.name.length > MAX_NAME_LENGTH || (form.nickname?.length ?? 0) > MAX_NAME_LENGTH) {
    throw new FormError(`Le nom et le surnom font ${MAX_NAME_LENGTH} caractères au maximum.`);
  }
  return form;
}

export function registerPlayerRoutes(app: FastifyInstance, db: Database, uploadDir: string): void {
  app.get('/api/players', async () => (await db.listPlayers()).map(present));

  app.post('/api/players', async (request, reply) => {
    let photoPath: string | null = null;
    try {
      const form = await readForm(request);
      if (form.photo) photoPath = await savePhoto(uploadDir, form.photo);
      const player = await db.createPlayer({
        name: form.name,
        nickname: form.nickname,
        photoPath,
        doubleOut: form.doubleOut,
      });
      return reply.code(201).send(present(player));
    } catch (error) {
      await deletePhoto(uploadDir, photoPath);
      return sendError(reply, error);
    }
  });

  app.put<{ Params: { id: string } }>('/api/players/:id', async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isSafeInteger(id)) return reply.code(404).send({ error: 'Joueur introuvable.' });
    let newPhoto: string | null = null;
    try {
      const form = await readForm(request);
      const current = await db.getPlayer(id);
      if (!current) return reply.code(404).send({ error: 'Joueur introuvable.' });
      if (form.photo) newPhoto = await savePhoto(uploadDir, form.photo);
      const photoPath = newPhoto ?? (form.removePhoto ? null : undefined);
      const player = await db.updatePlayer(id, {
        name: form.name,
        nickname: form.nickname,
        photoPath,
        doubleOut: form.doubleOut,
      });
      if (!player) {
        await deletePhoto(uploadDir, newPhoto);
        return reply.code(404).send({ error: 'Joueur introuvable.' });
      }
      if (photoPath !== undefined) await deletePhoto(uploadDir, current.photoPath);
      return present(player);
    } catch (error) {
      await deletePhoto(uploadDir, newPhoto);
      return sendError(reply, error);
    }
  });

  app.post<{ Params: { id: string } }>('/api/players/:id/archive', async (request, reply) => {
    const id = Number(request.params.id);
    const player = Number.isSafeInteger(id) ? await db.archivePlayer(id) : null;
    if (!player) return reply.code(404).send({ error: 'Joueur introuvable.' });
    return present(player);
  });
}

function sendError(reply: FastifyReply, error: unknown) {
  if (error instanceof FormError) return reply.code(400).send({ error: error.message });
  if (error instanceof DuplicatePlayerNameError) {
    return reply.code(409).send({ error: 'Un joueur porte déjà ce nom. Choisissez un autre nom.' });
  }
  if (error instanceof InvalidImageError) {
    return reply.code(400).send({ error: 'Cette image est illisible. Essayez une autre photo.' });
  }
  throw error;
}
