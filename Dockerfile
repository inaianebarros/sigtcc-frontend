# syntax=docker/dockerfile:1

# Imagem de DESENVOLVIMENTO do frontend (servidor do Vite com hot reload).
# O build de produção (estáticos servidos por um servidor web) fica para a issue #64.
ARG NODE_VERSION=22.22.3

FROM node:${NODE_VERSION}-trixie-slim AS dev

ENV NODE_ENV=development \
    npm_config_update_notifier=false

WORKDIR /app

RUN chown node:node /app
USER node

COPY --chown=node:node package.json package-lock.json ./
RUN --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000 \
    npm ci --no-audit --no-fund

COPY --chown=node:node . .

EXPOSE 3000

# Em desenvolvimento o código-fonte é montado em /app pelo Compose (recarga automática).
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000", "--strictPort"]
