FROM node:20-alpine AS base
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/admin/package.json apps/admin/package.json

RUN corepack enable && corepack prepare pnpm@10.30.0 --activate
RUN pnpm install --frozen-lockfile

COPY apps/admin apps/admin

WORKDIR /app/apps/admin
RUN pnpm run build

EXPOSE 3001
CMD ["pnpm","run","start"]
