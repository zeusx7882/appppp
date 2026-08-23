# Free Drop Keys API

Production-ready REST API for validating Free Drop game keys.

## Stack
- Node.js + Express + TypeScript
- Prisma ORM
- PostgreSQL

## Environment
Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Required variables:

- `DATABASE_URL` (PostgreSQL connection string)
- `PORT` (optional, default `3001`)
- `NODE_ENV` (optional, default `development`)

## Install & Setup

```bash
npm install
npm run prisma:generate
npm run prisma:push
npm run dev
```

## Scripts

- `npm run dev` - run server with watch mode
- `npm run build` - compile TypeScript to `dist/`
- `npm run typecheck` - run strict TS type-check
- `npm run start` - start compiled server
- `npm run prisma:generate` - generate Prisma client
- `npm run prisma:migrate` - create/apply Prisma migrations (dev)
- `npm run prisma:push` - push schema to database

## Prisma Data Model

`prisma/schema.prisma` defines:

- `Key` model (`id`, `key`, `gameAppId`, `gameName`, `status`, `usedAt`, `createdAt`)
- `KeyStatus` enum (`AVAILABLE`, `USED`)

## API

Base routes:
- `GET /` and `GET /health` -> service status
- Key routes under `/api/keys`

### POST `/api/keys/validate`
Validates and atomically consumes an available key.

Request:
```json
{ "key": "GAMEKEY-abc123" }
```

Success (`200`):
```json
{
  "success": true,
  "game": {
    "appId": "1174180",
    "name": "Sample Game"
  }
}
```

Possible errors:
- `400` invalid/missing/empty key
- `404` key not found
- `400` key already used
- `500` internal server error (safe, no internals leaked)

### POST `/api/keys/check`
Checks if the key exists and is available **without consuming it**.

Request:
```json
{ "key": "GAMEKEY-abc123" }
```

Existing key (`200`):
```json
{
  "exists": true,
  "valid": true,
  "status": "AVAILABLE",
  "game": {
    "appId": "1174180",
    "name": "Sample Game"
  }
}
```

Missing key (`404`):
```json
{
  "exists": false,
  "valid": false
}
```

## Key Management (Safe Workflow)

This API intentionally does **not** expose a public admin key-creation endpoint.
Use Prisma workflows instead:

- `npx prisma studio` for manual key management
- or create controlled scripts/seeds run by trusted operators only

## Production Notes

- Request JSON body is size-limited.
- `x-powered-by` header is disabled.
- Prisma disconnects gracefully on shutdown signals.
- Error responses avoid exposing stack traces or `DATABASE_URL`.

## Verification

Run:

```bash
npm run prisma:generate
npm run typecheck
npm run build
```

Then test endpoints locally with curl/Postman.
