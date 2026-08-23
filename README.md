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

## Rotas da API
- `GET /` e `GET /health`
- `POST /api/keys/validate`
- `POST /api/keys/check`

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

## Criação de keys (sem endpoint público)
Não existe endpoint admin público para criar keys.
Use Prisma (`prisma studio`, `seed` ou operação direta no PostgreSQL) por operador confiável.

## Verificação local
```bash
npm run prisma:generate
npm run typecheck
npm run build
```
