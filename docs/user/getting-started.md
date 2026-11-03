# Getting started

How to run Dart Counter on a computer at home so you can use it from a phone or tablet on the same network.

## Before you start

Install Docker (with Docker Compose) on the computer that will host the app.

## Start the app

1. Download the project folder.
2. Copy the file `.env.example` to `.env`. Set `POSTGRES_PASSWORD` to a password of your choice, and `PORT` if port 3000 is already used on your computer. Without a `.env` file, the defaults of `.env.example` apply.
3. In a terminal, in the project folder, run `docker compose up -d --build`.
4. Wait a few seconds. The app waits for its database to be ready, creates or updates the data tables by itself, then starts.

To follow what is happening, run `docker compose logs -f app`.

## Open it

On the same computer, open `http://localhost:3000` (replace 3000 with your `PORT` if you changed it). From a phone or tablet on the same Wi-Fi, use `http://` followed by the computer's address on your network, then `:` and the port.

You should see the Dart Counter page. To check that the database is connected, open `/api/health`: it shows `"status":"ok"`.

## Stop the app

Run `docker compose down`. Your data (players, games and photos) is kept on Docker volumes and is still there after the next `docker compose up -d`. Only `docker compose down -v` deletes it.
