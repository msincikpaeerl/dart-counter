# Dart Counter

Private web app (French UI) for scoring X01 darts games (301/501) at home on a phone or tablet. Saved players with photos, dart-by-dart scoring on a clickable board or keypad, checkout suggestions, resumable games and per-player statistics. Backend with PostgreSQL, delivered with Docker Compose, no authentication.

**Status:** bootstrapped (TypeScript, Fastify, PostgreSQL); no product feature yet. Run it with `docker compose up --build`.

## Documentation

- User guide: [`docs/user/`](docs/user/index.md), starting with [Getting started](docs/user/getting-started.md).
- Development: [architecture](docs/dev/architecture.md), [setup](docs/dev/setup.md), [testing](docs/dev/testing.md), [decisions](docs/adr/0001-record-architecture-decisions.md).
- Instructions for agents: [`CLAUDE.md`](CLAUDE.md).
- Changes: [`CHANGELOG.md`](CHANGELOG.md).
