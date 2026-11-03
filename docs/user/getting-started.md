# Getting started

How to run Dart Counter on a computer at home so you can use it from a phone or tablet on the same network.

## Before you start

Install Docker (with Docker Compose) on the computer that will host the app.

## Start the app

1. Download the project folder.
2. Optional: copy the file `.env.example` to `.env` and set `POSTGRES_PASSWORD` to a password of your choice.
3. In a terminal, in the project folder, run `docker compose up --build`.
4. Wait until the messages stop. The app and its database are now running.

## Open it

On the same computer, open `http://localhost:3000`. From a phone or tablet on the same Wi-Fi, use `http://` followed by the computer's address on your network, then `:3000`.

You should see the Dart Counter page. To check that the database is connected, open `/api/health`: it shows `"status":"ok"`.

## Stop the app

Press Ctrl+C in the terminal, or run `docker compose down`. Your data (database and uploaded photos) is kept on Docker volumes and is still there next time.
