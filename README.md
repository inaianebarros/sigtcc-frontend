# sigtcc-frontend

## Desenvolvimento

Sem Docker: `npm ci && npm run dev` (http://localhost:3000; o proxy `/api` usa `DEV_PROXY_TARGET`, padrão `http://localhost:8000`). A porta 3000 é fixa porque o backend só aceita login, refresh e logout vindos das origens de `JWT_TRUSTED_ORIGINS` (padrão `http://localhost:3000` e `http://127.0.0.1:3000`).

Com Docker: o `compose.yaml` fica no repositório `sigtcc-backend` (clone vizinho) e sobe o frontend em http://localhost:3000 junto com o restante do ambiente. Veja o README do backend.

O `Dockerfile` deste repositório é apenas de desenvolvimento (para produção, veja `Dockerfile.production` abaixo) (Vite com hot reload; o código-fonte é montado pelo Compose). Comandos: `npm run typecheck`, `npm run lint`, `npm test`.

## Imagem de produção (homologação no Railway)

O `Dockerfile.production` gera a imagem pública da homologação (ADR backend 0021): o Vite compila a SPA com `VITE_API_BASE_URL=/api` (mesma origem) e o nginx (`nginx-unprivileged`, sem Node, sem código-fonte, usuário `nginx`) serve os estáticos e repassa `/api` ao backend. Ela fica em arquivo separado do `Dockerfile` de desenvolvimento, que o compose do backend constrói sem `target:` e não muda.

```bash
docker build -f Dockerfile.production -t sigtcc-frontend:prod .
docker run --rm -p 8080:8080 -e BACKEND_URL=http://host.docker.internal:8000 sigtcc-frontend:prod
```

Variáveis de execução (nenhuma é segredo; nada entra na imagem):

| Variável | Padrão | Função |
|---|---|---|
| `PORT` | `8080` | porta em que o nginx escuta (o Railway injeta a sua) |
| `BACKEND_URL` | `http://backend:8000` | endereço do backend, sem caminho (por exemplo `http://backend.railway.internal:8000`) |

O nome do backend é resolvido pelo nginx a cada 10 segundos (`resolver` lido de `/etc/resolv.conf`, com IPv6), então a imagem sobe mesmo sem o backend (o `/api` responde 502 até ele existir) e acompanha mudança de IP. `GET /healthz` responde 200 sem depender do backend.

Configuração no Railway: serviço a partir deste repositório com a variável `RAILWAY_DOCKERFILE_PATH=Dockerfile.production`, `BACKEND_URL` apontando para o endereço privado do backend e rota de healthcheck `/healthz`. Só este serviço recebe domínio público. A rede privada do Railway pode ser só IPv6: o backend precisa escutar em `::` (o nginx já escuta em IPv4 e IPv6).

**Atenção ao `NUM_PROXIES` do backend (ADR backend 0007).** O nginx repassa ao backend o IP do cliente que a borda do Railway informa no `X-Real-IP` (cabeçalho documentado pelo Railway para isso) como **único** valor do `X-Forwarded-For`, e descarta o `X-Forwarded-For` que chegou: o dele não traz o cliente de forma confiável, e um valor forjado pelo cliente não passa. Sem `X-Real-IP` (acesso direto ao contêiner), vale o IP da conexão. O backend vê, portanto, **um salto**: use `NUM_PROXIES=1`. Um valor errado faz todos os usuários dividirem um IP nos limites de autenticação, ou deixa o cliente forjar o IP. O `X-Forwarded-Proto` da borda é preservado, e `Host`, `Origin` e cookies seguem sem alteração (o `Host` público precisa estar em `DJANGO_ALLOWED_HOSTS`).

Outros detalhes: `client_max_body_size` de 11 MB (anexos de até 10 MB); `/assets` com cache de 1 ano e `immutable`; `index.html` sem cache; fallback para `index.html` nas rotas do React Router; gzip; `Content-Security-Policy` com `style-src 'unsafe-inline'` (Emotion/MUI injetam estilos em tempo de execução) e scripts só do próprio domínio. Os cabeçalhos de segurança não são aplicados ao `/api`, onde o Django já envia os seus.
