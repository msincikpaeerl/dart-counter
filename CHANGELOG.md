# Changelog

User-facing changes, newest first. One entry per merged ticket with a user-visible effect, written for users.

## Unreleased

- Games are now **simple out** by default: any dart that brings the score exactly to zero wins. A new **Double out forcé** option on the player create/edit screen makes a player finish on a double or the bull only (leaving 1 or reaching zero otherwise is a bust). Each player is judged by their own option and checkout suggestions follow it; existing players are simple out; see [Managing players](docs/user/players.md) and [Playing a game](docs/user/playing.md).

- New **Statistiques** screen: per-player games played and won, win %, 3-dart average (bust darts count 0 points), best visit, 180s, visits of 100+ and highest checkout, plus a history of finished games where each visit can be opened; abandoned and unfinished games are left out and archived players keep their figures; see [Statistics and game history](docs/user/statistics.md).

- Unfinished games: opening the app now offers **Reprendre la partie** (scores, player and current turn restored, on any device) or **Abandonner** (the game is kept but left out of statistics); see [Resuming or abandoning a game](docs/user/resume-game.md).

- Keypad input on the game screen: switch between **Cible** and **Pavé numérique** during a game and enter darts with Simple / Double / Triple and 1–20, 25, Bull; the first checkout target now also blinks on the keypad; see [Playing a game](docs/user/playing.md).

- New game screen with a clickable dartboard: tap where each dart landed, miss, end a turn, undo as many times as needed, checkout hints, bust handling, and a winner window with **Rejouer**; every dart is saved as it is thrown; see [Playing a game](docs/user/playing.md).

- New game setup screen (home page): choose 301 or 501, select the players, draw the play order at random and start the game; see [Starting a game](docs/user/new-game.md).
- New **Joueurs** screen: create players (name, nickname, photo from the camera or the gallery), edit them and archive them; see [Managing players](docs/user/players.md).
- The app can now be started with Docker Compose (app and database); see [Getting started](docs/user/getting-started.md).
- Docker Compose packaging finished: settings (port, database password) come from a `.env` file, the app waits for its database and prepares the tables by itself, and players and photos are kept across `docker compose down` and `up`.
