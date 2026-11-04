# sigtcc-frontend

## Desenvolvimento

Sem Docker: `npm ci && npm run dev` (http://localhost:3000; o proxy `/api` usa `DEV_PROXY_TARGET`, padrão `http://localhost:8000`). A porta 3000 é fixa porque o backend só aceita login, refresh e logout vindos das origens de `JWT_TRUSTED_ORIGINS` (padrão `http://localhost:3000` e `http://127.0.0.1:3000`).

Com Docker: o `compose.yaml` fica no repositório `sigtcc-backend` (clone vizinho) e sobe o frontend em http://localhost:3000 junto com o restante do ambiente. Veja o README do backend.

O `Dockerfile` deste repositório é apenas de desenvolvimento (Vite com hot reload; o código-fonte é montado pelo Compose). Comandos: `npm run typecheck`, `npm run lint`, `npm test`.
