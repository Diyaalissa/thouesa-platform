FROM node:20-alpine AS base
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN corepack enable && corepack prepare pnpm@10.30.0 --activate
RUN pnpm install --frozen-lockfile

COPY apps/web apps/web
COPY packages/shared packages/shared

WORKDIR /app/apps/web
RUN pnpm run build

EXPOSE 3000
CMD ["pnpm","run","start"]
