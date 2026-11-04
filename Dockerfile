# syntax=docker/dockerfile:1

# Imagem de DESENVOLVIMENTO do frontend (servidor do Vite com hot reload).
# O build de produção (estáticos servidos por um servidor web) fica para a issue #64.
ARG NODE_VERSION=22.22.3

FROM node:${NODE_VERSION}-trixie-slim AS dev

ENV NODE_ENV=development \
    npm_config_update_notifier=false

WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund \
    && chown -R node:node /app

COPY --chown=node:node . .

USER node
EXPOSE 3000

# Em desenvolvimento o código-fonte é montado em /app pelo Compose (recarga automática).
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000", "--strictPort"]
