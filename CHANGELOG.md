# Changelog

User-facing changes, newest first. One entry per merged ticket with a user-visible effect, written for users.

## Unreleased

- New **Joueurs** screen: create players (name, nickname, photo from the camera or the gallery), edit them and archive them; see [Managing players](docs/user/players.md).
- The app can now be started with Docker Compose (app and database); see [Getting started](docs/user/getting-started.md).
- Docker Compose packaging finished: settings (port, database password) come from a `.env` file, the app waits for its database and prepares the tables by itself, and players and photos are kept across `docker compose down` and `up`.
