# Free Drop Keys API

API REST para validação de keys Free Drop, pronta para deploy em Node.js + PostgreSQL com Prisma.

## Stack
- Node.js + Express + TypeScript
- Prisma ORM
- PostgreSQL

## Variáveis de ambiente / Environment
Copie o exemplo:

```bash
cp .env.example .env
```

Obrigatórias em produção:
- `DATABASE_URL` (conexão PostgreSQL)

Opcional:
- `PORT` (default `3001`; em produção a plataforma injeta esse valor)
- `NODE_ENV` (`production` recomendado em deploy)

> Nunca commite credenciais reais.

## Scripts
- `npm run dev` - desenvolvimento (watch)
- `npm run typecheck` - checagem TypeScript
- `npm run build` - build para `dist/`
- `npm run start` - inicia API compilada
- `npm run prisma:generate` - gera Prisma Client
- `npm run prisma:migrate` - migrações locais (dev)
- `npm run prisma:push` - aplica schema sem migration (setup rápido)
- `npm run prisma:deploy` - aplica migrations em produção
- `npm run db:setup` - setup inicial do banco para desenvolvimento

## Deploy na ShardCloud
Configuração recomendada da aplicação:

- **Build command**:
  ```bash
  npm install && npm run prisma:generate && npm run build
  ```
- **Start command**:
  ```bash
  npm run start
  ```
- **Environment variables**:
  - `DATABASE_URL`
  - `NODE_ENV=production`
  - `PORT` (geralmente fornecida pela própria ShardCloud)

### Domínio
Após criar o app na ShardCloud, configure o domínio público para:

`https://byzeuskeys.shardweb.app`

Este repositório apenas prepara a API; o apontamento/configuração final do domínio é feito no painel da ShardCloud.

## Modelo de dados
- `Admin` (tabela `admins`) - preservado, não é alterado pela API.
- `Game` - `appId` e `name` do jogo.
- `Key` - `key`, `gameId` (relação com `Game`), `status` (`AVAILABLE`/`USED`) e os campos
  opcionais de rastreio de resgate: `usedAt`, `usedBy`, `usedByUsername`, `redeemedAt`.

> Os campos de rastreio são opcionais (`?`), portanto adicioná-los ao banco não apaga dados.
> Se eles ainda não existirem no banco de produção, execute `npx prisma db push` apontando
> para a `DATABASE_URL` correta **antes** de usar `/api/keys/redeem` e `/api/keys/activated`.
> Nunca use `--accept-data-loss`.

## Rotas da API
Todas as rotas de key ficam sob o prefixo `/api/keys` (montado uma única vez em `src/index.ts`,
portanto a URL final é `/api/keys/...` e nunca `/api/api/keys/...`).

- `GET /` e `GET /health`
- `POST /api/keys/redeem`
- `GET /api/keys/activated?discordId=...`
- `POST /api/keys/validate`
- `POST /api/keys/check`

### POST `/api/keys/redeem`
Body:
```json
{ "key": "GAMEKEY-ABC123", "discordId": "123456789", "discordUsername": "usuario" }
```

Sucesso (`200`):
```json
{
  "success": true,
  "appId": "1174180",
  "gameName": "Sample Game",
  "message": "Key resgatada com sucesso!"
}
```

Erros:
- `400` `{ "success": false, "message": "Key inválida" }` / `"discordId inválido"`
- `404` `{ "success": false, "message": "Key não encontrada" }`
- `400` `{ "success": false, "message": "Você já resgatou esta key" }` (mesmo `discordId`)
- `400` `{ "success": false, "message": "Esta key já foi utilizada" }` (outro usuário)
- `500` `{ "success": false, "message": "Erro interno" }`

A key é normalizada com `trim().toUpperCase()` (com fallback para o valor original em caso
de keys gravadas em minúsculas) e o resgate usa `updateMany` condicionado a
`status = AVAILABLE`, o que evita corrida entre duas requisições simultâneas.

### GET `/api/keys/activated?discordId=...`
Sucesso (`200`):
```json
{
  "games": [
    { "appId": "1174180", "gameName": "Sample Game", "key": "GAMEKEY-ABC123", "activatedAt": "2025-01-01T00:00:00.000Z" }
  ]
}
```

Sem `discordId` retorna `{ "games": [] }`.

Base pública pretendida após deploy:

`https://byzeuskeys.shardweb.app`

### POST `/api/keys/validate`
Body:
```json
{ "key": "GAMEKEY-abc123" }
```

Sucesso (`200`):
```json
{
  "success": true,
  "game": { "appId": "1174180", "name": "Sample Game" }
}
```

Erros:
- `400` key inválida/ausente/vazia
- `404` key não encontrada
- `400` key já utilizada
- `500` erro interno

### POST `/api/keys/check`
Body:
```json
{ "key": "GAMEKEY-abc123" }
```

Key existente (`200`):
```json
{
  "exists": true,
  "valid": true,
  "status": "AVAILABLE",
  "game": { "appId": "1174180", "name": "Sample Game" }
}
```

Key ausente (`404`):
```json
{
  "exists": false,
  "valid": false
}
```

## Criação de keys (sem endpoint público)
Não existe endpoint admin público para criar keys.
Use Prisma (`prisma studio`, `seed` ou operação direta no PostgreSQL) por operador confiável.

## Verificação local
```bash
npm install
npm run prisma:generate
npm run typecheck
npm run build
```

### Diagnóstico com curl
Com a API rodando localmente (`npm run dev`, porta padrão `3001`):

```bash
curl -s http://localhost:3001/health

curl -s -X POST http://localhost:3001/api/keys/redeem \
  -H "Content-Type: application/json" \
  -d '{"key":"GAMEKEY-ABC123","discordId":"123456789","discordUsername":"usuario"}'

curl -s "http://localhost:3001/api/keys/activated?discordId=123456789"

curl -s -X POST http://localhost:3001/api/keys/check \
  -H "Content-Type: application/json" -d '{"key":"GAMEKEY-ABC123"}'

curl -s -X POST http://localhost:3001/api/keys/validate \
  -H "Content-Type: application/json" -d '{"key":"GAMEKEY-ABC123"}'
```

Em produção troque `http://localhost:3001` por `https://byzeuskeys.shardweb.app`.

Se `/api/keys/redeem` responder `500` com `{"success":false,"message":"Erro interno"}`,
verifique os logs do servidor: o handler registra o código e os metadados do erro Prisma
(sem expor `DATABASE_URL`, tokens ou segredos). O caso mais comum é o banco ainda não ter
as colunas opcionais de resgate (`usedAt`, `usedBy`, `usedByUsername`, `redeemedAt`), o que
é resolvido com `npx prisma db push` na `DATABASE_URL` correta.
