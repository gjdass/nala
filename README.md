# nala
Open source baby life tracker PWA for parents you can run easily with docker

## Deploy with Docker Compose

Nala runs as three containers: `db` (PostgreSQL), `api` (.NET) and `web` (nginx serving the app and proxying `/api`). Only `web` publishes a port. The images are built on the host.

### Requirements

- Docker with the Compose plugin (`docker compose`)
- Git

### First start

```sh
git clone <this repository> nala
cd nala
cp .env.example .env
# edit .env: set POSTGRES_PASSWORD (and NALA_HTTP_PORT if 8080 is taken)
docker compose up -d --build
```

Open `http://<host>:8080`. The API applies database migrations itself at startup.

| Variable | Purpose |
|---|---|
| `NALA_HTTP_PORT` | Host port the app is served on (default `8080`) |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Database created on the first start. Change the password before starting the first time: later edits don't change an existing database. |

### HTTPS

The stack serves plain HTTP. Browsers only install the app and run its service worker (offline support) over HTTPS, except on `localhost`. Put your own TLS reverse proxy (Caddy, Traefik, nginx…) in front of `NALA_HTTP_PORT`.

Logging in needs HTTPS too: the session cookie is `Secure`, so over plain HTTP the browser drops it and you are never logged in (Chrome and Firefox make an exception for `http://localhost`).

### Update

```sh
git pull
docker compose up -d --build
```

### Data

The database lives in the `nala-db` named volume. It survives `docker compose down` and rebuilds, but `docker compose down -v` deletes it.

### Checks

```sh
node --test "tests/**/*.test.mjs"   # compose and Dockerfile checks (needs Docker and Node)
tests/deploy/smoke.sh               # builds and starts the stack from a clean copy, checks the app and /api/health
```
