# Dart Counter

Private web app (French UI) for scoring X01 darts games (301/501) at home on a phone or tablet. Saved players with photos, dart-by-dart scoring on a clickable board or keypad, checkout suggestions, resumable games and per-player statistics. Backend with PostgreSQL, delivered with Docker Compose, no authentication.

This README is for the person who maintains the app alone: how to develop, deploy, back up, restore and update it.

## Contents

- [Local development](#local-development)
- [Deployment](#deployment)
- [Environment variables](#environment-variables)
- [HTTPS and the camera](#https-and-the-camera)
- [Backup and restore](#backup-and-restore)
- [Updating the app](#updating-the-app)
- [More documentation](#more-documentation)

## Local development

You need Node.js 24.21.0 or newer with npm, and Docker (to run a PostgreSQL database).

1. Install the dependencies: `npm ci`.
2. Copy `.env.example` to `.env`. The defaults point to a PostgreSQL on `localhost:5432` (user, password and database all `dart`) and store photos in `./data/uploads`.
3. Start a database. The Compose `db` service does not publish its port, so run a standalone one: `docker run -d --name dart-dev-db -p 5432:5432 -e POSTGRES_USER=dart -e POSTGRES_PASSWORD=dart -e POSTGRES_DB=dart postgres:17`.
4. Start the app with auto-reload: `npm run dev`. Open `http://localhost:3000`. The data tables are created at startup.

Checks, to run before every commit (the same ones as CI):

| Task                     | Command                                                                   |
| ------------------------ | ------------------------------------------------------------------------- |
| Lint                     | `npm run lint`                                                            |
| Format (write / check)   | `npm run format` / `npm run format:check`                                 |
| Type check               | `npm run typecheck`                                                       |
| Tests (no database)      | `npm test`                                                                |
| Integration tests        | `npm run test:integration` (needs `DATABASE_URL` to a reachable database) |
| Build                    | `npm run build`                                                           |
| Documentation link check | `npm run docs:links`                                                      |

More detail in [setup](docs/dev/setup.md) and [testing](docs/dev/testing.md).

## Deployment

On the computer that hosts the app (Docker with Compose installed):

1. Get the project folder (clone or download it).
2. Copy `.env.example` to `.env` and set at least `POSTGRES_PASSWORD` to a password of your choice. Set `PORT` if 3000 is already used. Set the password **before the first start**: PostgreSQL stores it in its volume at creation, and changing `.env` afterwards does not change it.
3. Start everything: `docker compose up -d --build`.

Two services run: `app` and `db` (PostgreSQL 17). The app waits for the database, creates or updates its tables by itself, then listens. Both restart automatically unless you stop them.

Useful commands:

- Status: `docker compose ps`. Logs: `docker compose logs -f app`.
- Health check: open `http://localhost:3000/api/health`; it shows `"status":"ok"`.
- Stop, keeping the data: `docker compose down`.
- **Stop and delete all data**: `docker compose down -v`. Never run this by accident.

From a phone or tablet on the same Wi-Fi, open `http://<computer address>:<PORT>`.

Data lives on two Docker named volumes: `pgdata` (the database) and `uploads` (player photos, mounted at `/data` in the app). Docker prefixes their names with the project folder name (for example `dart-counter_pgdata`); `docker volume ls` shows them.

## Environment variables

Set them in the `.env` file next to `docker-compose.yml`. Every variable has a default, so the file is optional.

| Variable            | Default                                    | Used by        | Meaning                                                                                                                                                           |
| ------------------- | ------------------------------------------ | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`              | `3000`                                     | Docker and dev | Port on which the app is published on the host (in Docker the app always listens on 3000 inside its container; outside Docker it is the port the app listens on). |
| `POSTGRES_USER`     | `dart`                                     | Docker         | PostgreSQL user, for the `db` service and the app.                                                                                                                |
| `POSTGRES_PASSWORD` | `dart`                                     | Docker         | PostgreSQL password. Change it before the first start.                                                                                                            |
| `POSTGRES_DB`       | `dart`                                     | Docker         | PostgreSQL database name.                                                                                                                                         |
| `DATABASE_URL`      | `postgres://dart:dart@localhost:5432/dart` | Outside Docker | PostgreSQL connection string. Docker Compose builds it from the three `POSTGRES_*` variables, so setting it in `.env` has no effect there.                        |
| `UPLOAD_DIR`        | `./data/uploads`                           | Outside Docker | Directory for uploaded photos. Docker Compose fixes it to `/data/uploads` on the `uploads` volume.                                                                |

## HTTPS and the camera

Browsers only allow camera capture (the live camera preview used to take a player's photo) on a secure page: HTTPS, or `localhost`. The app is served over plain HTTP on the home network, so opening it from a phone at `http://192.168.x.x:3000` does not get the live camera.

**HTTP fallback (works with no setup):** on a page that is not secure, the photo button opens the phone's own camera app through a file picker (`capture` attribute), and a second button picks an existing picture from the gallery. Photos are resized by the server either way. See [ADR 0004](docs/adr/0004-player-photos-and-web-pages.md).

**To get the live camera**, put the app behind an HTTPS reverse proxy (Caddy, nginx, Traefik, or a tunnel such as Tailscale Serve) with a certificate your devices trust, and open the app through its `https://` address. The app itself does not terminate TLS and the Compose file does not include a proxy.

## Backup and restore

Back up both volumes together, so players and their photos stay consistent. Run these from the project folder with the stack running (`docker compose up -d`). Commands are written for Linux/macOS shells.

### Database (`pgdata`)

Backup, as a plain SQL dump:

```
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > dart-db-backup.sql
```

Restore into an empty database (a fresh install, or after `docker compose down -v`). Stop the app first so nothing writes during the restore, then start it again:

```
docker compose up -d db
docker compose stop app
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < dart-db-backup.sql
docker compose start app
```

If the database already contains tables (the app creates them at startup), reset it first, which **erases the current data**:

```
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'
```

### Photos (`uploads`)

Backup, as a compressed archive:

```
docker compose exec -T app tar czf - -C /data uploads > dart-photos-backup.tar.gz
```

Restore (adds the files back into the volume, overwriting files with the same name):

```
docker compose exec -T app tar xzf - -C /data < dart-photos-backup.tar.gz
```

### Good habits

- Keep the two backup files together, dated, and copy them off the machine (USB drive, cloud storage).
- Do a restore test on another computer once, to be sure the backups work.
- Backing up Docker volumes at the file level (`/var/lib/docker/volumes/...`) while PostgreSQL runs is not safe; use `pg_dump` as above.

## Updating the app

1. Back up first (see above).
2. Get the new version: `git pull` (or replace the project folder's files, keeping your `.env`).
3. Check [`CHANGELOG.md`](CHANGELOG.md) for notes, and compare `.env.example` with your `.env` in case a new variable appeared.
4. Rebuild and restart: `docker compose up -d --build`. Only the changed services are recreated; the volumes, so your data, are kept.
5. Check `docker compose logs -f app`: new database migrations are applied automatically at startup. Then open `/api/health`.

To go back to the previous version: `git checkout <previous version>` and run `docker compose up -d --build` again. Migrations are not reversed, so if the new version changed the database, restore the database backup from step 1 as well.

Optionally, to update PostgreSQL's minor version, `docker compose pull db && docker compose up -d`. The major version (`postgres:17`) is pinned in `docker-compose.yml`; changing it needs a dump and restore, not just a restart.

## More documentation

- User guide: [`docs/user/`](docs/user/index.md), starting with [Getting started](docs/user/getting-started.md).
- Development: [architecture](docs/dev/architecture.md), [setup](docs/dev/setup.md), [testing](docs/dev/testing.md), [database](docs/dev/database.md), [decisions](docs/adr/0001-record-architecture-decisions.md).
- Instructions for agents: [`CLAUDE.md`](CLAUDE.md).
- Changes: [`CHANGELOG.md`](CHANGELOG.md).
